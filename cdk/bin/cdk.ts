#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StaticSiteStack } from '../lib/static-site-stack';
import { EcsAstroStack } from '../lib/ecs-astro-stack';

const app = new cdk.App();
new StaticSiteStack(app, 'StaticSiteStack', {});
// Добавьте эту строчку (имя стека EcsStack-Astro даст имя балансировщика как у одногруппников)
new EcsAstroStack(app, 'ECSSta-Astro', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
});