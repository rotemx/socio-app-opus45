# Socio Infrastructure - Variables

# =============================================================================
# General Configuration
# =============================================================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "il-central-1" # Tel Aviv

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]+$", var.aws_region))
    error_message = "AWS region must be in format like 'il-central-1'."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "socio"
}

# =============================================================================
# VPC Configuration
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets (adds cost)"
  type        = bool
  default     = false # Disabled for Free Tier optimization
}

# =============================================================================
# RDS Configuration (PostgreSQL with PostGIS)
# =============================================================================

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro" # Free Tier eligible

  validation {
    condition     = can(regex("^db\\.", var.db_instance_class))
    error_message = "DB instance class must start with 'db.'."
  }
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "socio"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "socio_admin"
  sensitive   = true

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_username))
    error_message = "Database username must start with a letter."
  }
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20 # Free Tier limit

  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 1000
    error_message = "Allocated storage must be between 20 and 1000 GB."
  }
}

variable "db_backup_retention_period" {
  description = "Days to retain backups"
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_period >= 0 && var.db_backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days."
  }
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false # Disabled for Free Tier
}

# =============================================================================
# ElastiCache Configuration (Redis)
# =============================================================================

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro" # Smallest available (not Free Tier)
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1

  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

variable "enable_redis" {
  description = "Enable ElastiCache Redis cluster (adds ~$12/month cost)"
  type        = bool
  default     = false # Disabled by default for Free Tier
}

# =============================================================================
# S3 Configuration
# =============================================================================

variable "s3_force_destroy" {
  description = "Allow bucket destruction even with objects"
  type        = bool
  default     = false
}

variable "s3_versioning_enabled" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "s3_lifecycle_days" {
  description = "Days before transitioning to Glacier (0 to disable)"
  type        = number
  default     = 0 # Disabled for Free Tier simplicity
}

# =============================================================================
# CloudFront Configuration
# =============================================================================

variable "enable_cloudfront" {
  description = "Enable CloudFront CDN"
  type        = bool
  default     = true
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100" # Cheapest - US, Canada, Europe, Israel

  validation {
    condition = contains([
      "PriceClass_100",
      "PriceClass_200",
      "PriceClass_All"
    ], var.cloudfront_price_class)
    error_message = "Invalid CloudFront price class."
  }
}

# =============================================================================
# EC2/ECS Configuration
# =============================================================================

variable "enable_ec2" {
  description = "Enable EC2 instances for backend (alternative to ECS)"
  type        = bool
  default     = false # Use containers instead
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro" # Free Tier eligible
}

# =============================================================================
# ALB Configuration
# =============================================================================

variable "enable_alb" {
  description = "Enable Application Load Balancer (adds ~$16/month)"
  type        = bool
  default     = false # Disabled for Free Tier
}

# =============================================================================
# Monitoring & Logging
# =============================================================================

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced RDS monitoring"
  type        = bool
  default     = false # Disabled to reduce costs
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7

  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653
    ], var.log_retention_days)
    error_message = "Log retention must be a valid CloudWatch Logs retention value."
  }
}

# =============================================================================
# Security
# =============================================================================

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access resources"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict in production

  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "All values must be valid CIDR blocks."
  }
}
