# Socio Infrastructure - S3 Buckets

# =============================================================================
# Media Storage Bucket
# =============================================================================

resource "aws_s3_bucket" "media" {
  bucket        = "${local.name_prefix}-media-${random_id.suffix.hex}"
  force_destroy = var.s3_force_destroy

  tags = {
    Name = "${local.name_prefix}-media"
  }
}

# Versioning
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = var.s3_versioning_enabled ? "Enabled" : "Suspended"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for media uploads
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.environment == "prod" ? [
      "https://socio.app",
      "https://www.socio.app"
    ] : ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  count  = var.s3_lifecycle_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {
      prefix = "archives/"
    }

    transition {
      days          = var.s3_lifecycle_days
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "expire-incomplete-uploads"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "media" {
  count  = var.enable_cloudfront ? 1 : 0
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.media.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.media[0].arn
          }
        }
      }
    ]
  })
}

# =============================================================================
# Backup Bucket (for production)
# =============================================================================

resource "aws_s3_bucket" "backups" {
  count = var.environment == "prod" ? 1 : 0

  bucket        = "${local.name_prefix}-backups-${random_id.suffix.hex}"
  force_destroy = false

  tags = {
    Name = "${local.name_prefix}-backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# =============================================================================
# IAM Policy for S3 Access
# =============================================================================

resource "aws_iam_policy" "s3_media_access" {
  name        = "${local.name_prefix}-s3-media-access"
  description = "Policy for accessing media S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ListBucket"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.media.arn
      },
      {
        Sid    = "ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-s3-media-access"
  }
}

# =============================================================================
# IAM Role for Application S3 Access
# =============================================================================

resource "aws_iam_role" "app_s3_access" {
  name = "${local.name_prefix}-app-s3-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "ec2.amazonaws.com",
            "ecs-tasks.amazonaws.com"
          ]
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-app-s3-role"
  }
}

resource "aws_iam_role_policy_attachment" "app_s3_access" {
  role       = aws_iam_role.app_s3_access.name
  policy_arn = aws_iam_policy.s3_media_access.arn
}
