# ---- encryption key (RDS, S3, secrets) ----
resource "aws_kms_key" "main" {
  description             = "${local.name} data encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

# ---- PostgreSQL ----
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_db_instance" "postgres" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 200
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  db_name  = "jantahr"
  username = "jantahr_admin"
  password = random_password.db.result

  multi_az               = local.prod
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = local.prod ? 30 : 7
  backup_window           = "21:30-22:30" # 03:00-04:00 IST
  maintenance_window      = "Mon:22:30-Mon:23:30"

  skip_final_snapshot        = !local.prod
  final_snapshot_identifier  = local.prod ? "${local.name}-final" : null
  deletion_protection        = local.prod
  auto_minor_version_upgrade = true

  performance_insights_enabled = local.prod
}

# ---- application secrets ----
resource "random_password" "jwt" {
  length  = 64
  special = false
}

# Losing this key makes encrypted PAN / Aadhaar / bank fields unrecoverable — never rotate without a re-encryption job.
resource "random_password" "field_encryption" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name       = "${local.name}/app"
  kms_key_id = aws_kms_key.main.arn
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL   = "postgresql://${aws_db_instance.postgres.username}:${random_password.db.result}@${aws_db_instance.postgres.address}:5432/${aws_db_instance.postgres.db_name}?schema=public"
    JWT_SECRET     = random_password.jwt.result
    ENCRYPTION_KEY = random_password.field_encryption.result
  })
}

# ---- documents & payslips (encrypted, private, versioned) ----
resource "aws_s3_bucket" "documents" {
  bucket_prefix = "${local.name}-documents-"
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
