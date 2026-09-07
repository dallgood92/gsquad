#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra/aws"

for command in aws docker terraform npm; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Missing required command: ${command}"
    exit 1
  fi
done

if [[ ! -f "${INFRA_DIR}/terraform.tfvars" ]]; then
  echo "Create infra/aws/terraform.tfvars from terraform.tfvars.example first."
  exit 1
fi

AWS_REGION="$(awk -F'"' '/^[[:space:]]*aws_region[[:space:]]*=/{print $2; exit}' "${INFRA_DIR}/terraform.tfvars")"
AWS_REGION="${AWS_REGION:-us-east-2}"
IMAGE_TAG="$(date -u +%Y%m%d%H%M%S)"

aws sts get-caller-identity >/dev/null

terraform -chdir="${INFRA_DIR}" init

# ECR must exist before the first container image can be pushed.
terraform -chdir="${INFRA_DIR}" apply -target=aws_ecr_repository.api -auto-approve
ECR_REPOSITORY="$(terraform -chdir="${INFRA_DIR}" output -raw ecr_repository_url)"
ECR_REGISTRY="${ECR_REPOSITORY%%/*}"

aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
docker buildx build --platform linux/amd64 --target runtime --push --tag "${ECR_REPOSITORY}:${IMAGE_TAG}" "${ROOT_DIR}/server"
docker buildx build --platform linux/amd64 --target migration --push --tag "${ECR_REPOSITORY}:${IMAGE_TAG}-migration" "${ROOT_DIR}/server"

# Build the data plane first while keeping the public API stopped. This lets the
# migration task finish before the first application task receives traffic.
terraform -chdir="${INFRA_DIR}" apply -var="image_tag=${IMAGE_TAG}" -var="desired_count=0"

CLUSTER="$(terraform -chdir="${INFRA_DIR}" output -raw ecs_cluster_name)"
TASK_FAMILY="$(terraform -chdir="${INFRA_DIR}" output -raw migration_task_family)"
SECURITY_GROUP="$(terraform -chdir="${INFRA_DIR}" output -raw api_security_group_id)"
SUBNETS="$(terraform -chdir="${INFRA_DIR}" output -json public_subnet_ids | tr -d '[]" ' | tr ',' ' ')"
read -r -a SUBNET_ARRAY <<< "${SUBNETS}"
SUBNET_CSV="$(IFS=,; echo "${SUBNET_ARRAY[*]}")"

echo "Running database migrations..."
MIGRATION_TASK="$(aws ecs run-task \
  --region "${AWS_REGION}" \
  --cluster "${CLUSTER}" \
  --task-definition "${TASK_FAMILY}" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_CSV}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)"

if [[ -z "${MIGRATION_TASK}" || "${MIGRATION_TASK}" == "None" ]]; then
  echo "AWS did not start the migration task. Check the ECS events and try again."
  exit 1
fi

aws ecs wait tasks-stopped --region "${AWS_REGION}" --cluster "${CLUSTER}" --tasks "${MIGRATION_TASK}"
MIGRATION_EXIT="$(aws ecs describe-tasks --region "${AWS_REGION}" --cluster "${CLUSTER}" --tasks "${MIGRATION_TASK}" --query 'tasks[0].containers[0].exitCode' --output text)"
if [[ "${MIGRATION_EXIT}" != "0" ]]; then
  echo "Database migration failed with exit code ${MIGRATION_EXIT}. Check CloudWatch logs."
  exit 1
fi

terraform -chdir="${INFRA_DIR}" apply -var="image_tag=${IMAGE_TAG}" -auto-approve

APP_URL="$(terraform -chdir="${INFRA_DIR}" output -raw application_url)"
API_URL="$(terraform -chdir="${INFRA_DIR}" output -raw api_url)"
WEBSOCKET_URL="$(terraform -chdir="${INFRA_DIR}" output -raw websocket_url)"
FRONTEND_BUCKET="$(terraform -chdir="${INFRA_DIR}" output -raw frontend_bucket)"
DISTRIBUTION_ID="$(terraform -chdir="${INFRA_DIR}" output -raw cloudfront_distribution_id)"
GOOGLE_CLIENT_ID="$(awk -F'"' '/^[[:space:]]*google_client_id[[:space:]]*=/{print $2; exit}' "${INFRA_DIR}/terraform.tfvars")"

echo "Building and uploading the frontend..."
(
  cd "${ROOT_DIR}/client"
  VITE_API_URL="${API_URL}" VITE_WEBSOCKET_URL="${WEBSOCKET_URL}" VITE_GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" npm run build
)
aws s3 sync "${ROOT_DIR}/client/dist" "s3://${FRONTEND_BUCKET}" --delete --region "${AWS_REGION}"
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths '/*' >/dev/null

aws ecs update-service --region "${AWS_REGION}" --cluster "${CLUSTER}" --service api --force-new-deployment >/dev/null
aws ecs wait services-stable --region "${AWS_REGION}" --cluster "${CLUSTER}" --services api

echo
echo "GSQUAD is deployed: ${APP_URL}"
echo "API health check: ${API_URL}/health"
