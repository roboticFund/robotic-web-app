# Upload Contract

This document defines the offline artifact upload contract for training results and optimisation outputs.

## Accepted artifact types

- `stats_csv` - summary metrics CSV
- `raw_result_csv` - raw trade output CSV
- `best_params_json` - optimisation parameter JSON
- `analysis_html` - report HTML or visualization artifacts
- `analysis_png` - generated chart images such as equity analysis PNGs
- `other` - any additional artifacts classified by type

## Metadata persisted in the API

The frontend should submit the following payload when finalizing an upload:

- `algo_version_id` - referenced algorithm version
- `algo_version_ids` - optional array of all linked algorithm versions for combined results; include `algo_version_id` as the first/primary version
- `model_id` - referenced training model
- `run_source` - e.g. `offline_upload`
- `status` - one of `pending`, `completed`, or `failed`
- `run_started_at` and `run_completed_at`
- `data_from` and `data_to`
- `summary_json` - summary metrics extracted from the uploaded artifacts
- `chart_series_json` - optional precomputed chart data for quick visualization
- `artifacts` - array of artifact descriptors

For a normal single-algorithm result, send only `algo_version_id` or send `algo_version_ids` with one item. For combined algorithm results, send `algo_version_id` as the primary version and `algo_version_ids` with every contributing version.

When `advanced_metrics.csv` is uploaded as `stats_csv`, the frontend extracts the headline metrics used by the dashboard and result pages. For combined runs it uses the total row where `Year` and `Month` are blank, `Algo` is `combined`, and `Instrument` is `MULTI`. For a single algorithm version it uses the total row where `Year` and `Month` are blank and `Algo` matches the selected algorithm code; the instrument is not filtered. The upload flow also derives `data_from` and `data_to` from the earliest and latest matching monthly rows, using `Run Start Date` and `Run End Date` where available. The dashboard's Combined stats tab reads matching monthly and yearly rows from the attached CSV, defaulting to combined results with buttons for each linked algorithm.

A single result run can contain multiple artifacts. The upload UI supports staging multiple files at once, and it can append later uploads to a matching run when the linked versions, model, run source, and status match an existing result. API clients can also append artifacts directly with `POST /v1/training-results/{result_id}/artifacts`.

Result detail pages also expose drag-and-drop boxes for missing artifact categories, such as adding a metrics CSV to a run that already has a PNG chart, or adding a chart image to a CSV-only run.

### Artifact descriptor fields

- `artifact_type`
- `file_name`
- `s3_key`
- `content_type`
- `byte_size`
- `checksum_sha256`

## Path Hygiene

Uploaded bundles may contain machine-specific local paths. The upload pipeline must strip absolute paths and preserve only business-relevant metadata such as file name, artifact type, and object key.

The backend enforces this in two places:

- `file_name` is normalized to the final basename before persistence.
- `s3_key` must be a relative object key under `training-results/`; Windows drive paths, absolute paths, empty segments, and `..` traversal are rejected.

Local development uploads are capped by `MAX_UPLOAD_BYTES`, defaulting to 250 MB.
