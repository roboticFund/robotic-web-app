# robotic-web-app

This repository is being rebuilt as a new AWS-backed web application for the `trade-engine` project.

## What's Included

- `frontend/` - React + TypeScript + Vite single-page app
- `backend/` - FastAPI Python backend for algorithms, versions, training models, results, artifacts, and admin values
- `infra/` - AWS CDK in Python, currently left as a placeholder until AWS resources are ready to be created
- `docs/` - architecture, upload contract, API, and developer guidance
- `AGENTS.md` - repository conventions and Codex guardrails

## Local Setup

### Backend

```powershell
cd backend
python -m venv .venv
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

## AWS Status

AWS infrastructure is intentionally deferred while the app is still in development mode. The target remains S3 + CloudFront for the SPA, Cognito for auth, API Gateway HTTP API + Lambda for the backend, S3 for artifacts, and RDS for relational data.
