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
  - Query filters: `skip`, `limit`, `algo_id`, `algo_version_id`, `current_only`, `status`, `run_source`, `combined_only`
- `POST /v1/training-results/uploads`
- `POST /v1/training-results`
- `PATCH /v1/training-results/{result_id}`
- `POST /v1/training-results/{result_id}/artifacts`
- `DELETE /v1/training-results/{result_id}`
- `DELETE /v1/training-results/{result_id}/artifacts/{artifact_id}`
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
- Training results keep `algo_version_id` as the primary version and may also include `algo_version_ids` for combined runs linked to multiple algorithm versions.
- A training result can have multiple artifacts. Use `POST /v1/training-results/{result_id}/artifacts` to append uploaded files to an existing run; supplied summary/chart JSON is merged into the existing result metadata.
- Use `PATCH /v1/training-results/{result_id}` to edit result metadata: `model_id`, `run_source`, `status`, `run_started_at`, `run_completed_at`, `data_from`, `data_to`, `summary_json`, and `chart_series_json`. Summary/chart JSON sent to this endpoint replaces the saved metadata object.
- Result and artifact deletes remove the application metadata records so they disappear from the UI. Object-storage deletion is left to storage lifecycle policy until AWS deletion semantics are configured.
- Algorithm and algorithm-version deletes are soft deletes. Active frontend lists hide inactive algorithms/versions, while historical training results remain queryable and expose inactive linked-version metadata.
- `GET /v1/algorithms/{algo_id}/versions` accepts `include_inactive=true` for historical lookup screens.
- `import-algorithm-metadata` accepts sanitized algorithm metadata only; account secrets, workstation paths, and generated analysis output paths are intentionally ignored.
