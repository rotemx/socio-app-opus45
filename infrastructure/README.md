# Socio Infrastructure

AWS infrastructure configuration using Terraform for the Socio chat application.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AWS il-central-1 (Tel Aviv)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                              VPC (10.0.0.0/16)                        │   │
│  │                                                                       │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                    │   │
│  │  │   Public Subnet A   │  │   Public Subnet B   │                    │   │
│  │  │    10.0.0.0/24      │  │    10.0.1.0/24      │                    │   │
│  │  │                     │  │                     │                    │   │
│  │  │  ┌───────────────┐  │  │                     │                    │   │
│  │  │  │  ALB (opt.)   │  │  │                     │                    │   │
│  │  │  └───────────────┘  │  │                     │                    │   │
│  │  └─────────────────────┘  └─────────────────────┘                    │   │
│  │                                                                       │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                    │   │
│  │  │  Private Subnet A   │  │  Private Subnet B   │                    │   │
│  │  │   10.0.10.0/24      │  │   10.0.11.0/24      │                    │   │
│  │  │                     │  │                     │                    │   │
│  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │                    │   │
│  │  │  │   EC2/ECS     │  │  │  │    Redis      │  │                    │   │
│  │  │  │   (opt.)      │  │  │  │   (opt.)      │  │                    │   │
│  │  │  └───────────────┘  │  │  └───────────────┘  │                    │   │
│  │  └─────────────────────┘  └─────────────────────┘                    │   │
│  │                                                                       │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                    │   │
│  │  │  Database Subnet A  │  │  Database Subnet B  │                    │   │
│  │  │   10.0.20.0/24      │  │   10.0.21.0/24      │                    │   │
│  │  │                     │  │                     │                    │   │
│  │  │  ┌─────────────────────────────────────────┐ │                    │   │
│  │  │  │       RDS PostgreSQL + PostGIS          │ │                    │   │
│  │  │  │           (db.t3.micro)                 │ │                    │   │
│  │  │  └─────────────────────────────────────────┘ │                    │   │
│  │  └─────────────────────┘  └─────────────────────┘                    │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐                             │
│  │        S3          │  │    CloudFront      │                             │
│  │   (Media Storage)  │──│       (CDN)        │                             │
│  └────────────────────┘  └────────────────────┘                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Terraform CLI** (v1.6.0+)
   ```bash
   # macOS
   brew install terraform

   # Linux
   curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
   sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
   sudo apt-get update && sudo apt-get install terraform
   ```

2. **AWS CLI** configured with credentials
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (il-central-1)
   ```

3. **IAM permissions** for:
   - VPC, Subnets, Route Tables, Internet Gateway
   - RDS, ElastiCache
   - S3, CloudFront
   - IAM (for service roles)
   - Secrets Manager
   - CloudWatch

## Quick Start

```bash
# Navigate to terraform directory
cd infrastructure/terraform

# Copy and customize variables
cp terraform.tfvars.example terraform.tfvars

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure
terraform apply
```

## Configuration

### Free Tier Optimization (Default)

The default configuration is optimized for AWS Free Tier:

| Resource | Configuration | Free Tier Status |
|----------|---------------|------------------|
| RDS | db.t3.micro, 20GB | 750 hrs/mo for 12 months |
| EC2 | t3.micro (if enabled) | 750 hrs/mo for 12 months |
| S3 | Standard storage | 5GB for 12 months |
| CloudFront | Enabled | 1TB/mo for 12 months |
| ElastiCache | Disabled by default | Not Free Tier |
| ALB | Disabled by default | Not Free Tier |
| NAT Gateway | Disabled by default | Not Free Tier |

### Production Configuration

For production, update `terraform.tfvars`:

```hcl
environment = "prod"

# Enable high availability
db_multi_az    = true
enable_redis   = true
enable_alb     = true

# Increase resources
db_instance_class          = "db.t3.small"
redis_node_type            = "cache.t3.small"
db_backup_retention_period = 30

# Security
allowed_cidr_blocks = ["YOUR_OFFICE_IP/32"]
s3_force_destroy    = false
```

## Resources Created

### Always Created
- VPC with public, private, and database subnets
- Internet Gateway and route tables
- RDS PostgreSQL 16 with PostGIS
- S3 bucket for media storage
- Security groups
- Secrets Manager secret for DB credentials
- CloudWatch alarms

### Optional (Disabled by Default)
- NAT Gateway (`enable_nat_gateway = true`)
- ElastiCache Redis (`enable_redis = true`)
- Application Load Balancer (`enable_alb = true`)
- EC2 instances (`enable_ec2 = true`)
- CloudFront CDN (`enable_cloudfront = true`, enabled by default)

## Outputs

After applying, retrieve outputs:

```bash
# All outputs
terraform output

# Specific outputs
terraform output db_instance_endpoint
terraform output cloudfront_url
terraform output media_bucket_id

# Database connection string (from Secrets Manager)
aws secretsmanager get-secret-value \
  --secret-id $(terraform output -raw db_credentials_secret_name) \
  --query SecretString --output text | jq -r .url
```

## Connecting to Resources

### Database (via SSH tunnel)

For local development, use SSH tunneling through a bastion host:

```bash
# Start tunnel
ssh -L 5432:DB_ENDPOINT:5432 ec2-user@BASTION_IP

# Connect
psql -h localhost -U socio_admin -d socio
```

### Using with Backend

Add these environment variables to your backend `.env`:

```bash
# Get from Terraform outputs
DATABASE_URL=postgresql://USER:PASS@HOST:5432/socio
REDIS_URL=redis://REDIS_HOST:6379
AWS_S3_BUCKET=socio-dev-media-XXXX
AWS_CLOUDFRONT_URL=https://XXXX.cloudfront.net
AWS_REGION=il-central-1
```

## Cost Estimation

### Development (Free Tier)
- **Months 1-12**: ~$0 (Free Tier covers most resources)
- **After Free Tier**: ~$15-20/month

### Production
| Resource | Monthly Cost |
|----------|-------------|
| RDS db.t3.small (Multi-AZ) | ~$50 |
| ElastiCache cache.t3.small | ~$24 |
| ALB | ~$16 |
| S3 + CloudFront | ~$10-30 |
| NAT Gateway | ~$32 |
| **Total** | **~$130-150/month** |

## Cleanup

To destroy all resources:

```bash
# Review what will be destroyed
terraform plan -destroy

# Destroy (requires confirmation)
terraform destroy
```

**Warning**: This will delete all data including the database. In production, set `deletion_protection = true` on RDS.

## Troubleshooting

### Common Issues

1. **"Error creating DB Instance: insufficient capacity"**
   - Try a different availability zone
   - Wait and retry (capacity issues are temporary)

2. **"AccessDenied" on S3**
   - Check IAM permissions
   - Verify bucket policy

3. **"VPC not found"**
   - Run `terraform init` to refresh state
   - Check AWS region configuration

### Logs

```bash
# Enable debug logging
export TF_LOG=DEBUG
terraform apply
```

## Security Considerations

1. **Never commit `terraform.tfvars`** - contains sensitive data
2. **Use Secrets Manager** for database credentials (already configured)
3. **Restrict `allowed_cidr_blocks`** in production
4. **Enable VPC Flow Logs** in production (automatically enabled)
5. **Review security groups** before production deployment
