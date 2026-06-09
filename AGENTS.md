# AGENTS

This repository is intended to be maintained and extended with the help of Copilot/Codex. The rules below help preserve consistency and keep generated code aligned with the architecture.

## Code style

- Use Python 3.14+ for backend and CDK code.
- Use React + TypeScript for frontend code.
- Keep UI styling simple with Tailwind CSS utility classes.
- Prefer explicit typing in TypeScript and Pydantic models in Python.

## Architecture rules

- Frontend must talk to the backend only through documented API routes.
- The backend must validate all JSON payloads with Pydantic models.
- Uploaded artifacts go to S3; relational data stays in the database.
- Do not put machine-specific local file paths into persisted metadata.

## Deployment

- Use AWS CDK in Python for infrastructure.
- Use GitHub Actions and AWS OIDC for deployment; do not commit permanent AWS keys.
- Keep credentials out of source control.

## When a task is done

- All new user-facing functionality has a documented API contract.
- The backend is covered by at least one basic smoke test.
- The frontend builds successfully with `npm run build`.
- The `README.md` describes how to run the project locally.
