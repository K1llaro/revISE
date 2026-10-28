# ADR-001: Choosing Serverless over ECS Load Balancer for Production

## Status
Accepted

## Context
For my revISE project, I had to evaluate two different ways to host the application on AWS:
1. **Serverless (S3 + CloudFront + Lambda):** Astro static files on S3, served by CloudFront, and an AWS Lambda function for my Turso database API (`/api/health`).
2. **Containers (Docker + ECS Fargate + ALB):** Running the Astro container 24/7 on AWS ECS behind an Application Load Balancer.

I implemented both in AWS CDK to test them and compare how they work.

## Decision
I chose the **Serverless setup (S3 + CloudFront + Lambda)** for my actual production site.

I deployed the **ECS + ALB stack** only to complete the lab requirements, test container health checks, and compare the two architectures.

## Reasons
1. **Cost:** 
   An Application Load Balancer costs around $16–$20 every month just to stay online, plus ECS runtime costs. Because this is a student project, I do not want to pay $30+ every month for an idle server. Serverless scales to zero: if no one visits the site, it costs $0.
2. **Speed:** 
   CloudFront caches my static pages on edge servers close to users, which makes page loading faster than sending every request to a single load balancer in Ireland.
3. **Maintenance:** 
   S3 and Lambda are fully managed by AWS. I do not have to manage containers, VPCs, or open server ports for the frontend.

## Trade-offs
Because my frontend on S3 is static, whenever I edit a page, I have to run a new build and deploy it through GitHub Actions. I accept this trade-off because it saves money and keeps the system simple.