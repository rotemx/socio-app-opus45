# Socio Infrastructure - CloudFront CDN

# =============================================================================
# Managed Cache Policies (data sources)
# =============================================================================

data "aws_cloudfront_cache_policy" "caching_optimized" {
  count = var.enable_cloudfront ? 1 : 0
  name  = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3origin" {
  count = var.enable_cloudfront ? 1 : 0
  name  = "Managed-CORS-S3Origin"
}

# =============================================================================
# CloudFront Origin Access Control
# =============================================================================

resource "aws_cloudfront_origin_access_control" "media" {
  count = var.enable_cloudfront ? 1 : 0

  name                              = "${local.name_prefix}-media-oac"
  description                       = "Origin Access Control for media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# =============================================================================
# CloudFront Distribution for Media
# =============================================================================

resource "aws_cloudfront_distribution" "media" {
  count = var.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Socio media CDN - ${var.environment}"
  default_root_object = ""
  price_class         = var.cloudfront_price_class

  # Origin - S3 bucket
  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.media.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.media[0].id
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.media.id}"

    # Use managed policies instead of deprecated forwarded_values
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3origin[0].id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Response headers policy for CORS and security
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors[0].id
  }

  # Cache behavior for images (longer cache)
  ordered_cache_behavior {
    path_pattern     = "/images/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.media.id}"

    # Use managed policies
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3origin[0].id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Apply CORS policy consistently
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors[0].id
  }

  # Cache behavior for voice notes (shorter cache for privacy)
  ordered_cache_behavior {
    path_pattern     = "/voice/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.media.id}"

    # Use managed policies
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3origin[0].id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Apply CORS policy consistently
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors[0].id
  }

  # Geo restrictions (none for now)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL Certificate (use CloudFront default cert for dev)
  viewer_certificate {
    cloudfront_default_certificate = true
    # For custom domain, use ACM certificate:
    # acm_certificate_arn      = aws_acm_certificate.cdn.arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error responses
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = ""
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = ""
    error_caching_min_ttl = 300
  }

  tags = {
    Name = "${local.name_prefix}-media-cdn"
  }
}

# =============================================================================
# CloudFront Response Headers Policy (CORS)
# =============================================================================

resource "aws_cloudfront_response_headers_policy" "cors" {
  count = var.enable_cloudfront ? 1 : 0

  name    = "${local.name_prefix}-cors-policy"
  comment = "CORS headers for media CDN"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = var.environment == "prod" ? [
        "https://socio.app",
        "https://www.socio.app"
      ] : ["*"]
    }

    access_control_max_age_sec = 86400

    origin_override = true
  }

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

# =============================================================================
# CloudWatch Alarms for CloudFront
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "cdn_error_rate" {
  count = var.enable_cloudfront ? 1 : 0

  alarm_name          = "${local.name_prefix}-cdn-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "CloudFront 5xx error rate is high"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.media[0].id
    Region         = "Global"
  }

  # Note: Add alarm_actions when SNS topic is configured
  # alarm_actions = [aws_sns_topic.alerts.arn]
  # ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${local.name_prefix}-cdn-error-alarm"
  }
}
