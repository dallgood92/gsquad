# Deploying GSQUAD to AWS

This runbook deploys the React website to a private S3 bucket behind CloudFront and deploys the Express API and WebSocket server to ECS Fargate behind an Application Load Balancer. PostgreSQL runs in RDS, Redis runs in ElastiCache, attachments use a separate private S3 bucket, application secrets live in Secrets Manager, and logs go to CloudWatch.

Nothing is created in AWS until you run the deployment command. The resources in this design incur ongoing AWS charges.

## 1. What you need

- An AWS account with billing alerts enabled
- A domain in a public Route 53 hosted zone
- A Google OAuth Web client
- AWS CLI v2, Docker Desktop, Terraform 1.7 or newer, Node.js, and npm
- An AWS CLI login with permission to create VPC, ECS, ECR, ALB, RDS, ElastiCache, S3, CloudFront, Route 53, ACM, IAM, Secrets Manager, and CloudWatch resources

Use AWS IAM Identity Center or another temporary AWS login. Do not create permanent access keys for the application and do not send credentials to another person.

Verify your local AWS login:

```bash
aws sts get-caller-identity
```

The account number shown by that command is the account that will be billed.

## 2. Domain and DNS

The deployment creates these addresses:

- `https://chat.YOUR_DOMAIN` for the application
- `https://api.YOUR_DOMAIN` for HTTP and WebSocket traffic

Your domain must have a public hosted zone in Route 53. In the Route 53 console, open **Hosted zones**, select the domain, and copy its **Hosted zone ID**.

If the domain is registered elsewhere, update the registrar to use the Route 53 hosted zone's name servers before deploying. DNS certificate validation cannot finish until Route 53 is authoritative.

## 3. Google login

Open Google Cloud Console, select the OAuth project, and open the Web application client used by GSQUAD.

Add this Authorized JavaScript origin:

```text
https://chat.YOUR_DOMAIN
```

Copy the client ID. A client ID is configuration rather than a password, but keep the populated Terraform variables file out of Git.

## 4. Configure Terraform

From the project root:

```bash
cp infra/aws/terraform.tfvars.example infra/aws/terraform.tfvars
```

Edit `infra/aws/terraform.tfvars`:

```hcl
aws_region       = "us-east-2"
app_name         = "gsquad"
root_domain      = "yourdomain.com"
route53_zone_id  = "YOUR_HOSTED_ZONE_ID"
google_client_id = "YOUR_GOOGLE_CLIENT_ID"
image_tag        = "latest"
desired_count    = 1
```

The default database and Redis sizes are intended for early testing. Review AWS pricing before deploying. Production traffic may require larger or redundant instances.

`terraform.tfvars` and Terraform state are ignored by Git. Terraform state contains generated database, Redis, and JWT secrets, so protect it like a password. Before a team shares this deployment, migrate the state to a versioned, encrypted S3 Terraform backend with state locking.

## 5. Review the infrastructure

Initialize Terraform and inspect the proposed resources:

```bash
terraform -chdir=infra/aws init
terraform -chdir=infra/aws plan
```

Read the plan before approving it. Pay special attention to the AWS account, region, domain, database class, Redis class, and resource count.

## 6. First deployment

Start Docker Desktop, then run:

```bash
chmod +x scripts/deploy-aws.sh scripts/redeploy-aws.sh
./scripts/deploy-aws.sh
```

The script:

1. Verifies the active AWS identity.
2. Creates the ECR repository.
3. Builds separate Linux API and one-time migration containers and pushes them to ECR.
4. Creates the remaining AWS infrastructure.
5. Runs all Prisma migrations as a one-time ECS task.
6. Builds the client with the production API, WebSocket, and Google settings.
7. Uploads the client to the private frontend bucket.
8. Clears the CloudFront cache and waits for ECS to stabilize.

Certificates and CloudFront can make the first deployment take several minutes. The command ends by printing the application and health-check addresses.

## 7. Verify the deployment

Open:

```text
https://api.YOUR_DOMAIN/health
```

It should return `{"status":"ok"}`. Then open `https://chat.YOUR_DOMAIN` in two separate browser profiles and test:

- Google login and logout
- Sending and accepting a friend request
- Direct messages in both directions
- Creating, leaving, and deleting groups
- Live typing, presence, notifications, and read indicators
- Replying, editing, and deleting messages
- Uploading and viewing a photo and a short video
- Refreshing the browser on the application URL

The browser's network panel should show the WebSocket connected to `wss://api.YOUR_DOMAIN`.

## 8. Routine deployments

After changing the application, deploy a new timestamped server image and refreshed frontend with:

```bash
./scripts/redeploy-aws.sh
```

If a release includes a Prisma migration, run the full deployment script instead so the migration task runs before the final ECS restart:

```bash
./scripts/deploy-aws.sh
```

Never run `prisma migrate dev` against production. Production uses `prisma migrate deploy`.

## 9. Logs and troubleshooting

API and migration output is stored in CloudWatch Logs under:

```text
/ecs/gsquad-api
```

Useful checks:

```bash
terraform -chdir=infra/aws output
aws ecs describe-services --cluster gsquad --services api --region us-east-2
aws logs tail /ecs/gsquad-api --follow --region us-east-2
```

Common problems:

- **Certificate remains pending:** Route 53 is not authoritative or the hosted-zone ID is wrong.
- **Google login rejects the site:** the exact HTTPS frontend origin is missing from Google OAuth settings.
- **API returns a CORS error:** the browser is not using the configured `chat.` domain.
- **ECS task keeps restarting:** inspect the CloudWatch log stream and ECS service events.
- **Attachments fail:** confirm the request uses the HTTPS frontend and inspect S3 CORS and the ECS task role.
- **WebSocket disconnects after five minutes:** confirm traffic is going through the created ALB and its 300-second idle timeout; the client automatically reconnects.
- **Migration fails:** inspect the migration task's log stream before restarting the service.

## 10. Rollback

Every deployment pushes a timestamped ECR tag. To roll the API back, set `image_tag` in `terraform.tfvars` to a previous ECR tag and run:

```bash
terraform -chdir=infra/aws apply
```

Database migrations must be written to remain compatible with the prior application release. Prisma does not automatically reverse production migrations.

## 11. Backups and launch hardening

The database has seven days of automated backups, encrypted storage, deletion protection, and a required final snapshot. Before inviting real users:

- Move Terraform state to an encrypted remote backend.
- Enable AWS Budgets alerts and billing anomaly detection.
- Add AWS WAF or application rate limiting.
- Add CSRF protection for cookie-authenticated write routes.
- Add automated integration and browser tests.
- Add RDS and Redis alarms in CloudWatch.
- Increase RDS and Redis redundancy for production availability.
- Add an orphaned-upload cleanup job and malware scanning for attachments.
- Review data retention and account-deletion requirements.

## 12. Removing the environment

Do not casually run `terraform destroy`. RDS deletion protection intentionally prevents accidental deletion. Export or snapshot important data first. Then disable deletion protection through a reviewed Terraform change, apply it, and only afterward destroy the environment.

The final RDS snapshot and S3 buckets may remain and continue to incur storage charges. Confirm retained resources in the AWS console after any teardown.
