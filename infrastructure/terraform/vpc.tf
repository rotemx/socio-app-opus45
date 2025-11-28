# Socio Infrastructure - VPC Configuration

# =============================================================================
# VPC
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

# =============================================================================
# Internet Gateway
# =============================================================================

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# =============================================================================
# Public Subnets
# =============================================================================

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-${local.azs[count.index]}"
    Type = "public"
  }
}

# =============================================================================
# Private Subnets
# =============================================================================

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-${local.azs[count.index]}"
    Type = "private"
  }
}

# =============================================================================
# Database Subnets (isolated)
# =============================================================================

resource "aws_subnet" "database" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-database-${local.azs[count.index]}"
    Type = "database"
  }
}

# =============================================================================
# Route Tables - Public
# =============================================================================

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# =============================================================================
# Route Tables - Private (with optional NAT Gateway)
# =============================================================================

resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${local.name_prefix}-nat-gw"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[0].id
    }
  }

  tags = {
    Name = "${local.name_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# =============================================================================
# Route Tables - Database
# =============================================================================

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-database-rt"
  }
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# =============================================================================
# DB Subnet Group
# =============================================================================

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${local.name_prefix}"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

# =============================================================================
# ElastiCache Subnet Group
# =============================================================================

resource "aws_elasticache_subnet_group" "main" {
  count = var.enable_redis ? 1 : 0

  name        = "${local.name_prefix}-cache-subnet-group"
  description = "ElastiCache subnet group for ${local.name_prefix}"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-cache-subnet-group"
  }
}

# =============================================================================
# VPC Flow Logs (optional, for debugging)
# =============================================================================

resource "aws_flow_log" "main" {
  count = var.environment == "prod" ? 1 : 0

  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  iam_role_arn             = aws_iam_role.flow_log[0].arn
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.flow_log[0].arn
  max_aggregation_interval = 600

  tags = {
    Name = "${local.name_prefix}-flow-log"
  }
}

resource "aws_cloudwatch_log_group" "flow_log" {
  count = var.environment == "prod" ? 1 : 0

  name              = "/aws/vpc/${local.name_prefix}-flow-log"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-flow-log-group"
  }
}

resource "aws_iam_role" "flow_log" {
  count = var.environment == "prod" ? 1 : 0

  name = "${local.name_prefix}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-flow-log-role"
  }
}

resource "aws_iam_role_policy" "flow_log" {
  count = var.environment == "prod" ? 1 : 0

  name = "${local.name_prefix}-flow-log-policy"
  role = aws_iam_role.flow_log[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}
