# robotic-web-app

This repository is being rebuilt as a new AWS-backed web application for the `trade-engine` project.

## What’s included

- `frontend/` — React + TypeScript + Vite single-page app
- `backend/` — FastAPI Python backend with initial routing scaffolding
- `infra/` — AWS CDK in Python for infrastructure deployment
- `docs/` — architecture, upload contract, API, and developer guidance
- `AGENTS.md` — repository conventions and Codex guardrails

## Local setup

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Notes

- The frontend expects the backend at `http://localhost:8000` by default.
- Use `frontend/.env.example` and `backend/.env.example` to configure environment variables.

## Next steps

1. Review the new repository layout and docs.
2. Install frontend dependencies from `frontend/`.
3. Install backend dependencies from `backend/`.
4. Extend the backend API and frontend pages from the initial scaffold.
