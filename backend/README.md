# Backend Local Development

This backend is a FastAPI application that supports algorithms, algorithm versions, training models, training results, and artifact upload targets.

## Setup

1. Create a virtual environment:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Create a local `.env` file from the example:

```powershell
copy .env.example .env
```

4. Run the API server:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Local artifact uploads

- If `S3_BUCKET` is configured, uploads use AWS S3 presigned URLs.
- If `S3_BUCKET` is empty, the backend stores uploaded files under `storage/`.

## Database

The default development database is SQLite at `./dev.db` via `DATABASE_URL=sqlite:///./dev.db`.
If you want to connect to your existing RDS instance, override `DATABASE_URL` in `.env`.
