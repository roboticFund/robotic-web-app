# API Design

This file describes the initial API surface for the backend.

## Endpoints

- `GET /v1/algorithms`
- `POST /v1/algorithms`
- `GET /v1/algorithms/{algo_id}`
- `PATCH /v1/algorithms/{algo_id}`
- `DELETE /v1/algorithms/{algo_id}`
- `GET /v1/algorithms/{algo_id}/versions`
- `POST /v1/algorithms/{algo_id}/versions`
- `GET /v1/algorithm-versions/{version_id}`
- `PATCH /v1/algorithm-versions/{version_id}`
- `DELETE /v1/algorithm-versions/{version_id}`
- `POST /v1/algorithm-versions/{version_id}/make-current`
- `GET /v1/training-models`
- `POST /v1/training-models`
- `GET /v1/training-models/{model_id}`
- `PATCH /v1/training-models/{model_id}`
- `DELETE /v1/training-models/{model_id}`
- `GET /v1/training-results`
- `POST /v1/training-results/uploads`
- `POST /v1/training-results`
- `GET /v1/training-results/{result_id}`
- `GET /v1/training-results/{result_id}/artifacts`
- `GET /v1/training-results/{result_id}/visualization`
- `GET /v1/admin/options/{option_type}`
- `POST /v1/admin/options`
- `DELETE /v1/admin/options/{option_type}/{value}`
- `POST /v1/admin/options/reset`
- `POST /v1/admin/import-algorithm-metadata`

## Notes

- `option_type` is one of `instrument` or `resolution`.
- Artifact keys must be relative object keys under `training-results/`.
- `import-algorithm-metadata` accepts sanitized algorithm metadata only; account secrets, workstation paths, and generated analysis output paths are intentionally ignored.
