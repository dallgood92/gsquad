output "application_url" {
  value = "https://${local.app_domain}"
}
output "api_url" {
  value = "https://${local.api_domain}"
}
output "websocket_url" {
  value = "wss://${local.api_domain}"
}
output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
output "frontend_bucket" {
  value = aws_s3_bucket.frontend.bucket
}
output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}
output "ecs_service_name" {
  value = aws_ecs_service.api.name
}
output "ecs_task_family" {
  value = aws_ecs_task_definition.api.family
}
output "migration_task_family" {
  value = aws_ecs_task_definition.migration.family
}
output "attachment_bucket" {
  value = aws_s3_bucket.attachments.bucket
}
output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}
output "api_security_group_id" {
  value = aws_security_group.api.id
}
