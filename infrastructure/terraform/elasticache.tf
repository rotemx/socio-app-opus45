# Socio Infrastructure - ElastiCache Redis

# =============================================================================
# ElastiCache Redis Cluster
# =============================================================================

resource "aws_elasticache_cluster" "redis" {
  count = var.enable_redis ? 1 : 0

  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis[0].name
  subnet_group_name    = aws_elasticache_subnet_group.main[0].name
  security_group_ids   = [aws_security_group.redis[0].id]
  port                 = 6379

  # Encryption - enabled for production
  transit_encryption_enabled = var.environment == "prod"

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = var.environment == "prod" ? 7 : 0
  snapshot_window          = "04:00-05:00"

  # Note: Add notification_topic_arn when SNS topic is configured
  # notification_topic_arn = aws_sns_topic.alerts.arn

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}

# =============================================================================
# ElastiCache Parameter Group
# =============================================================================

resource "aws_elasticache_parameter_group" "redis" {
  count = var.enable_redis ? 1 : 0

  name        = "${local.name_prefix}-redis-params"
  family      = "redis7"
  description = "Redis parameter group for ${local.name_prefix}"

  # Optimize for chat application workload
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  # Enable keyspace notifications for pub/sub
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name = "${local.name_prefix}-redis-params"
  }
}

# =============================================================================
# Auth Token for Redis (optional, for production)
# =============================================================================

resource "random_password" "redis_auth" {
  count = var.enable_redis && var.environment == "prod" ? 1 : 0

  length  = 32
  special = false # Redis auth token doesn't support special chars
}

# =============================================================================
# CloudWatch Alarms for Redis
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.enable_redis ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis CPU utilization is high"

  dimensions = {
    CacheClusterId = aws_elasticache_cluster.redis[0].cluster_id
  }

  tags = {
    Name = "${local.name_prefix}-redis-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = var.enable_redis ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis memory usage is high"

  dimensions = {
    CacheClusterId = aws_elasticache_cluster.redis[0].cluster_id
  }

  tags = {
    Name = "${local.name_prefix}-redis-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.enable_redis ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Redis is evicting keys"

  dimensions = {
    CacheClusterId = aws_elasticache_cluster.redis[0].cluster_id
  }

  tags = {
    Name = "${local.name_prefix}-redis-evictions-alarm"
  }
}
