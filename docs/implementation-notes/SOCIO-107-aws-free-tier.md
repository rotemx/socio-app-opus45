# SOCIO-107: Configure AWS Free Tier Resources

## Overview

This ticket implemented AWS infrastructure configuration using Terraform for the Tel Aviv region (il-central-1), optimized for AWS Free Tier usage. Additionally, AWS SDK integration was added to the NestJS backend for S3 file uploads and Secrets Manager.

## Implementation Summary

### Terraform Infrastructure Files Created

1. **`infrastructure/terraform/main.tf`**
   - Terraform configuration with AWS provider for il-central-1
   - Required providers: aws (~> 5.0), random (~> 3.6)
   - Random suffix for unique resource names
   - Common tags applied to all resources

2. **`infrastructure/terraform/variables.tf`**
   - Comprehensive variable definitions with validations:
     - General: aws_region, environment, project_name
     - VPC: vpc_cidr, enable_nat_gateway
     - RDS: db_instance_class, db_name, db_username, storage settings
     - ElastiCache: enable_redis, redis_node_type
     - S3: s3_force_destroy, s3_versioning_enabled
     - CloudFront: enable_cloudfront, cloudfront_price_class
     - Security: allowed_cidr_blocks

3. **`infrastructure/terraform/vpc.tf`**
   - VPC with DNS hostnames enabled
   - Public, private, and database subnets across 2 AZs
   - Internet Gateway for public subnets
   - Optional NAT Gateway (disabled by default for Free Tier)
   - Route tables with proper associations
   - DB and ElastiCache subnet groups
   - Optional VPC Flow Logs (production only)

4. **`infrastructure/terraform/security.tf`**
   - ALB security group (HTTP/HTTPS from allowed CIDRs)
   - Application security group (app traffic from ALB)
   - Database security group (PostgreSQL from app/VPC)
   - Redis security group (conditional, when enabled)
   - Bastion security group (dev only, for DB access)

5. **`infrastructure/terraform/rds.tf`**
   - RDS PostgreSQL 16 with PostGIS support
   - db.t3.micro instance (Free Tier eligible)
   - Secrets Manager for credential storage
   - Custom parameter group for PostGIS
   - Performance Insights enabled (7-day retention)
   - CloudWatch alarms for CPU, storage, connections
   - Automatic minor version upgrades

6. **`infrastructure/terraform/elasticache.tf`**
   - Optional Redis cluster (disabled by default)
   - cache.t3.micro node type
   - Custom parameter group with volatile-lru eviction
   - Transit encryption for production
   - CloudWatch alarms for CPU, memory, evictions

7. **`infrastructure/terraform/s3.tf`**
   - Media bucket with server-side encryption (AES256)
   - Versioning support
   - CORS configuration for uploads
   - Lifecycle rules for incomplete uploads
   - Bucket policy for CloudFront access
   - IAM role and policy for application access
   - Optional backup bucket (production only)

8. **`infrastructure/terraform/cloudfront.tf`**
   - CloudFront distribution with Origin Access Control
   - Managed cache policies (CachingOptimized)
   - CORS S3 origin request policy
   - Custom response headers policy (security headers)
   - Cache behaviors for images and voice files
   - CloudWatch alarm for 5xx error rate

9. **`infrastructure/terraform/outputs.tf`**
   - VPC, subnet, and security group IDs
   - RDS endpoint and Secrets Manager ARN
   - Redis endpoint (when enabled)
   - S3 bucket details
   - CloudFront distribution URL
   - Environment configuration bundle
   - Cost estimation breakdown

10. **`infrastructure/terraform/terraform.tfvars.example`**
    - Example configuration for all variables
    - Comments explaining Free Tier implications

11. **`infrastructure/terraform/.gitignore`**
    - Ignores .tfstate, .terraform, .tfvars files

12. **`infrastructure/README.md`**
    - Architecture diagram
    - Prerequisites and quick start guide
    - Configuration options
    - Cost estimation table
    - Troubleshooting tips

### Backend AWS Module Created

1. **`apps/backend/src/aws/aws.module.ts`**
   - Global NestJS module for AWS services
   - Exports S3Service and SecretsService

2. **`apps/backend/src/aws/s3.service.ts`**
   - S3 client initialization with IAM role support
   - File upload (direct and presigned URL)
   - File download and deletion
   - Object existence check and listing
   - Key generation with category prefixes
   - CloudFront URL generation
   - Zod schema validation for inputs

3. **`apps/backend/src/aws/secrets.service.ts`**
   - Secrets Manager client initialization
   - Secret retrieval with in-memory caching (5 min TTL)
   - Database credential parsing with URL encoding
   - Secret CRUD operations
   - Masked logging for security

4. **`apps/backend/src/aws/index.ts`**
   - Barrel exports for AWS module

### Files Modified

1. **`apps/backend/src/app.module.ts`**
   - Added AwsModule to imports

2. **`apps/backend/src/config/env.validation.ts`**
   - Added AWS_CLOUDFRONT_URL and AWS_SECRETS_DB_ARN

3. **`apps/backend/src/config/config.service.ts`**
   - Added getters for awsCloudfrontUrl and awsSecretsDbArn

4. **`apps/backend/.env.example`**
   - Comprehensive AWS configuration section
   - Comments with Terraform output references

5. **`apps/backend/.env`**
   - Added CORS_ORIGIN, JWT_REFRESH_EXPIRY, AWS_REGION

6. **`apps/backend/package.json`**
   - Added @aws-sdk/client-s3
   - Added @aws-sdk/s3-request-presigner
   - Added @aws-sdk/client-secrets-manager

## Architecture Decisions

### Free Tier Optimization

Resources are configured for AWS Free Tier where possible:

| Resource | Configuration | Free Tier Status |
|----------|---------------|------------------|
| RDS | db.t3.micro, 20GB | 750 hrs/mo (12 months) |
| S3 | Standard storage | 5GB (12 months) |
| CloudFront | Enabled | 1TB/mo (12 months) |
| ElastiCache | Disabled by default | Not Free Tier (~$12/mo) |
| ALB | Disabled by default | Not Free Tier (~$16/mo) |
| NAT Gateway | Disabled by default | Not Free Tier (~$32/mo) |

### Security Decisions

1. **No plaintext passwords in secrets** - Database URL is constructed at runtime
2. **URL-encoded credentials** - Handles special characters safely
3. **Transit encryption** - Redis TLS enabled for production
4. **CloudFront OAC** - S3 bucket not publicly accessible
5. **Security groups** - Principle of least privilege

### Terraform Best Practices

1. **Managed cache policies** - Using AWS managed policies instead of deprecated forwarded_values
2. **Conditional resources** - Many resources are optional with enable_* flags
3. **State isolation** - .gitignore for state files
4. **Validation** - Input variable validation rules

## Usage

### Deploy Infrastructure

```bash
cd infrastructure/terraform

# Copy and customize variables
cp terraform.tfvars.example terraform.tfvars

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### Configure Backend

After Terraform apply, update `.env`:

```bash
# Get outputs
terraform output db_credentials_secret_name
terraform output media_bucket_id
terraform output cloudfront_url

# Update .env
AWS_S3_BUCKET=socio-dev-media-xxxx
AWS_CLOUDFRONT_URL=https://xxxx.cloudfront.net
AWS_SECRETS_DB_ARN=arn:aws:secretsmanager:il-central-1:xxx:secret:socio-dev-db-credentials-xxx
```

### Using S3 Service

```typescript
import { S3Service, FileCategory } from '../aws';

@Injectable()
export class MediaService {
  constructor(private readonly s3: S3Service) {}

  async uploadAvatar(userId: string, file: Buffer, contentType: string) {
    if (!this.s3.isConfigured()) {
      throw new Error('S3 not configured');
    }

    const key = this.s3.generateKey(FileCategory.AVATARS, 'avatar.jpg', userId);

    return this.s3.upload({
      key,
      body: file,
      contentType,
    });
  }

  async getUploadUrl(filename: string) {
    const key = this.s3.generateKey(FileCategory.IMAGES, filename);

    return this.s3.getUploadUrl({
      key,
      contentType: 'image/jpeg',
      expiresIn: 3600,
    });
  }
}
```

### Using Secrets Service

```typescript
import { SecretsService } from '../aws';

@Injectable()
export class DatabaseService {
  constructor(private readonly secrets: SecretsService) {}

  async getDatabaseUrl(): Promise<string> {
    const secretArn = this.config.awsSecretsDbArn;

    if (!secretArn) {
      return this.config.databaseUrl;
    }

    const creds = await this.secrets.getDatabaseCredentials(secretArn);
    return creds?.url ?? this.config.databaseUrl;
  }
}
```

## Code Review Fixes Applied

### Iteration 1 (16 issues)

1. **RDS secret URL** - Removed plaintext password from connection URL
2. **CloudFront forwarded_values** - Replaced with managed cache policies
3. **CORS consistency** - Added response_headers_policy_id to all cache behaviors
4. **ElastiCache encryption** - Added transit_encryption_enabled for production
5. **Credentials encoding** - URL encode username/password in database URL

### Iteration 2 (5 issues - mostly minor)

1. **Security group descriptions** - Updated to accurately reflect CIDR restrictions
2. **il-central-1 region** - Confirmed valid (Tel Aviv launched August 2023)
3. **NAT Gateway isolation** - Documented as intentional for Free Tier

## Remaining Work (Future Tickets)

1. **SNS Alerting** - Add SNS topic for CloudWatch alarm notifications
2. **Bastion Host** - Add EC2 bastion for database access
3. **Custom Domain** - ACM certificate and Route53 configuration
4. **WAF** - Web Application Firewall for production
5. **Backup Automation** - AWS Backup for RDS and S3

## Cost Estimation

### Development (Free Tier, first 12 months)

| Resource | Monthly Cost |
|----------|-------------|
| RDS db.t3.micro | $0 (750 hrs) |
| S3 (< 5GB) | $0 |
| CloudFront (< 1TB) | $0 |
| **Total** | **$0** |

### After Free Tier / Production

| Resource | Monthly Cost |
|----------|-------------|
| RDS db.t3.micro | ~$12.41 |
| ElastiCache (if enabled) | ~$11.68 |
| S3 + CloudFront | ~$5-10 |
| ALB (if enabled) | ~$16.43 |
| NAT Gateway (if enabled) | ~$32 |
| **MVP Total** | **~$15-75** |

## Dependencies

### Terraform

- terraform >= 1.6.0
- aws provider ~> 5.0
- random provider ~> 3.6

### Backend

- @aws-sdk/client-s3 ^3.940.0
- @aws-sdk/s3-request-presigner ^3.940.0
- @aws-sdk/client-secrets-manager ^3.940.0

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| AWS_REGION | Yes | AWS region (default: il-central-1) |
| AWS_ACCESS_KEY_ID | No* | AWS credentials (use IAM role in AWS) |
| AWS_SECRET_ACCESS_KEY | No* | AWS credentials (use IAM role in AWS) |
| AWS_S3_BUCKET | No | S3 bucket for media storage |
| AWS_CLOUDFRONT_URL | No | CloudFront distribution URL |
| AWS_SECRETS_DB_ARN | No | Secrets Manager ARN for DB credentials |

*Not required when running on EC2/ECS with IAM role attached
