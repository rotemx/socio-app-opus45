# Socio Infrastructure - Outputs

# =============================================================================
# VPC Outputs
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of database subnets"
  value       = aws_subnet.database[*].id
}

# =============================================================================
# Security Group Outputs
# =============================================================================

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "app_security_group_id" {
  description = "ID of the application security group"
  value       = aws_security_group.app.id
}

output "database_security_group_id" {
  description = "ID of the database security group"
  value       = aws_security_group.database.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = var.enable_redis ? aws_security_group.redis[0].id : null
}

# =============================================================================
# RDS Outputs
# =============================================================================

output "db_instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "db_instance_endpoint" {
  description = "Connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "Address of the RDS instance"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_credentials_secret_name" {
  description = "Name of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.name
}

# =============================================================================
# ElastiCache Outputs
# =============================================================================

output "redis_cluster_id" {
  description = "ID of the ElastiCache Redis cluster"
  value       = var.enable_redis ? aws_elasticache_cluster.redis[0].cluster_id : null
}

output "redis_endpoint" {
  description = "Connection endpoint for Redis"
  value       = var.enable_redis ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : null
}

output "redis_port" {
  description = "Port for Redis"
  value       = var.enable_redis ? aws_elasticache_cluster.redis[0].cache_nodes[0].port : null
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = var.enable_redis ? "redis://${aws_elasticache_cluster.redis[0].cache_nodes[0].address}:${aws_elasticache_cluster.redis[0].cache_nodes[0].port}" : null
}

# =============================================================================
# S3 Outputs
# =============================================================================

output "media_bucket_id" {
  description = "ID of the media S3 bucket"
  value       = aws_s3_bucket.media.id
}

output "media_bucket_arn" {
  description = "ARN of the media S3 bucket"
  value       = aws_s3_bucket.media.arn
}

output "media_bucket_domain" {
  description = "Domain name of the media S3 bucket"
  value       = aws_s3_bucket.media.bucket_regional_domain_name
}

output "s3_access_role_arn" {
  description = "ARN of the IAM role for S3 access"
  value       = aws_iam_role.app_s3_access.arn
}

# =============================================================================
# CloudFront Outputs
# =============================================================================

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.media[0].id : null
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.media[0].domain_name : null
}

output "cloudfront_url" {
  description = "URL of the CloudFront distribution"
  value       = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.media[0].domain_name}" : null
}

# =============================================================================
# Environment Configuration Output
# =============================================================================

output "environment_config" {
  description = "Environment configuration for application"
  value = {
    environment = var.environment
    region      = var.aws_region

    database = {
      host         = aws_db_instance.main.address
      port         = aws_db_instance.main.port
      name         = var.db_name
      secret_arn   = aws_secretsmanager_secret.db_credentials.arn
    }

    redis = var.enable_redis ? {
      host = aws_elasticache_cluster.redis[0].cache_nodes[0].address
      port = aws_elasticache_cluster.redis[0].cache_nodes[0].port
    } : null

    s3 = {
      bucket = aws_s3_bucket.media.id
      region = var.aws_region
    }

    cloudfront = var.enable_cloudfront ? {
      distribution_id = aws_cloudfront_distribution.media[0].id
      domain_name     = aws_cloudfront_distribution.media[0].domain_name
    } : null
  }
  sensitive = true
}

# =============================================================================
# Cost Estimation
# =============================================================================

output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown (approximate)"
  value = {
    note = "Estimates based on AWS pricing for il-central-1 region"
    free_tier = {
      ec2_t3_micro  = "750 hrs/mo (first 12 months)"
      rds_t3_micro  = "750 hrs/mo + 20GB storage (first 12 months)"
      s3_storage    = "5GB (first 12 months)"
      cloudfront    = "1TB data transfer (first 12 months)"
    }
    after_free_tier = {
      rds_db_t3_micro      = "~$12.41/mo"
      elasticache_t3_micro = var.enable_redis ? "~$11.68/mo" : "$0 (disabled)"
      s3_estimated         = "~$2-5/mo (depends on usage)"
      cloudfront_estimated = var.enable_cloudfront ? "~$4.25/mo" : "$0 (disabled)"
    }
  }
}
