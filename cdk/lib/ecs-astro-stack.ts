import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class EcsAstroStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tursoSecretArn = process.env.TURSO_SECRET_ARN;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '';

    // 1. Создаем сеть (VPC)
    const vpc = new ec2.Vpc(this, 'AstroVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // 2. Создаем ECS Кластер
    const cluster = new ecs.Cluster(this, 'AstroCluster', { vpc });

    // 3. Подключаем репозиторий ECR astro-blog
    const ecrRepo = ecr.Repository.fromRepositoryName(this, 'AstroEcrRepo', 'astro-blog');

    // 4. Запускаем Fargate за Application Load Balancer
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Astro', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo, process.env.IMAGE_TAG || 'latest'),
        containerPort: 4321,
        environment: {
          PORT: '4321',
          TURSO_SECRET_ARN: tursoSecretArn || '',
          SUPABASE_URL: supabaseUrl,
          SUPABASE_ANON_KEY: supabaseAnonKey,
          ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'dinosaurkiril@gmail.com',
          AWS_LAMBDA_FUNCTION_NAME: 'ecs-task-handler', // чтобы handler.ts знал, что нужно брать секрет из AWS Secrets Manager
        },
      },
      publicLoadBalancer: true,
    });

    // Даем контейнеру права читать секреты базы Turso
    if (tursoSecretArn) {
      const tursoSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'TursoSecretEcs', tursoSecretArn);
      tursoSecret.grantRead(fargateService.taskDefinition.taskRole);
    }

    // Балансировщик теперь проверяет РЕАЛЬНЫЙ health-check
    fargateService.targetGroup.configureHealthCheck({
      path: '/api/health',
      port: '4321',
      healthyHttpCodes: '200',
    });

    // Вывод URL балансировщика
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'SSR - load balancer URL for Google Sheets',
    });
  }
}