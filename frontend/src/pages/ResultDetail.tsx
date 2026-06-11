import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiDelete, apiGet, apiPatch, apiPost } from "../api/client";
import {
  displayMetricKey,
  formatMetricValue,
  inferArtifactSummary,
  inferCsvSummary,
  metricEntries as resultMetricEntries,
  metricPreviewEntries,
  type SummaryMetricContext,
} from "../lib/resultMetrics";

interface TrainingArtifact {
  id: number;
  artifact_type: string;
  file_name: string;
  s3_key: string;
  content_type: string;
  byte_size?: number | null;
}

interface UploadResponse {
  object_key: string;
  upload_url: string;
  expires_in_seconds: number;
  storage_type: "local" | "s3";
}

interface Algorithm {
  id: number;
  code: string;
  name: string;
}

interface TrainingModel {
  id: number;
  key: string;
  name: string;
  is_active?: boolean;
}

interface AlgorithmVersionLink {
  id: number;
  algo_id: number;
  version_label: string;
  is_current?: boolean;
  is_active?: boolean;
  algorithm_code?: string | null;
  algorithm_name?: string | null;
  algorithm_is_active?: boolean | null;
}

interface TrainingResult {
  id: number;
  algo_version_id: number;
  algo_version_ids?: number[];
  linked_versions?: AlgorithmVersionLink[];
  model_id?: number | null;
  status: string;
  run_source: string;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  data_from?: string | null;
  data_to?: string | null;
  summary_json: Record<string, unknown>;
  chart_series_json?: Record<string, unknown>;
  is_dashboard_latest?: boolean;
  artifacts: TrainingArtifact[];
}

interface ResultMetadataForm {
  model_id: string;
  run_source: string;
  status: string;
  run_date: string;
  data_from: string;
  data_to: string;
}

const statusOptions = ["completed", "pending", "failed"];

const artifactSlots = [
  {
    key: "csv",
    title: "CSV metrics",
    description: "Stats, summary, or raw result CSV",
    types: ["stats_csv", "raw_result_csv"],
    defaultType: "stats_csv",
    accept: ".csv,text/csv",
  },
  {
    key: "image",
    title: "Chart image",
    description: "PNG, JPG, or WebP analysis image",
    types: ["analysis_png"],
    defaultType: "analysis_png",
    accept: "image/png,image/jpeg,image/webp",
  },
  {
    key: "html",
    title: "HTML report",
    description: "Interactive analysis report",
    types: ["analysis_html"],
    defaultType: "analysis_html",
    accept: ".html,.htm,text/html",
  },
  {
    key: "json",
    title: "Best params JSON",
    description: "Best trial parameters or run metadata",
    types: ["best_params_json"],
    defaultType: "best_params_json",
    accept: ".json,application/json",
  },
];

const managedArtifactTypes = artifactSlots.flatMap((slot) => slot.types);

function artifactUrl(artifact: TrainingArtifact) {
  const encodedKey = artifact.s3_key.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE_URL}/v1/training-results/artifacts/${encodedKey}`;
}

function isImageArtifact(artifact: TrainingArtifact) {
  return artifact.content_type.startsWith("image/") || artifact.artifact_type === "analysis_png";
}

function isHtmlArtifact(artifact: TrainingArtifact) {
  return artifact.content_type.includes("html") || artifact.artifact_type === "analysis_html";
}

function isStatsCsvArtifact(artifact: TrainingArtifact) {
  return artifact.artifact_type === "stats_csv" || artifact.file_name.toLowerCase().includes("advanced_metrics");
}

function inferArtifactType(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name)) return "analysis_png";
  if (type.includes("html") || name.endsWith(".html") || name.endsWith(".htm")) return "analysis_html";
  if (type.includes("json") || name.includes("best_params") || name.endsWith(".json")) return "best_params_json";
  if (name.includes("stats") || name.includes("summary") || name.includes("advanced_metrics")) return "stats_csv";
  if (type.includes("csv") || name.endsWith(".csv")) return "raw_result_csv";
  return "other";
}

function contentTypeFor(file: File, artifactType: string) {
  if (file.type) return file.type;
  if (artifactType === "stats_csv" || artifactType === "raw_result_csv") return "text/csv";
  if (artifactType === "best_params_json") return "application/json";
  if (artifactType === "analysis_html") return "text/html";
  if (artifactType === "analysis_png") return "image/png";
  return "application/octet-stream";
}

async function calculateSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatBytes(value?: number | null) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function dateInputToIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function resultToMetadataForm(result: TrainingResult): ResultMetadataForm {
  return {
    model_id: result.model_id ? String(result.model_id) : "",
    run_source: result.run_source,
    status: result.status,
    run_date: toDateInput(result.run_started_at ?? result.run_completed_at),
    data_from: toDateInput(result.data_from),
    data_to: toDateInput(result.data_to),
  };
}

function ResultDetail() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [relatedResultsByVersion, setRelatedResultsByVersion] = useState<Record<number, TrainingResult[]>>({});
  const [algorithmLabels, setAlgorithmLabels] = useState<Record<number, Algorithm>>({});
  const [trainingModels, setTrainingModels] = useState<TrainingModel[]>([]);
  const [metadataForm, setMetadataForm] = useState<ResultMetadataForm | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isSavingDashboardResult, setIsSavingDashboardResult] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [artifactSummary, setArtifactSummary] = useState<Record<string, unknown>>({});

  const loadResult = useCallback(() => {
    if (!resultId) return;
    setError(null);
    apiGet<TrainingResult>(`/v1/training-results/${resultId}`)
      .then((data) => setResult(data))
      .catch((err) => setError(err.message));
  }, [resultId]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  useEffect(() => {
    let cancelled = false;
    apiGet<TrainingModel[]>("/v1/training-models/?limit=500")
      .then((models) => {
        if (!cancelled) setTrainingModels(models);
      })
      .catch(() => {
        if (!cancelled) setTrainingModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!result) {
      setMetadataForm(null);
      return;
    }
    if (!isEditingMetadata) {
      setMetadataForm(resultToMetadataForm(result));
    }
  }, [isEditingMetadata, result]);

  useEffect(() => {
    if (!result) {
      setRelatedResultsByVersion({});
      setAlgorithmLabels({});
      setIsLoadingRelated(false);
      return;
    }

    const versionsForContext = result.linked_versions?.length
      ? result.linked_versions
      : [{ id: result.algo_version_id, algo_id: 0, version_label: `Version ${result.algo_version_id}` }];
    let cancelled = false;

    async function loadRelatedContext() {
      setIsLoadingRelated(true);
      const uniqueAlgoIds = Array.from(new Set(versionsForContext.map((version) => version.algo_id).filter((id) => id > 0)));

      const [versionEntries, algorithms] = await Promise.all([
        Promise.all(
          versionsForContext.map(async (version) => {
            try {
              const results = await apiGet<TrainingResult[]>(`/v1/training-results/version/${version.id}`);
              return [version.id, results] as const;
            } catch {
              return [version.id, []] as const;
            }
          }),
        ),
        Promise.all(
          uniqueAlgoIds.map(async (algoId) => {
            try {
              return await apiGet<Algorithm>(`/v1/algorithms/${algoId}`);
            } catch {
              return null;
            }
          }),
        ),
      ]);

      if (!cancelled) {
        setRelatedResultsByVersion(Object.fromEntries(versionEntries));
        setAlgorithmLabels(Object.fromEntries(algorithms.filter((algorithm): algorithm is Algorithm => Boolean(algorithm)).map((algorithm) => [algorithm.id, algorithm])));
        setIsLoadingRelated(false);
      }
    }

    loadRelatedContext();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const primaryImage = result?.artifacts.find(isImageArtifact) ?? null;
  const primaryHtml = result?.artifacts.find(isHtmlArtifact) ?? null;
  const primaryArtifact = primaryImage ?? primaryHtml ?? result?.artifacts[0] ?? null;
  const linkedVersions = result?.linked_versions?.length
    ? result.linked_versions
    : result ? [{ id: result.algo_version_id, algo_id: 0, version_label: `Version ${result.algo_version_id}` }] : [];
  const isCombinedResult = linkedVersions.length > 1;
  const metricContext = useMemo<SummaryMetricContext>(() => ({
    algoCode: isCombinedResult ? "combined" : linkedVersions[0]?.algorithm_code ?? null,
    isCombined: isCombinedResult,
  }), [isCombinedResult, linkedVersions]);
  const statsCsvArtifact = result?.artifacts.find(isStatsCsvArtifact) ?? null;
  const metricEntries = useMemo(() => resultMetricEntries({
    ...(result?.summary_json ?? {}),
    ...artifactSummary,
  }), [artifactSummary, result?.summary_json]);

  useEffect(() => {
    let cancelled = false;
    setArtifactSummary({});
    if (!statsCsvArtifact) return () => {
      cancelled = true;
    };

    fetch(artifactUrl(statsCsvArtifact))
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to fetch stats CSV: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setArtifactSummary(inferCsvSummary(text, metricContext));
      })
      .catch(() => {
        if (!cancelled) setArtifactSummary({});
      });

    return () => {
      cancelled = true;
    };
  }, [statsCsvArtifact?.s3_key, metricContext.algoCode, metricContext.isCombined]);
  const selectedModel = result?.model_id ? trainingModels.find((model) => model.id === result.model_id) : null;
  const modelDisplayName = result?.model_id
    ? selectedModel ? `${selectedModel.name} (${selectedModel.key})` : `Model ${result.model_id}`
    : "-";
  const runDate = result?.run_started_at ?? result?.run_completed_at ?? null;
  const versionDisplayName = (version: AlgorithmVersionLink) => {
    if (version.algorithm_code) return `${version.algorithm_code} / ${version.version_label}`;
    const algorithm = algorithmLabels[version.algo_id];
    if (algorithm) return `${algorithm.code} / ${version.version_label}`;
    return version.algo_id ? `Algo ${version.algo_id} / ${version.version_label}` : version.version_label;
  };
  const isDeletedVersion = (version: AlgorithmVersionLink) => version.is_active === false || version.algorithm_is_active === false;
  const artifactsBySlot = (slotTypes: string[]) => result?.artifacts.filter((artifact) => slotTypes.includes(artifact.artifact_type)) ?? [];
  const otherArtifacts = result?.artifacts.filter((artifact) => !managedArtifactTypes.includes(artifact.artifact_type)) ?? [];

  const appendFilesToResult = async (files: File[], slot: typeof artifactSlots[number]) => {
    if (!result || !files.length) return;
    setUploadingSlot(slot.key);
    setActionMessage(null);
    setError(null);

    try {
      const artifacts = await Promise.all(files.map(async (file) => {
        const inferredType = inferArtifactType(file);
        const artifactType = slot.types.includes(inferredType) ? inferredType : slot.defaultType;
        const contentType = contentTypeFor(file, artifactType);
        const uploadData = await apiPost<UploadResponse>("/v1/training-results/uploads", {
          file_name: file.name,
          artifact_type: artifactType,
          content_type: contentType,
          byte_size: file.size,
        });
        const uploadUrl = uploadData.upload_url.startsWith("/")
          ? `${API_BASE_URL}${uploadData.upload_url}`
          : uploadData.upload_url;
        const checksumSha256 = await calculateSha256(file);
        const uploadResult = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          credentials: uploadData.storage_type === "local" ? "include" : "omit",
          body: file,
        });
        if (!uploadResult.ok) throw new Error(`Artifact upload failed: ${uploadResult.status}`);
        return {
          artifact_type: artifactType,
          file_name: file.name,
          s3_key: uploadData.object_key,
          content_type: contentType,
          byte_size: file.size,
          checksum_sha256: checksumSha256,
          summary: await inferArtifactSummary(file, artifactType, metricContext).catch(() => ({})),
        };
      }));

      const summaryJson = artifacts.reduce((acc, artifact) => ({ ...acc, ...artifact.summary }), {});
      const updated = await apiPost<TrainingResult>(`/v1/training-results/${result.id}/artifacts`, {
        summary_json: summaryJson,
        chart_series_json: {},
        artifacts: artifacts.map(({ summary, ...artifact }) => artifact),
      });
      setResult(updated);
      setActionMessage(`${files.length} file${files.length === 1 ? "" : "s"} added to Result #${updated.id}.`);
    } catch (err: any) {
      const message = String(err?.message ?? "Upload failed.");
      setError(message.includes("405")
        ? "The backend needs to be restarted so it can load the artifact-append endpoint."
        : message);
    } finally {
      setUploadingSlot(null);
      setDraggingSlot(null);
    }
  };

  const deleteArtifact = async (artifact: TrainingArtifact) => {
    if (!result) return;
    const confirmed = window.confirm(`Delete attachment "${artifact.file_name}" from Result #${result.id}?`);
    if (!confirmed) return;
    setActionMessage(null);
    setError(null);
    try {
      const updated = await apiDelete<TrainingResult>(`/v1/training-results/${result.id}/artifacts/${artifact.id}`);
      setResult(updated);
      setActionMessage(`Attachment "${artifact.file_name}" deleted.`);
    } catch (err: any) {
      setError(err?.message ?? "Unable to delete attachment.");
    }
  };

  const deleteRun = async () => {
    if (!result) return;
    const confirmed = window.confirm(`Delete Result #${result.id}?\n\nThis removes the run and its attachment records from the app.`);
    if (!confirmed) return;
    setError(null);
    try {
      await apiDelete(`/v1/training-results/${result.id}`);
      navigate("/results");
    } catch (err: any) {
      setError(err?.message ?? "Unable to delete result.");
    }
  };

  const toggleDashboardResult = async () => {
    if (!result) return;
    setIsSavingDashboardResult(true);
    setActionMessage(null);
    setError(null);
    try {
      const updated = result.is_dashboard_latest
        ? await apiDelete<TrainingResult>(`/v1/training-results/${result.id}/dashboard-latest`)
        : await apiPost<TrainingResult>(`/v1/training-results/${result.id}/dashboard-latest`, {});
      setResult(updated);
      setActionMessage(updated.is_dashboard_latest
        ? `Result #${updated.id} will appear on the dashboard.`
        : `Result #${updated.id} removed from the dashboard.`);
    } catch (err: any) {
      setError(err?.message ?? "Unable to update dashboard result.");
    } finally {
      setIsSavingDashboardResult(false);
    }
  };

  const startEditingMetadata = () => {
    if (!result) return;
    setMetadataForm(resultToMetadataForm(result));
    setIsEditingMetadata(true);
    setActionMessage(null);
    setError(null);
  };

  const updateMetadataField = (field: keyof ResultMetadataForm, value: string) => {
    setMetadataForm((current) => current ? { ...current, [field]: value } : current);
  };

  const saveMetadata = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!result || !metadataForm) return;

    setIsSavingMetadata(true);
    setActionMessage(null);
    setError(null);

    try {
      if (!metadataForm.run_source.trim()) {
        throw new Error("Source is required.");
      }

      const updated = await apiPatch<TrainingResult>(`/v1/training-results/${result.id}`, {
        model_id: metadataForm.model_id ? Number(metadataForm.model_id) : null,
        run_source: metadataForm.run_source.trim(),
        status: metadataForm.status,
        run_started_at: dateInputToIso(metadataForm.run_date),
        run_completed_at: null,
        data_from: dateInputToIso(metadataForm.data_from),
        data_to: dateInputToIso(metadataForm.data_to),
      });

      setResult(updated);
      setMetadataForm(resultToMetadataForm(updated));
      setIsEditingMetadata(false);
      setActionMessage(`Result #${updated.id} metadata updated.`);
    } catch (err: any) {
      setError(err?.message ?? "Unable to update result metadata.");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/results" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
            Back to results
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Result #{resultId}</h1>
            {result ? (
              <>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                result.status === "completed"
                  ? "bg-emerald-100 text-emerald-700"
                  : result.status === "failed"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
              }`}>
                {result.status}
              </span>
              {isCombinedResult ? (
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {linkedVersions.length} versions
                </span>
              ) : null}
              {result.is_dashboard_latest ? (
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Dashboard
                </span>
              ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryArtifact ? (
            <a
              href={artifactUrl(primaryArtifact)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Open primary artifact
            </a>
          ) : null}
          {result ? (
            <button
              type="button"
              onClick={toggleDashboardResult}
              disabled={isSavingDashboardResult}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
                result.is_dashboard_latest
                  ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-700"
                  : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              }`}
            >
              {isSavingDashboardResult
                ? "Saving..."
                : result.is_dashboard_latest
                  ? "On dashboard"
                  : "Show on dashboard"}
            </button>
          ) : null}
          {result ? (
            <button
              type="button"
              onClick={startEditingMetadata}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Edit metadata
            </button>
          ) : null}
          {result ? (
            <button
              type="button"
              onClick={deleteRun}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Delete run
            </button>
          ) : null}
        </div>
      </div>

      {actionMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">{actionMessage}</div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">{error}</div>
      ) : result ? (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Visualization</h2>
              </div>
              {primaryImage ? (
                <div className="bg-white">
                  <img
                    src={artifactUrl(primaryImage)}
                    alt={primaryImage.file_name}
                    className="block h-auto w-full bg-white"
                  />
                </div>
              ) : primaryHtml ? (
                <iframe
                  title={primaryHtml.file_name}
                  src={artifactUrl(primaryHtml)}
                  className="h-[680px] w-full border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="p-8">
                  <p className="text-sm text-slate-500">No visual artifact is attached to this result.</p>
                </div>
              )}
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-stretch">
            <section className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Metrics</h2>
              {metricEntries.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {metricEntries.slice(0, 12).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{displayMetricKey(key)}</p>
                      <p className="mt-2 break-words text-lg font-semibold text-slate-900">{formatMetricValue(key, value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No summary metrics were saved for this result.</p>
              )}
            </section>

            <section className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Run details</h2>
                {!isEditingMetadata ? (
                  <button
                    type="button"
                    onClick={startEditingMetadata}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {isEditingMetadata && metadataForm ? (
                <form onSubmit={saveMetadata} className="mt-4 space-y-4">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Status</span>
                    <select
                      value={metadataForm.status}
                      onChange={(event) => updateMetadataField("status", event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 [color-scheme:light]"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Training model</span>
                    <select
                      value={metadataForm.model_id}
                      onChange={(event) => updateMetadataField("model_id", event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 [color-scheme:light]"
                    >
                      <option value="">No model</option>
                      {trainingModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.key})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Source</span>
                    <input
                      value={metadataForm.run_source}
                      onChange={(event) => updateMetadataField("run_source", event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Run date</span>
                      <input
                        type="date"
                        value={metadataForm.run_date}
                        onChange={(event) => updateMetadataField("run_date", event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Data from</span>
                      <input
                        type="date"
                        value={metadataForm.data_from}
                        onChange={(event) => updateMetadataField("data_from", event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Data to</span>
                      <input
                        type="date"
                        value={metadataForm.data_to}
                        onChange={(event) => updateMetadataField("data_to", event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={isSavingMetadata}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isSavingMetadata ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (result) setMetadataForm(resultToMetadataForm(result));
                        setIsEditingMetadata(false);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 grid gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Linked versions</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {linkedVersions.map((version) => (
                        <span
                          key={version.id}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            isDeletedVersion(version)
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {versionDisplayName(version)}{isDeletedVersion(version) ? " / deleted" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Model</span><span className="text-right font-medium text-slate-900">{modelDisplayName}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Source</span><span className="font-medium text-slate-900">{result.run_source}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Dashboard</span><span className="font-medium text-slate-900">{result.is_dashboard_latest ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Run date</span><span className="font-medium text-slate-900">{runDate ? new Date(runDate).toLocaleDateString() : "-"}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Data from</span><span className="font-medium text-slate-900">{result.data_from ? new Date(result.data_from).toLocaleDateString() : "-"}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Data to</span><span className="font-medium text-slate-900">{result.data_to ? new Date(result.data_to).toLocaleDateString() : "-"}</span></div>
                </div>
              )}
            </section>
          </div>

          {isCombinedResult ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Linked algorithm results</h2>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {linkedVersions.length} versions
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {linkedVersions.map((version) => {
                  const relatedResults = relatedResultsByVersion[version.id] ?? [];
                  return (
                    <article key={version.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{versionDisplayName(version)}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {isDeletedVersion(version) ? "Deleted version" : version.is_current ? "Current version" : "Prior version"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                          {relatedResults.length} result{relatedResults.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {isLoadingRelated && !relatedResults.length ? (
                          <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">Loading results...</p>
                        ) : relatedResults.length ? (
                          relatedResults.slice(0, 4).map((relatedResult) => {
                            const previewMetrics = metricPreviewEntries(relatedResult.summary_json);
                            const isCurrentResult = relatedResult.id === result.id;
                            return (
                              <Link
                                key={relatedResult.id}
                                to={`/results/${relatedResult.id}`}
                                className={`rounded-lg border px-3 py-2 transition ${
                                  isCurrentResult
                                    ? "border-indigo-200 bg-white"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-semibold text-slate-900">Result #{relatedResult.id}</span>
                                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    isCurrentResult ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {isCurrentResult ? "This run" : relatedResult.status}
                                  </span>
                                </div>
                                {previewMetrics.length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {previewMetrics.map(([key, value]) => (
                                      <span key={key} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        {displayMetricKey(key)}: {formatMetricValue(key, value)}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </Link>
                            );
                          })
                        ) : (
                          <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">No saved results for this version.</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Files</h2>
                <span className="text-sm text-slate-500">{result.artifacts.length} attachment{result.artifacts.length === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                {artifactSlots.map((slot) => {
                  const slotArtifacts = artifactsBySlot(slot.types);
                  const isDragging = draggingSlot === slot.key;
                  const isUploading = uploadingSlot === slot.key;
                  return (
                    <div
                      key={slot.key}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDraggingSlot(slot.key);
                      }}
                      onDragLeave={() => setDraggingSlot(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        appendFilesToResult(Array.from(event.dataTransfer.files ?? []), slot);
                      }}
                      className={`rounded-lg border border-dashed p-4 transition ${
                        isDragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{slot.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{slot.description}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                          slotArtifacts.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {slotArtifacts.length ? `${slotArtifacts.length}` : "Missing"}
                        </span>
                      </div>

                      {slotArtifacts.length ? (
                        <div className="mt-3 grid gap-2">
                          {slotArtifacts.map((artifact) => (
                            <div key={artifact.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="truncate text-sm font-medium text-slate-900">{artifact.file_name}</p>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-slate-500">{artifact.artifact_type} | {formatBytes(artifact.byte_size)}</span>
                                <span className="flex gap-3 text-sm">
                                  <a
                                    href={artifactUrl(artifact)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-slate-900 hover:text-slate-600"
                                  >
                                    Open
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => deleteArtifact(artifact)}
                                    className="font-semibold text-rose-700 hover:text-rose-600"
                                  >
                                    Delete
                                  </button>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-500">No file attached.</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 ${
                          isUploading ? "cursor-wait opacity-70" : ""
                        }`}>
                          <input
                            type="file"
                            multiple
                            accept={slot.accept}
                            disabled={isUploading}
                            onChange={(event) => {
                              appendFilesToResult(Array.from(event.target.files ?? []), slot);
                              event.target.value = "";
                            }}
                            className="hidden"
                          />
                          {isUploading ? "Uploading..." : "Add files"}
                        </label>
                        <span className="text-xs text-slate-500">or drop here</span>
                      </div>
                    </div>
                  );
                })}

                {otherArtifacts.length ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2 xl:col-span-4">
                    <p className="text-sm font-semibold text-slate-900">Other files</p>
                    <div className="mt-3 grid gap-2">
                      {otherArtifacts.map((artifact) => (
                        <div key={artifact.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="truncate text-sm font-medium text-slate-900">{artifact.file_name}</p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-slate-500">{artifact.artifact_type} | {formatBytes(artifact.byte_size)}</span>
                            <span className="flex gap-3 text-sm">
                              <a
                                href={artifactUrl(artifact)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-slate-900 hover:text-slate-600"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                onClick={() => deleteArtifact(artifact)}
                                className="font-semibold text-rose-700 hover:text-rose-600"
                              >
                                Delete
                              </button>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Loading result...</p>
        </div>
      )}
    </div>
  );
}

export default ResultDetail;
