import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiDelete, apiGet, apiPatch, apiPost } from "../api/client";
import {
  displayMetricKey,
  formatMetricValue,
  inferCsvDateRange,
  inferArtifactSummary,
  inferCsvMonthlyMetricRows,
  inferCsvSummary,
  inferCsvYearlyMetricRows,
  metricEntries as resultMetricEntries,
  type CsvDateRange,
  type MonthlyMetricRow,
  type PeriodMetricRow,
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
  comments?: string | null;
  created_at?: string;
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
  comments: string;
  status: string;
  run_date: string;
  data_from: string;
  data_to: string;
}

type ResultTab = "chart" | "stats" | "metadata";
type PeriodTableMode = "monthly" | "yearly";

const statusOptions = ["completed", "pending", "failed"];

const monthlyMetricColumns = [
  "profit_dollars",
  "number_of_trades",
  "return_on_capital_pct",
  "win_rate_pct",
  "weekly_win_rate_pct",
  "max_drawdown_pct",
  "max_drawdown_dollars",
  "maximum_positions_held",
  "annualised_return_pct",
];

const yearlyMetricColumns = [
  "profit_dollars",
  "number_of_trades",
  "return_on_capital_pct",
  "win_rate_pct",
  "monthly_win_rate_pct",
  "weekly_win_rate_pct",
  "max_drawdown_pct",
  "max_drawdown_dollars",
  "maximum_positions_held",
  "annualised_return_pct",
];

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

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
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
    comments: result.comments ?? "",
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
  const [trainingModels, setTrainingModels] = useState<TrainingModel[]>([]);
  const [metadataForm, setMetadataForm] = useState<ResultMetadataForm | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("chart");
  const [periodTableMode, setPeriodTableMode] = useState<PeriodTableMode>("monthly");
  const [monthlyAlgoFilter, setMonthlyAlgoFilter] = useState("combined");
  const [statsCsvText, setStatsCsvText] = useState<string | null>(null);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyMetricRow[]>([]);
  const [yearlyRows, setYearlyRows] = useState<PeriodMetricRow[]>([]);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isSavingDashboardResult, setIsSavingDashboardResult] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [artifactSummary, setArtifactSummary] = useState<Record<string, unknown>>({});
  const [artifactDateRange, setArtifactDateRange] = useState<CsvDateRange>({ dataFrom: null, dataTo: null });

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

  const primaryImage = result?.artifacts.find(isImageArtifact) ?? null;
  const primaryHtml = result?.artifacts.find(isHtmlArtifact) ?? null;
  const primaryArtifact = primaryImage ?? primaryHtml ?? result?.artifacts[0] ?? null;
  const linkedVersions = useMemo(
    () => result?.linked_versions?.length
      ? result.linked_versions
      : result ? [{ id: result.algo_version_id, algo_id: 0, version_label: `Version ${result.algo_version_id}` }] : [],
    [result],
  );
  const isCombinedResult = linkedVersions.length > 1;
  const linkedVersionKey = linkedVersions.map((version) => `${version.id}:${version.algorithm_code ?? ""}`).join("|");
  const metricContext = useMemo<SummaryMetricContext>(() => ({
    algoCode: isCombinedResult ? "combined" : linkedVersions[0]?.algorithm_code ?? null,
    isCombined: isCombinedResult,
  }), [isCombinedResult, linkedVersionKey, linkedVersions]);
  const statsCsvArtifact = result?.artifacts.find(isStatsCsvArtifact) ?? null;
  const metricEntries = useMemo(() => resultMetricEntries({
    ...(result?.summary_json ?? {}),
    ...artifactSummary,
  }), [artifactSummary, result?.summary_json]);
  const summaryMetricEntries = metricEntries.slice(0, 12);
  const summaryMetricRows = [
    summaryMetricEntries.slice(0, 6),
    summaryMetricEntries.slice(6, 12),
  ].filter((row) => row.length);
  const periodFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const algoOptions = linkedVersions
      .filter((version) => {
        const code = version.algorithm_code?.trim();
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((version) => ({
        key: version.algorithm_code?.trim() ?? "",
        label: version.algorithm_code ? `${version.algorithm_code} / ${version.version_label}` : version.version_label,
      }))
      .filter((option) => option.key);

    if (isCombinedResult) return [{ key: "combined", label: "Combined" }, ...algoOptions];
    return algoOptions.length ? algoOptions : [{ key: "all", label: "All rows" }];
  }, [isCombinedResult, linkedVersionKey, linkedVersions]);
  const periodMetricContext = useMemo<SummaryMetricContext>(() => {
    if (monthlyAlgoFilter === "combined") return { algoCode: "combined", isCombined: true };
    if (monthlyAlgoFilter === "all") return {};
    return { algoCode: monthlyAlgoFilter, isCombined: false };
  }, [monthlyAlgoFilter]);
  const periodRows = periodTableMode === "monthly" ? monthlyRows : yearlyRows;
  const periodMetricColumns = periodTableMode === "monthly" ? monthlyMetricColumns : yearlyMetricColumns;
  const periodLabel = periodTableMode === "monthly" ? "Monthly stats" : "Yearly stats";

  useEffect(() => {
    if (!result) return;
    setMonthlyAlgoFilter(isCombinedResult ? "combined" : linkedVersions[0]?.algorithm_code?.trim() || "all");
  }, [result?.id, isCombinedResult, linkedVersionKey, linkedVersions, result]);

  useEffect(() => {
    let cancelled = false;
    setArtifactSummary({});
    setArtifactDateRange({ dataFrom: null, dataTo: null });
    setStatsCsvText(null);
    setMonthlyRows([]);
    setYearlyRows([]);
    if (!statsCsvArtifact) return () => {
      cancelled = true;
    };

    fetch(artifactUrl(statsCsvArtifact))
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to fetch stats CSV: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setStatsCsvText(text);
          setArtifactSummary(inferCsvSummary(text, metricContext));
          setArtifactDateRange(inferCsvDateRange(text, metricContext));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtifactSummary({});
          setArtifactDateRange({ dataFrom: null, dataTo: null });
          setStatsCsvText(null);
          setMonthlyRows([]);
          setYearlyRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statsCsvArtifact?.s3_key, metricContext]);

  useEffect(() => {
    if (!statsCsvText) {
      setMonthlyRows([]);
      setYearlyRows([]);
      return;
    }
    setMonthlyRows(inferCsvMonthlyMetricRows(statsCsvText, periodMetricContext));
    setYearlyRows(inferCsvYearlyMetricRows(statsCsvText, periodMetricContext));
  }, [statsCsvText, periodMetricContext]);

  const selectedModel = result?.model_id ? trainingModels.find((model) => model.id === result.model_id) : null;
  const modelDisplayName = result?.model_id
    ? selectedModel ? `${selectedModel.name} (${selectedModel.key})` : `Model ${result.model_id}`
    : "-";
  const runDate = result?.run_started_at ?? result?.run_completed_at ?? result?.created_at ?? null;
  const commentsText = result?.comments?.trim() ?? "";
  const dataFrom = artifactDateRange.dataFrom ?? result?.data_from ?? null;
  const dataTo = artifactDateRange.dataTo ?? result?.data_to ?? null;
  const versionDisplayName = (version: AlgorithmVersionLink) => {
    if (version.algorithm_code) return `${version.algorithm_code} / ${version.version_label}`;
    if (version.algorithm_name) return `${version.algorithm_name} / ${version.version_label}`;
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
          dateRange: artifactType === "stats_csv" ? await file.text().then((text) => inferCsvDateRange(text, metricContext)).catch(() => ({ dataFrom: null, dataTo: null })) : { dataFrom: null, dataTo: null },
        };
      }));

      const appendedDateRange = artifacts.reduce<CsvDateRange>((acc, artifact) => ({
        dataFrom: [acc.dataFrom, artifact.dateRange.dataFrom]
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null,
        dataTo: [acc.dataTo, artifact.dateRange.dataTo]
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null,
      }), { dataFrom: null, dataTo: null });
      const summaryJson = artifacts.reduce((acc, artifact) => ({ ...acc, ...artifact.summary }), {});
      const updated = await apiPost<TrainingResult>(`/v1/training-results/${result.id}/artifacts`, {
        data_from: appendedDateRange.dataFrom,
        data_to: appendedDateRange.dataTo,
        summary_json: summaryJson,
        chart_series_json: {},
        artifacts: artifacts.map(({ summary, dateRange, ...artifact }) => artifact),
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
    setActiveTab("metadata");
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
        comments: metadataForm.comments.trim() || null,
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

  const renderArtifactSummary = (artifact: TrainingArtifact) => (
    <div key={artifact.id} className="rounded-md border border-slate-200 bg-white p-2">
      <p className="truncate text-sm font-medium text-slate-900">{artifact.file_name}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
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
  );

  const renderArtifactSlot = (slot: typeof artifactSlots[number]) => {
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
        className={`rounded-md border border-dashed p-3 transition ${
          isDragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{slot.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{slot.description}</p>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
            slotArtifacts.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            {slotArtifacts.length ? `${slotArtifacts.length}` : "Missing"}
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          {slotArtifacts.length ? slotArtifacts.map(renderArtifactSummary) : (
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-500">No file attached.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className={`inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50 ${
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
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link to="/results" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
              Back to results
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">Result #{resultId}</h1>
              {result ? (
                <>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(result.status)}`}>
                    {result.status}
                  </span>
                  {isCombinedResult ? (
                    <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                      {linkedVersions.length} versions
                    </span>
                  ) : null}
                  {result.is_dashboard_latest ? (
                    <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
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
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                Open artifact
              </a>
            ) : null}
            {result ? (
              <button
                type="button"
                onClick={toggleDashboardResult}
                disabled={isSavingDashboardResult}
                className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
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
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                Edit metadata
              </button>
            ) : null}
            {result ? (
              <button
                type="button"
                onClick={deleteRun}
                className="inline-flex h-8 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Delete run
              </button>
            ) : null}
          </div>
        </div>

        {result ? (
          <div className="mt-3 grid gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 sm:grid-cols-[90px_minmax(0,1fr)]">
            <p className="text-xs font-semibold uppercase text-slate-500">Comments</p>
            <p className={`whitespace-pre-wrap text-sm ${commentsText ? "text-slate-800" : "text-slate-500"}`}>
              {commentsText || "No comments captured."}
            </p>
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {([
              ["chart", "Chart"],
              ["stats", "Stats"],
              ["metadata", "Metadata"],
            ] as [ResultTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-8 rounded-md px-3 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {actionMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 shadow-sm">{actionMessage}</div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">{error}</div>
      ) : result ? (
        <>
          {activeTab === "chart" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              {primaryImage ? (
                <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-md bg-white">
                  <img
                    src={artifactUrl(primaryImage)}
                    alt={primaryImage.file_name}
                    className="block max-h-[calc(100vh-150px)] w-full object-contain"
                  />
                </div>
              ) : primaryHtml ? (
                <iframe
                  title={primaryHtml.file_name}
                  src={artifactUrl(primaryHtml)}
                  className="h-[680px] w-full rounded-md border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No visual artifact is attached to this result.
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "stats" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">Result stats</h2>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    Result #{result.id}
                  </span>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(result.status)}`}>
                    {result.status}
                  </span>
                  {isCombinedResult ? (
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                      Combined
                    </span>
                  ) : null}
                </div>
                {statsCsvArtifact ? (
                  <a
                    href={artifactUrl(statsCsvArtifact)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Open stats CSV
                  </a>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {linkedVersions.length ? linkedVersions.slice(0, 10).map((version) => (
                    <span
                      key={version.id}
                      title={versionDisplayName(version)}
                      className={`max-w-52 truncate rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        isDeletedVersion(version)
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {versionDisplayName(version)}{isDeletedVersion(version) ? " / deleted" : ""}
                    </span>
                  )) : (
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      Linked version data unavailable
                    </span>
                  )}
                  {linkedVersions.length > 10 ? (
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      +{linkedVersions.length - 10}
                    </span>
                  ) : null}
                </div>

                <div className="overflow-x-auto">
                  {summaryMetricRows.length ? (
                    <table className="w-full table-fixed border-separate" style={{ minWidth: "960px", borderSpacing: "6px" }}>
                      <tbody>
                        {summaryMetricRows.map((row, rowIndex) => (
                          <tr key={`summary-row-${rowIndex}`}>
                            {row.map(([key, value]) => (
                              <td key={key} className="w-1/6 align-top">
                                <div className="min-h-14 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                                  <p className="truncate text-[11px] font-semibold uppercase text-slate-500" title={displayMetricKey(key)}>{displayMetricKey(key)}</p>
                                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={formatMetricValue(key, value)}>{formatMetricValue(key, value)}</p>
                                </div>
                              </td>
                            ))}
                            {row.length < 6 ? Array.from({ length: 6 - row.length }).map((_, index) => (
                              <td key={`summary-empty-${rowIndex}-${index}`} className="w-1/6" />
                            )) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-500">
                      No summary metrics saved for this result.
                    </p>
                  )}
                </div>

                {statsCsvText ? (
                  <div>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{periodLabel}</h3>
                        <span className="text-xs text-slate-500">{periodRows.length} rows</span>
                        <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                          {([
                            ["monthly", "Monthly"],
                            ["yearly", "Yearly"],
                          ] as [PeriodTableMode, string][]).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setPeriodTableMode(mode)}
                              className={`h-6 rounded px-2 text-xs font-semibold transition ${
                                periodTableMode === mode
                                  ? "bg-slate-900 text-white"
                                  : "text-slate-700 hover:bg-white"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {periodFilterOptions.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setMonthlyAlgoFilter(option.key)}
                            title={option.label}
                            className={`h-7 max-w-48 truncate rounded-md border px-2 text-xs font-semibold transition ${
                              monthlyAlgoFilter === option.key
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-1.5 max-h-[420px] overflow-auto rounded-md border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="sticky top-0 bg-slate-100">
                          <tr>
                            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold text-slate-700">
                              {periodTableMode === "monthly" ? "Month" : "Year"}
                            </th>
                            {periodMetricColumns.map((key) => (
                              <th key={key} className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-slate-700">
                                {displayMetricKey(key)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {periodRows.length ? periodRows.map((row) => (
                            <tr key={row.period} className="hover:bg-slate-50">
                              <td className="whitespace-nowrap px-2 py-1 font-medium text-slate-900">{row.period}</td>
                              {periodMetricColumns.map((key) => (
                                <td key={key} className="whitespace-nowrap px-2 py-1 text-right text-slate-700">
                                  {formatMetricValue(key, row.metrics[key])}
                                </td>
                              ))}
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={periodMetricColumns.length + 1} className="px-2 py-4 text-center text-xs text-slate-500">
                                No {periodTableMode} rows found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    No stats CSV table data is available for this result.
                  </p>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "metadata" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Metadata</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{result.artifacts.length} attachment{result.artifacts.length === 1 ? "" : "s"}</p>
                </div>
                {!isEditingMetadata ? (
                  <button
                    type="button"
                    onClick={startEditingMetadata}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {isEditingMetadata && metadataForm ? (
                <form onSubmit={saveMetadata} className="mt-3 grid gap-3 lg:grid-cols-4">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Status</span>
                    <select
                      value={metadataForm.status}
                      onChange={(event) => updateMetadataField("status", event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 [color-scheme:light]"
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Training model</span>
                    <select
                      value={metadataForm.model_id}
                      onChange={(event) => updateMetadataField("model_id", event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 [color-scheme:light]"
                    >
                      <option value="">No model</option>
                      {trainingModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.key})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm lg:col-span-2">
                    <span className="font-medium text-slate-700">Source</span>
                    <input
                      value={metadataForm.run_source}
                      onChange={(event) => updateMetadataField("run_source", event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Run date</span>
                    <input
                      type="date"
                      value={metadataForm.run_date}
                      onChange={(event) => updateMetadataField("run_date", event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Data from</span>
                    <input
                      type="date"
                      value={metadataForm.data_from}
                      onChange={(event) => updateMetadataField("data_from", event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Data to</span>
                    <input
                      type="date"
                      value={metadataForm.data_to}
                      onChange={(event) => updateMetadataField("data_to", event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                    />
                  </label>

                  <label className="block text-sm lg:col-span-4">
                    <span className="font-medium text-slate-700">Comments</span>
                    <textarea
                      value={metadataForm.comments}
                      onChange={(event) => updateMetadataField("comments", event.target.value)}
                      className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 [color-scheme:light]"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2 lg:col-span-4">
                    <button
                      type="submit"
                      disabled={isSavingMetadata}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isSavingMetadata ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (result) setMetadataForm(resultToMetadataForm(result));
                        setIsEditingMetadata(false);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 xl:col-span-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Linked versions</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {linkedVersions.map((version) => (
                        <span
                          key={version.id}
                          className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            isDeletedVersion(version)
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {versionDisplayName(version)}{isDeletedVersion(version) ? " / deleted" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Model</p>
                    <p className="mt-1 font-medium text-slate-900">{modelDisplayName}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Source</p>
                    <p className="mt-1 break-words font-medium text-slate-900">{result.run_source}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Run date</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDate(runDate)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Dashboard</p>
                    <p className="mt-1 font-medium text-slate-900">{result.is_dashboard_latest ? "Yes" : "No"}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Data from</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDate(dataFrom)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Data to</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDate(dataTo)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 md:col-span-2 xl:col-span-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Comments</p>
                    <p className={`mt-1 whitespace-pre-wrap ${commentsText ? "text-slate-900" : "text-slate-500"}`}>
                      {commentsText || "-"}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-slate-200 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Files</h3>
                  <span className="text-sm text-slate-500">{result.artifacts.length} attachment{result.artifacts.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  {artifactSlots.map(renderArtifactSlot)}
                  {otherArtifacts.length ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 lg:col-span-2 xl:col-span-4">
                      <p className="text-sm font-semibold text-slate-900">Other files</p>
                      <div className="mt-3 grid gap-2">
                        {otherArtifacts.map(renderArtifactSummary)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Loading result...</p>
        </div>
      )}
    </div>
  );
}

export default ResultDetail;
