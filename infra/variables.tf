variable "aws_region" {
  description = "Deployment region (Mumbai keeps employee data in India — DPDP Act)"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  type    = string
  default = "staging"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "web_domain" {
  description = "Public host for the web app, e.g. app.jantahr.com"
  type        = string
}

variable "api_domain" {
  description = "Public host for the API, e.g. api.jantahr.com (must match the web build's NEXT_PUBLIC_API_URL)"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate (in the same region) covering web_domain and api_domain. Leave empty for HTTP-only staging."
  type        = string
  default     = ""
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "api_image_tag" {
  description = "Tag of the jantahr-api image in ECR"
  type        = string
  default     = "latest"
}

variable "web_image_tag" {
  type    = string
  default = "latest"
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "smtp_host" {
  description = "SMTP endpoint (e.g. email-smtp.ap-south-1.amazonaws.com for SES). Empty = mails only logged."
  type        = string
  default     = ""
}
