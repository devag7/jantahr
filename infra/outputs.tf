output "alb_dns_name" {
  description = "Point web_domain and api_domain CNAME/ALIAS records here"
  value       = aws_lb.main.dns_name
}

output "ecr_api_repository" {
  value = aws_ecr_repository.repo["api"].repository_url
}

output "ecr_web_repository" {
  value = aws_ecr_repository.repo["web"].repository_url
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "db_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
