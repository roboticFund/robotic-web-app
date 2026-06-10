# Backend Local Development

This backend is a FastAPI application that supports algorithms, algorithm versions, training models, training results, artifact upload targets, and shared admin dropdown values.

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

## Local Artifact Uploads

- If `S3_BUCKET` is configured, uploads use AWS S3 presigned URLs.
- If `S3_BUCKET` is empty, the backend stores uploaded files under `storage/`.
- `MAX_UPLOAD_BYTES` defaults to 250 MB.
- Uploaded filenames are normalized to basenames, and artifact keys must stay under `training-results/`.

## Database

The default development database is SQLite at `./dev.db` via `DATABASE_URL=sqlite:///./dev.db`.

For local SQLite only, `AUTO_CREATE_SQLITE_TABLES=true` lets the app create missing tables on startup. For any shared database, including RDS, run migrations instead:

```powershell
alembic upgrade head
```

## Tests

```powershell
python -m unittest discover
```
