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
- In AWS, set `DATABASE_SECRET_ARN` to read `DATABASE_URL` from Secrets Manager.
- Set `CORS_ORIGINS` to a comma-separated list of allowed frontend origins.
- `MAX_UPLOAD_BYTES` defaults to 250 MB.
- Uploaded filenames are normalized to basenames, and artifact keys must stay under `training-results/`.

## GitHub Parameter Files

- Algorithm versions can point at a GitHub repository file with repository owner, repository name, file path, and optional ref.
- Set `GITHUB_TOKEN` in `.env` when private repositories are needed.
- Set `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` in `.env` to use one default algorithm repository for every version.
- `GITHUB_PARAMETER_PATH_TEMPLATE` defaults to `resources/algorithms/{algorithm_code_lower}/algo_params.py`; version-level paths override this when a file lives somewhere else.
- Supported template fields include `algorithm_id`, `algorithm_code`, `algorithm_code_lower`, `algorithm_name`, `algorithm_name_lower`, `instrument`, `instrument_lower`, `resolution`, `resolution_lower`, `version_id`, `version_label`, `version_label_lower`, and `git_commit_sha`.
- JSON parameter files are parsed for display. Python `algo_params.py` files are parsed when they contain a literal `algo_params` dictionary, and the API derives `parameter_summary.robotic_fund_size` from the `ig-robotic-fund` account entry.
- The GitHub parameter response includes `commit_date` when GitHub can resolve the version ref or commit SHA. Algorithm versions also have an optional `effective_from` field for manually recording when a version was implemented.

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
