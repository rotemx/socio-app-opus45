# Socio Infrastructure - RDS PostgreSQL with PostGIS

# =============================================================================
# Random password for database
# =============================================================================

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# =============================================================================
# Secrets Manager for database credentials
# =============================================================================

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}-db-credentials"
  description             = "Database credentials for ${local.name_prefix}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name = "${local.name_prefix}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    database = var.db_name
    # Note: Connection URL should be constructed at runtime to avoid storing password in plaintext
  })
}

# =============================================================================
# RDS Parameter Group (for PostGIS)
# =============================================================================

resource "aws_db_parameter_group" "main" {
  name        = "${local.name_prefix}-pg-params"
  family      = "postgres16"
  description = "PostgreSQL parameter group for ${local.name_prefix}"

  # PostGIS requires shared_preload_libraries
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  # Performance tuning for Free Tier instance
  parameter {
    name  = "max_connections"
    value = "100"
  }

  parameter {
    name  = "work_mem"
    value = "4096" # 4MB
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "65536" # 64MB
  }

  # Enable pg_stat_statements
  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }

  tags = {
    Name = "${local.name_prefix}-pg-params"
  }
}

# =============================================================================
# RDS Instance
# =============================================================================

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  # Engine configuration
  engine               = "postgres"
  engine_version       = "16.4"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  max_allocated_storage = var.environment == "prod" ? 100 : var.db_allocated_storage
  storage_type         = "gp2"
  storage_encrypted    = true

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  # Parameter group
  parameter_group_name = aws_db_parameter_group.main.name

  # Backup configuration
  backup_retention_period = var.db_backup_retention_period
  backup_window           = "03:00-04:00" # UTC
  maintenance_window      = "sun:04:00-sun:05:00"

  # Performance insights (Free Tier: 7 days retention)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Monitoring
  monitoring_interval = var.enable_enhanced_monitoring ? 60 : 0
  monitoring_role_arn = var.enable_enhanced_monitoring ? aws_iam_role.rds_monitoring[0].arn : null

  # Other settings
  auto_minor_version_upgrade = true
  deletion_protection        = var.environment == "prod"
  skip_final_snapshot        = var.environment != "prod"
  final_snapshot_identifier  = var.environment == "prod" ? "${local.name_prefix}-final-snapshot" : null
  copy_tags_to_snapshot      = true

  tags = {
    Name = "${local.name_prefix}-postgres"
  }

  lifecycle {
    ignore_changes = [password]
  }
}

# =============================================================================
# Enhanced Monitoring Role (optional)
# =============================================================================

resource "aws_iam_role" "rds_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0

  name = "${local.name_prefix}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-rds-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# =============================================================================
# CloudWatch Alarms for RDS
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "${local.name_prefix}-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Database CPU utilization is high"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${local.name_prefix}-db-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${local.name_prefix}-db-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120 # 5GB in bytes
  alarm_description   = "Database free storage is low"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${local.name_prefix}-db-storage-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "db_connections" {
  alarm_name          = "${local.name_prefix}-db-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Database connection count is high"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${local.name_prefix}-db-connections-alarm"
  }
}
