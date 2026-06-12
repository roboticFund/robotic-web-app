# AWS CDK Deployment

This folder defines the AWS production stack for `robotic-web-app`.

## What CDK Creates

- Private S3 bucket for the React build
- CloudFront distribution for the frontend
- Private S3 bucket for uploaded training/result artifacts
- Cognito User Pool and browser app client
- FastAPI backend on AWS Lambda
- API Gateway HTTP API
- CloudFront proxy behaviours for `/v1/*` and `/health`
- Optional Cognito JWT authorizer for API routes
- IAM permissions for Lambda to access S3 and Secrets Manager

The existing RDS database is treated as an external dependency. Store its SQLAlchemy `DATABASE_URL` in AWS Secrets Manager and pass the secret name or ARN to CDK.

## Required One-Time AWS Setup

Install/start Docker Desktop before running CDK. CDK uses Docker to package Linux-compatible Lambda dependencies.

```powershell
npm install -g aws-cdk

aws configure sso
aws sso login
aws sts get-caller-identity

aws secretsmanager create-secret `
  --name robotic-web-app/prod/database-url `
  --secret-string "mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE"
```

If the secret already exists, update it instead:

```powershell
aws secretsmanager put-secret-value `
  --secret-id robotic-web-app/prod/database-url `
  --secret-string "mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE"
```

## First Deploy

Build the frontend before deploying so CDK can publish `frontend/dist` to the frontend bucket.

```powershell
cd ..\frontend
npm install
npm run build

cd ..\infra
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cdk bootstrap
cdk diff --profile <AWS_PROFILE>
cdk deploy --profile <AWS_PROFILE>
```

## Useful CDK Context Values

Production database/network context is stored in `cdk.json` so normal deploys preserve the private Lambda-to-RDS path. Override values only when deliberately targeting another environment.

```powershell
cdk deploy `
  -c databaseSecretArn=<DATABASE_SECRET_ARN> `
  -c databaseName=<DATABASE_NAME> `
  -c allowedOrigins=<FRONTEND_URL> `
  -c vpcId=<RDS_VPC_ID> `
  --profile <AWS_PROFILE>
```

Supported values:

- `databaseSecretName` - Secrets Manager secret name containing `DATABASE_URL`.
- `databaseSecretArn` - Use this instead of `databaseSecretName` if you prefer an ARN.
- `databaseName` - Database/schema within the RDS cluster, for example `robotic_web_app`.
- `allowedOrigins` - Comma-separated extra browser origins for API/S3 CORS.
- `allowedOrigins` is mainly needed for custom frontend domains or direct API testing. The default CloudFront URL is added automatically for S3 artifact uploads.
- `vpcId` - Existing VPC for Lambda, required if RDS is private.
- `lambdaSecurityGroupIds` - Optional comma-separated existing security groups for Lambda.
- `apiAuthEnabled` - Set to `true` only after the frontend has a Cognito login/token flow.
- `githubTokenSecretArn` - Secrets Manager ARN containing the private GitHub repository token.
- `githubRepoOwner` - Default GitHub owner for algorithm parameter files.
- `githubRepoName` - Default GitHub repository for algorithm parameter files.
- `githubParameterPathTemplate` - Repository-relative `algo_params.py` path template.

The production GitHub token is stored in Secrets Manager as
`robotic-web-app/prod/github-token`. Update that secret when the GitHub token is
rotated; do not add the token value to `cdk.json` or a committed environment
file.

## Database Network Security

The production Lambda runs in private subnets with NAT egress. CDK creates a security group for this Lambda but does not modify the shared RDS security group. Database network access remains owned by `DataManagementStack`.

## After Deploy

CDK prints the important outputs:

- `FrontendUrl`
- `ApiUrl`
- `ArtifactBucketName`
- `UserPoolId`
- `UserPoolClientId`
- `BackendLambdaSecurityGroupIds`

For production frontend releases, leave `VITE_API_BASE_URL` unset so calls to `/v1/*` go through the same CloudFront URL as the website.

```powershell
cd ..\frontend
npm run build

cd ..\infra
cdk deploy --profile <AWS_PROFILE>
```

## CodePipeline

`pipeline_app.py` and `pipeline_stack.py` define the self-updating production CodePipeline. Deploy that stack separately with:

```powershell
cdk deploy RoboticWebAppPipelineStack `
  --app "python pipeline_app.py" `
  --profile <AWS_PROFILE>
```

See `docs/codepipeline-deployment.md` for GitHub authorization and the full setup sequence.
