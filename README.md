# robotic-web-app

This repository is being rebuilt as a new AWS-backed web application for the `trade-engine` project.

## What's Included

- `frontend/` - React + TypeScript + Vite single-page app
- `backend/` - FastAPI Python backend for algorithms, versions, training models, results, artifacts, and admin values
- `infra/` - AWS CDK in Python for the production AWS stack
- `docs/` - architecture, upload contract, API, and developer guidance
- `AGENTS.md` - repository conventions and Codex guardrails

## Local Setup

### Backend

```powershell
cd backend
python -m venv .venv
# Run once if PowerShell blocks virtualenv activation scripts.
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The default development database is SQLite at `./dev.db`. For local SQLite only, the app can auto-create missing tables on startup. Shared databases should use Alembic migrations instead:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8000` by default. Override this with `VITE_API_BASE_URL` if needed.

## Verification

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m unittest discover

cd ..\frontend
npm run build
```

## AWS Deployment

The production stack is defined in `infra/` with AWS CDK. It creates S3 buckets for the frontend and uploaded artifacts, CloudFront for the React app, Cognito for user management, API Gateway HTTP API, a Lambda-hosted FastAPI backend, and IAM permissions.

In production, CloudFront serves the React app and proxies `/v1/*` plus `/health` to API Gateway. The frontend defaults to same-origin API calls for production builds.

Before the first deploy, create a Secrets Manager secret containing the production `DATABASE_URL`. The secret can be either a plain connection string or JSON containing `DATABASE_URL`.

```powershell
aws configure sso
aws sso login
aws sts get-caller-identity

aws secretsmanager create-secret `
  --name robotic-web-app/prod/database-url `
  --secret-string "mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE"
```

Then deploy with CDK:

```powershell
# One-time local prerequisites:
npm install -g aws-cdk
# Install/start Docker Desktop before running cdk diff/deploy.

cd frontend
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

The production database name, secret ARN, and VPC ID are configured in `infra/cdk.json`. Lambda runs in private subnets. This application stack does not manage the shared RDS security group.

If you later add a custom frontend domain, pass it as an allowed origin for S3 artifact upload CORS, for example `-c allowedOrigins=<FRONTEND_URL>`.

`apiAuthEnabled` defaults to `false` in `infra/cdk.json` because the frontend does not yet include a Cognito login/token flow. After login is implemented, deploy with `-c apiAuthEnabled=true` to require Cognito JWTs on API routes.
