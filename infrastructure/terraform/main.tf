# Socio Infrastructure - Main Configuration
# AWS Free Tier optimized setup for Tel Aviv region (il-central-1)

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Uncomment to use S3 backend for state management
  # backend "s3" {
  #   bucket         = "socio-terraform-state"
  #   key            = "infrastructure/terraform.tfstate"
  #   region         = "il-central-1"
  #   dynamodb_table = "socio-terraform-locks"
  #   encrypt        = true
  # }
}

# AWS Provider Configuration - Tel Aviv Region
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Socio"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Data source for current AWS region
data "aws_region" "current" {}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values for common configurations
locals {
  name_prefix = "socio-${var.environment}"
  common_tags = {
    Project     = "Socio"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Use first two available AZs
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}
