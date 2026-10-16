import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'node:path';

export class StaticSiteStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const repositoryRoot = path.resolve(__dirname, '../..');
        const tursoSecretArn = process.env.TURSO_SECRET_ARN;
        const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
        if (!tursoSecretArn || !supabaseUrl || !supabaseAnonKey) {
            throw new Error(
                'Set TURSO_SECRET_ARN, SUPABASE_URL, and SUPABASE_ANON_KEY before synthesizing or deploying the AWS stack.',
            );
        }
        const tursoSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'TursoCredentials', tursoSecretArn);

        const lambdaEnvironment = {
            TURSO_SECRET_ARN: tursoSecretArn,
            SUPABASE_URL: supabaseUrl,
            SUPABASE_ANON_KEY: supabaseAnonKey,
            ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'dinosaurkiril@gmail.com',
        };
        const apiHandler = new nodejs.NodejsFunction(this, 'TursoApiHandler', {
            entry: path.join(repositoryRoot, 'api', 'handler.ts'),
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_22_X,
            projectRoot: repositoryRoot,
            depsLockFilePath: path.join(repositoryRoot, 'package-lock.json'),
            timeout: cdk.Duration.seconds(20),
            memorySize: 512,
            environment: lambdaEnvironment,
        });
        tursoSecret.grantRead(apiHandler);

        const api = new apigateway.RestApi(this, 'TursoApi', {
            restApiName: 'revISE Turso API',
            deployOptions: { stageName: 'prod' },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['POST', 'OPTIONS'],
                allowHeaders: ['Authorization', 'Content-Type'],
                maxAge: cdk.Duration.hours(1),
            },
        });
        api.root.addResource('api').addResource('data').addMethod(
            'POST',
            new apigateway.LambdaIntegration(apiHandler),
            { apiKeyRequired: false },
        );
        const cleanupHandler = new nodejs.NodejsFunction(this, 'TestHistoryCleanupHandler', {
            entry: path.join(repositoryRoot, 'api', 'handler.ts'),
            handler: 'cleanupHandler',
            runtime: lambda.Runtime.NODEJS_22_X,
            projectRoot: repositoryRoot,
            depsLockFilePath: path.join(repositoryRoot, 'package-lock.json'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: lambdaEnvironment,
        });
        tursoSecret.grantRead(cleanupHandler);

        new events.Rule(this, 'TestHistoryDetailRetentionSchedule', {
            schedule: events.Schedule.rate(cdk.Duration.hours(1)),
            targets: [new targets.LambdaFunction(cleanupHandler)],
        });

        const apiCachePolicy = new cloudfront.CachePolicy(this, 'TursoApiCachePolicy', {
            minTtl: cdk.Duration.seconds(0),
            defaultTtl: cdk.Duration.seconds(0),
            maxTtl: cdk.Duration.seconds(0),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        });
        const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'TursoApiOriginRequestPolicy', {
            headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
                'Content-Type',
                'Origin',
                'Access-Control-Request-Method',
                'Access-Control-Request-Headers',
            ),
            cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
            queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
        });

        const siteBucket = new s3.Bucket(this, 'SiteBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
            defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket) },
            additionalBehaviors: {
                'api/*': {
                    origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', api.url)), {
                        originPath: `/${api.deploymentStage.stageName}`,
                    }),
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: apiCachePolicy,
                    originRequestPolicy: apiOriginRequestPolicy,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                },
            },
            defaultRootObject: 'index.html',
        });

        new s3deploy.BucketDeployment(this, 'DeploySite', {
            sources: [s3deploy.Source.asset('../dist')],
            destinationBucket: siteBucket,
            distribution,
            distributionPaths: ['/*'], 
        });

        new cdk.CfnOutput(this, 'CloudFrontUrl', {
            value: `https://${distribution.distributionDomainName}`,
        });
        new cdk.CfnOutput(this, 'TursoApiGatewayUrl', { value: api.url });
    }
}// Automatic CloudFront CDN cache invalidation!
