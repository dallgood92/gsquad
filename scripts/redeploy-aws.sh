#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra/aws"
AWS_REGION="$(awk -F'"' '/^[[:space:]]*aws_region[[:space:]]*=/{print $2; exit}' "${INFRA_DIR}/terraform.tfvars")"
AWS_REGION="${AWS_REGION:-us-east-2}"
IMAGE_TAG="$(date -u +%Y%m%d%H%M%S)"
ECR_REPOSITORY="$(terraform -chdir="${INFRA_DIR}" output -raw ecr_repository_url)"
ECR_REGISTRY="${ECR_REPOSITORY%%/*}"

aws sts get-caller-identity >/dev/null
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
docker buildx build --platform linux/amd64 --target runtime --push --tag "${ECR_REPOSITORY}:${IMAGE_TAG}" "${ROOT_DIR}/server"
terraform -chdir="${INFRA_DIR}" apply -var="image_tag=${IMAGE_TAG}"

APP_URL="$(terraform -chdir="${INFRA_DIR}" output -raw application_url)"
API_URL="$(terraform -chdir="${INFRA_DIR}" output -raw api_url)"
WEBSOCKET_URL="$(terraform -chdir="${INFRA_DIR}" output -raw websocket_url)"
FRONTEND_BUCKET="$(terraform -chdir="${INFRA_DIR}" output -raw frontend_bucket)"
DISTRIBUTION_ID="$(terraform -chdir="${INFRA_DIR}" output -raw cloudfront_distribution_id)"
GOOGLE_CLIENT_ID="$(awk -F'"' '/^[[:space:]]*google_client_id[[:space:]]*=/{print $2; exit}' "${INFRA_DIR}/terraform.tfvars")"

(
  cd "${ROOT_DIR}/client"
  VITE_API_URL="${API_URL}" VITE_WEBSOCKET_URL="${WEBSOCKET_URL}" VITE_GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" npm run build
)
aws s3 sync "${ROOT_DIR}/client/dist" "s3://${FRONTEND_BUCKET}" --delete --region "${AWS_REGION}"
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths '/*' >/dev/null
echo "Deployment updated: ${APP_URL}"
