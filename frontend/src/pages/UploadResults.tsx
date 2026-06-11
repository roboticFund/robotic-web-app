import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL, apiGet, apiPost } from "../api/client";
import { displayMetricKey, formatMetricValue, inferArtifactSummary, metricEntries, type SummaryMetricContext } from "../lib/resultMetrics";

interface Algorithm {
  id: number;
  code: string;
  name: string;
}

interface AlgorithmVersion {
  id: number;
  algo_id: number;
  version_label: string;
  is_current?: boolean;
  created_at?: string;
}

interface TrainingModel {
  id: number;
  key: string;
  name: string;
}

interface TrainingArtifact {
  id: number;
  artifact_type: string;
  file_name: string;
  s3_key: string;
  content_type: string;
  byte_size?: number | null;
}

interface AlgorithmVersionLink {
  id: number;
  algo_id: number;
  version_label: string;
  is_current?: boolean;
}

interface TrainingResult {
  id: number;
  algo_version_id: number;
  algo_version_ids?: number[];
  linked_versions?: AlgorithmVersionLink[];
  model_id?: number | null;
  run_source: string;
  status: string;
  created_at?: string;
  summary_json: Record<string, unknown>;
  artifacts: TrainingArtifact[];
}

interface UploadResponse {
  object_key: string;
  upload_url: string;
  expires_in_seconds: number;
  storage_type: "local" | "s3";
}

interface VersionOption {
  id: number;
  algorithmId: number;
  algorithmCode: string;
  algorithmName: string;
  versionLabel: string;
  isCurrent: boolean;
  createdAt?: string;
}

interface PreparedFile {
  id: string;
  file: File;
  artifactType: string;
  summary: Record<string, unknown>;
}

type RunTargetMode = "auto" | "new" | "existing";

const artifactTypes = [
  { value: "stats_csv", label: "Stats CSV" },
  { value: "analysis_html", label: "Analysis HTML" },
  { value: "analysis_png", label: "Analysis PNG" },
  { value: "raw_result_csv", label: "Raw result CSV" },
  { value: "best_params_json", label: "Best params JSON" },
  { value: "other", label: "Other" },
];

const artifactLabelByValue = Object.fromEntries(artifactTypes.map((type) => [type.value, type.label]));

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

function sameNumberSet(left: number[], right: number[]) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function UploadResults() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [models, setModels] = useState<TrainingModel[]>([]);
  const [recentResults, setRecentResults] = useState<TrainingResult[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<number[]>([]);
  const [versionSearch, setVersionSearch] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [runSource, setRunSource] = useState("offline_upload");
  const [status, setStatus] = useState("completed");
  const [summaryJson, setSummaryJson] = useState("{}");
  const [preparedFiles, setPreparedFiles] = useState<PreparedFile[]>([]);
  const [runTargetMode, setRunTargetMode] = useState<RunTargetMode>("auto");
  const [selectedExistingResultId, setSelectedExistingResultId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setIsLoading(true);
      setMessage(null);
      try {
        const [algorithms, modelData, resultData] = await Promise.all([
          apiGet<Algorithm[]>("/v1/algorithms/"),
          apiGet<TrainingModel[]>("/v1/training-models/"),
          apiGet<TrainingResult[]>("/v1/training-results/?limit=500"),
        ]);

        const versionGroups = await Promise.all(
          algorithms.map(async (algorithm) => {
            const versions = await apiGet<AlgorithmVersion[]>(`/v1/algorithms/${algorithm.id}/versions`);
            return versions.map((version) => ({
              id: version.id,
              algorithmId: algorithm.id,
              algorithmCode: algorithm.code,
              algorithmName: algorithm.name,
              versionLabel: version.version_label,
              isCurrent: Boolean(version.is_current),
              createdAt: version.created_at,
            }));
          }),
        );

        const options = versionGroups
          .flat()
          .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)
            || Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
        const currentVersionIds = options.filter((option) => option.isCurrent).map((option) => option.id);

        if (!cancelled) {
          setVersionOptions(options);
          setModels(modelData);
          setRecentResults(resultData);
          setSelectedVersionIds((current) => current.length ? current : currentVersionIds.length ? currentVersionIds : options[0]?.id ? [options[0].id] : []);
        }
      } catch (error: any) {
        if (!cancelled) setMessage(error?.message ?? "Unable to load upload data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedVersions = useMemo(
    () => selectedVersionIds
      .map((versionId) => versionOptions.find((option) => option.id === versionId))
      .filter((option): option is VersionOption => Boolean(option)),
    [selectedVersionIds, versionOptions],
  );
  const primaryVersion = selectedVersions[0] ?? null;
  const selectedPriorCount = selectedVersions.filter((option) => !option.isCurrent).length;
  const isCombinedResult = selectedVersionIds.length > 1;
  const selectedVersionId = selectedVersionIds[0] ?? null;
  const metricContext = useMemo<SummaryMetricContext>(() => ({
    algoCode: isCombinedResult ? "combined" : primaryVersion?.algorithmCode ?? null,
    isCombined: isCombinedResult,
  }), [isCombinedResult, primaryVersion?.algorithmCode]);

  const versionLabelById = useMemo(
    () => Object.fromEntries(versionOptions.map((option) => [option.id, option])),
    [versionOptions],
  );

  const filteredVersionOptions = useMemo(() => {
    const query = versionSearch.trim().toLowerCase();
    if (!query) return versionOptions;
    return versionOptions.filter((option) => (
      option.algorithmCode.toLowerCase().includes(query)
      || option.algorithmName.toLowerCase().includes(query)
      || option.versionLabel.toLowerCase().includes(query)
    ));
  }, [versionOptions, versionSearch]);

  const selectedVersionSummary = useMemo(
    () => selectedVersions.length
      ? selectedVersions.map((option) => `${option.algorithmCode} / ${option.versionLabel}`).join(", ")
      : "No version selected",
    [selectedVersions],
  );

  const matchingResults = useMemo(
    () => recentResults.filter((result) => {
      const resultVersionIds = result.algo_version_ids?.length ? result.algo_version_ids : [result.algo_version_id];
      return sameNumberSet(resultVersionIds, selectedVersionIds)
        && (result.model_id ?? null) === selectedModelId
        && result.run_source === runSource
        && result.status === status;
    }),
    [recentResults, runSource, selectedModelId, selectedVersionIds, status],
  );

  const autoTargetResult = matchingResults[0] ?? null;
  const selectedExistingResult = recentResults.find((result) => result.id === selectedExistingResultId) ?? null;
  const targetResult = runTargetMode === "existing" ? selectedExistingResult : runTargetMode === "auto" ? autoTargetResult : null;

  const summaryPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(summaryJson || "{}") as Record<string, unknown>;
      return metricEntries(parsed, 9);
    } catch {
      return [];
    }
  }, [summaryJson]);

  const queuedBytes = preparedFiles.reduce((total, prepared) => total + prepared.file.size, 0);

  const resultVersionLabel = (result: TrainingResult) => {
    const linkedIds = result.algo_version_ids?.length ? result.algo_version_ids : [result.algo_version_id];
    const labels = linkedIds
      .map((versionId) => versionLabelById[versionId])
      .filter((option): option is VersionOption => Boolean(option))
      .map((option) => `${option.algorithmCode} / ${option.versionLabel}`);

    if (!labels.length && result.linked_versions?.length) {
      const linkedLabels = result.linked_versions.map((version) => version.version_label);
      if (linkedLabels.length > 2) return `${linkedLabels.slice(0, 2).join(", ")} +${linkedLabels.length - 2}`;
      return linkedLabels.join(", ");
    }
    if (labels.length > 2) return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
    if (labels.length) return labels.join(", ");
    return linkedIds.length > 1 ? `${linkedIds.length} linked versions` : `Version ${result.algo_version_id}`;
  };

  const mergeSummaryJson = (nextSummaries: Record<string, unknown>[]) => {
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(summaryJson || "{}") as Record<string, unknown>;
    } catch {
      current = {};
    }
    const merged = nextSummaries.reduce((acc, summary) => ({ ...acc, ...summary }), current);
    setSummaryJson(JSON.stringify(merged, null, 2));
  };

  const prepareFiles = async (files: File[]) => {
    setMessage(null);
    if (!files.length) return;
    const nextPrepared = await Promise.all(files.map(async (file, index) => {
      const artifactType = inferArtifactType(file);
      let summary: Record<string, unknown> = {};
      try {
        summary = await inferArtifactSummary(file, artifactType, metricContext);
      } catch {
        summary = {};
      }
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`,
        file,
        artifactType,
        summary,
      };
    }));
    setPreparedFiles((current) => [...current, ...nextPrepared]);
    mergeSummaryJson(nextPrepared.map((prepared) => prepared.summary));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    prepareFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    prepareFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removePreparedFile = (fileId: string) => {
    setPreparedFiles((current) => current.filter((prepared) => prepared.id !== fileId));
  };

  const updatePreparedFileType = (fileId: string, artifactType: string) => {
    setPreparedFiles((current) => current.map((prepared) => (
      prepared.id === fileId ? { ...prepared, artifactType } : prepared
    )));
  };

  const toggleVersion = (versionId: number) => {
    setSelectedVersionIds((current) => (
      current.includes(versionId)
        ? current.filter((id) => id !== versionId)
        : [...current, versionId]
    ));
  };

  const setSelectedVersionId = (versionId: number | null) => {
    setSelectedVersionIds(versionId ? [versionId] : []);
  };

  const selectCurrentVersions = () => {
    const currentIds = versionOptions.filter((option) => option.isCurrent).map((option) => option.id);
    if (currentIds.length) setSelectedVersionIds(currentIds);
  };

  const selectAllVersions = () => {
    setSelectedVersionIds(versionOptions.map((option) => option.id));
  };

  const clearToPrimaryVersion = () => {
    if (primaryVersion) setSelectedVersionIds([primaryVersion.id]);
  };

  const uploadPreparedFile = async (prepared: PreparedFile) => {
    const contentType = contentTypeFor(prepared.file, prepared.artifactType);
    const uploadData = await apiPost<UploadResponse>("/v1/training-results/uploads", {
      file_name: prepared.file.name,
      artifact_type: prepared.artifactType,
      content_type: contentType,
      byte_size: prepared.file.size,
    });
    const uploadUrl = uploadData.upload_url.startsWith("/")
      ? `${API_BASE_URL}${uploadData.upload_url}`
      : uploadData.upload_url;
    const checksumSha256 = await calculateSha256(prepared.file);
    const uploadResult = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      credentials: uploadData.storage_type === "local" ? "include" : "omit",
      body: prepared.file,
    });
    if (!uploadResult.ok) throw new Error(`Artifact upload failed: ${uploadResult.status}`);
    return {
      artifact_type: prepared.artifactType,
      file_name: prepared.file.name,
      s3_key: uploadData.object_key,
      content_type: contentType,
      byte_size: prepared.file.size,
      checksum_sha256: checksumSha256,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preparedFiles.length || !selectedVersionIds.length) {
      setMessage("Choose at least one file and at least one algorithm version.");
      return;
    }

    let summary: Record<string, unknown> = {};
    try {
      summary = summaryJson ? JSON.parse(summaryJson) : {};
    } catch {
      setMessage("Summary JSON is invalid.");
      setShowAdvanced(true);
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const artifacts = await Promise.all(preparedFiles.map(uploadPreparedFile));
      const result = targetResult
        ? await apiPost<TrainingResult>(`/v1/training-results/${targetResult.id}/artifacts`, {
          summary_json: summary,
          chart_series_json: {},
          artifacts,
        })
        : await apiPost<TrainingResult>("/v1/training-results/", {
          algo_version_id: selectedVersionIds[0],
          algo_version_ids: selectedVersionIds,
          model_id: selectedModelId,
          run_source: runSource,
          status,
          summary_json: summary,
          chart_series_json: {},
          artifacts,
        });

      navigate(`/results/${result.id}`);
    } catch (error: any) {
      setMessage(error?.message ?? "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Results intake</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Upload result artifacts</h1>
          </div>
          {selectedVersions.length ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span className="font-semibold">{isCombinedResult ? "Combined result" : "Single result"}</span>
              <span className="mx-2 text-emerald-500">/</span>
              <span>
                {isCombinedResult
                  ? `${selectedVersions.length} versions linked${selectedPriorCount ? ` (${selectedPriorCount} prior)` : " (current only)"}`
                  : selectedVersionSummary}
              </span>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex min-h-72 cursor-pointer flex-col justify-center rounded-xl border border-dashed p-6 transition ${
                isDragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
              <div>
                <p className="text-lg font-semibold text-slate-900">Drop one or more result files here</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  CSV, JSON, HTML, and chart images are detected individually and saved against one result run.
                </p>
                {preparedFiles.length ? (
                  <div className="mt-5 grid gap-3">
                    {preparedFiles.map((prepared) => (
                      <div key={prepared.id} onClick={(event) => event.stopPropagation()} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{prepared.file.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatBytes(prepared.file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePreparedFile(prepared.id)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        </div>
                        <select
                          value={prepared.artifactType}
                          onChange={(event) => updatePreparedFileType(prepared.id, event.target.value)}
                          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        >
                          {artifactTypes.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid content-start gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Primary version</span>
                <select
                  value={selectedVersionId ?? ""}
                  onChange={(event) => setSelectedVersionId(Number(event.target.value) || null)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  required
                  disabled={isLoading}
                >
                  <option value="">{isLoading ? "Loading..." : "Select a version"}</option>
                  {versionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.algorithmCode} / {option.versionLabel}{option.isCurrent ? " / current" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">Combined links</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    isCombinedResult ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {selectedVersionIds.length} linked
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Defaults to current versions. Use all versions only when a combined run includes prior releases.
                </p>

                <input
                  value={versionSearch}
                  onChange={(event) => setVersionSearch(event.target.value)}
                  placeholder="Search current or prior versions"
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  disabled={isLoading}
                />

                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={selectCurrentVersions} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    All current
                  </button>
                  <button type="button" onClick={selectAllVersions} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    All versions
                  </button>
                  {isCombinedResult ? (
                    <button type="button" onClick={clearToPrimaryVersion} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Primary only
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {filteredVersionOptions.length ? filteredVersionOptions.map((option) => {
                    const checked = selectedVersionIds.includes(option.id);
                    return (
                      <label key={option.id} className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 ${checked ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleVersion(option.id)} className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{option.algorithmCode} / {option.versionLabel}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{option.algorithmName} / {option.isCurrent ? "current" : "prior"}</span>
                        </span>
                      </label>
                    );
                  }) : (
                    <p className="p-3 text-sm text-slate-500">No matching versions.</p>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Training model</span>
                <select
                  value={selectedModelId ?? ""}
                  onChange={(event) => setSelectedModelId(Number(event.target.value) || null)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="">No model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.key} / {model.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Result run target</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Auto links files to the latest matching run by versions, model, source, and status.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {preparedFiles.length} file{preparedFiles.length === 1 ? "" : "s"} / {formatBytes(queuedBytes)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["auto", "new", "existing"] as RunTargetMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRunTargetMode(mode)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    runTargetMode === mode
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {mode === "auto" ? "Auto" : mode === "new" ? "New run" : "Existing run"}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {runTargetMode === "auto" ? (
                autoTargetResult ? (
                  <span>Auto will add these files to Result #{autoTargetResult.id} with {autoTargetResult.artifacts.length} existing artifact{autoTargetResult.artifacts.length === 1 ? "" : "s"}.</span>
                ) : (
                  <span>Auto will create a new result run because no matching run was found.</span>
                )
              ) : runTargetMode === "new" ? (
                <span>A new result run will be created with all staged files.</span>
              ) : (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Choose result run</span>
                  <select
                    value={selectedExistingResultId ?? ""}
                    onChange={(event) => setSelectedExistingResultId(Number(event.target.value) || null)}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    <option value="">Select an existing result</option>
                    {matchingResults.map((result) => (
                      <option key={result.id} value={result.id}>
                        Result #{result.id} / {result.artifacts.length} artifacts / {result.created_at ? new Date(result.created_at).toLocaleString() : "unknown date"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>

          {summaryPreview.length ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {summaryPreview.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{displayMetricKey(key)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMetricValue(key, value)}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white">
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
              <span>Advanced metadata</span>
              <span className="text-slate-500">{showAdvanced ? "Hide" : "Show"}</span>
            </button>
            {showAdvanced ? (
              <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Run source</span>
                  <input value={runSource} onChange={(event) => setRunSource(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none">
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label className="block lg:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Summary JSON</span>
                  <textarea value={summaryJson} onChange={(event) => setSummaryJson(event.target.value)} className="mt-2 min-h-36 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isUploading || !selectedVersionIds.length || !preparedFiles.length || (runTargetMode === "existing" && !selectedExistingResultId)}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {isUploading
              ? "Uploading..."
              : targetResult
                ? `Add ${preparedFiles.length || ""} file${preparedFiles.length === 1 ? "" : "s"} to Result #${targetResult.id}`
                : isCombinedResult
                  ? "Create combined result run"
                  : "Create result run"}
          </button>
        </form>

        {message ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p> : null}
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent results</h2>
          <Link to="/results" className="text-sm font-semibold text-slate-600 hover:text-slate-900">View all</Link>
        </div>

        <div className="mt-4 grid gap-3">
          {recentResults.length ? recentResults.slice(0, 10).map((result) => {
            const firstArtifact = result.artifacts[0];
            return (
              <Link key={result.id} to={`/results/${result.id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Result #{result.id}</p>
                    <p className="mt-1 text-xs text-slate-500">{resultVersionLabel(result)}</p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">{result.artifacts.length} files</span>
                </div>
                {firstArtifact ? <p className="mt-3 truncate text-xs text-slate-500">{firstArtifact.file_name}</p> : null}
              </Link>
            );
          }) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No uploaded results yet.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default UploadResults;
