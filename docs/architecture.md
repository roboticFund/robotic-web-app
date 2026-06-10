# Architecture Overview

This application is designed as a small internal AWS web app for managing algorithm metadata, training models, and uploaded training results from the existing `trade-engine` repository.

## Core components

- Frontend: React + TypeScript + Vite
- Backend: FastAPI Python application
- Infrastructure: AWS CDK in Python
- Authentication: Amazon Cognito user pools
- Artifact storage: Amazon S3
- Relational data: Existing RDS instance with a dedicated schema/database

## Key ideas

- Keep the frontend and backend separate and deploy the frontend as a static SPA.
- Use API Gateway HTTP API and Lambda for backend compute.
- Store uploaded artifacts in S3 and persist only metadata and summaries in the relational database.
- Support an offline upload workflow where the browser uploads artifacts directly to S3 using presigned URLs.

## Phase one scope

- Authentication and authorization
- Algorithm and version registry CRUD
- Training model CRUD
- Training result upload and finalize flow
- Result metadata and artifact management
- Dashboard and detail views for results

## Future phases

- Live training orchestration via Step Functions and AWS Batch
- Scheduling and run history
- Approval workflows and advanced permissions
- Operational dashboards and alerts

## Current development mode

The application is currently being hardened locally before AWS resources are created. In this mode, SQLite and local artifact storage are supported for development convenience. The CDK stack remains a placeholder until the AWS phase begins.
