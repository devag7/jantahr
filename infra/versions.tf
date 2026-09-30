terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.60" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # Remote state. Create the bucket + lock table once, then `terraform init`.
  backend "s3" {
    bucket         = "jantahr-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "jantahr-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "JantaHR"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
