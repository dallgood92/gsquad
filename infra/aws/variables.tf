variable "aws_region" {
  description = "Region for API and data services."
  type        = string
  default     = "us-east-2"
}
variable "app_name" {
  description = "Short lowercase resource prefix."
  type        = string
  default     = "gsquad"
}
variable "root_domain" {
  description = "Route 53 hosted domain, such as example.com."
  type        = string
}
variable "route53_zone_id" {
  description = "Public Route 53 hosted-zone ID."
  type        = string
}
variable "google_client_id" {
  description = "Google OAuth web client ID."
  type        = string
  sensitive   = true
}
variable "image_tag" {
  description = "ECR image tag deployed to ECS."
  type        = string
  default     = "latest"
}
variable "desired_count" {
  description = "Number of API tasks."
  type        = number
  default     = 1
}
variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}
variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}
