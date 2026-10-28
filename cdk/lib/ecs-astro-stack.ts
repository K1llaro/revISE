import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';
import * as path from 'node:path';

export class EcsAstroStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repositoryRoot = path.resolve(__dirname, '../..');

    // 1. Создаем сеть (VPC). ВАЖНО: natGateways: 0 экономит деньги (NAT Gateway платный)
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

    // 3. Создаем Fargate сервис с Application Load Balancer
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Astro', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      assignPublicIp: true, // Нужно для работы без NAT Gateway
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(repositoryRoot, {
          file: 'Dockerfile.astro',
          buildArgs: {
            PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '',
            PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '',
          },
        }),
        containerPort: 4321,
      },
      publicLoadBalancer: true,
    });

    // Настраиваем Health Check балансировщика на корень сайта
    fargateService.targetGroup.configureHealthCheck({
      path: '/',
      port: '4321',
      healthyHttpCodes: '200',
    });

    // Выводим готовый URL балансировщика
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'SSR - load balancer URL for Google Sheets',
    });
  }
}