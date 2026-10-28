import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class EcsAstroStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Создаем сеть (VPC) без платных NAT Gateway
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

    // 3. Подключаем репозиторий ECR astro-blog (строго по Lab 6)
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
      },
      publicLoadBalancer: true,
    });

    // Проверка здоровья балансировщика
    fargateService.targetGroup.configureHealthCheck({
      path: '/',
      port: '4321',
      healthyHttpCodes: '200',
    });

    // Вывод заветного URL балансировщика для Google Таблицы
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'SSR - load balancer URL for Google Sheets',
    });
  }
}