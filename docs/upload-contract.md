# Upload Contract

This document defines the offline artifact upload contract for training results and optimisation outputs.

## Accepted artifact types

- `stats_csv` — summary metrics CSV
- `raw_result_csv` — raw trade output CSV
- `best_params_json` — optimisation parameter JSON
- `analysis_html` — report HTML or visualization artifacts
- `other` — any additional artifacts classified by type

## Metadata persisted in the API

The frontend should submit the following payload when finalizing an upload:

- `algo_version_id` — referenced algorithm version
- `model_id` — referenced training model
- `run_source` — e.g. `offline_upload`
- `status` — e.g. `completed`
- `run_started_at` and `run_completed_at`
- `data_from` and `data_to`
- `summary` — summary metrics extracted from the uploaded artifacts
- `artifacts` — array of artifact descriptors

### Artifact descriptor fields

- `artifact_type`
- `file_name`
- `s3_key`
- `content_type`
- `byte_size`
- `checksum_sha256`

## Path hygiene

Uploaded bundles may contain machine-specific local paths. The upload pipeline must strip absolute paths and preserve only business-relevant metadata such as file name, artifact type, and object key.
