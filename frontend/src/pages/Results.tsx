import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet } from "../api/client";

interface Algorithm {
  id: number;
  code: string;
  name: string;
  instrument: string;
  resolution: string;
  is_active: boolean;
}

interface AlgorithmVersion {
  id: number;
  algo_id: number;
  version_label: string;
  is_current?: boolean;
  is_active?: boolean;
  created_at?: string;
}

interface TrainingArtifact {
  id: number;
  artifact_type: string;
  file_name: string;
  byte_size?: number | null;
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
  run_source: string;
  status: string;
  created_at?: string;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  data_from?: string | null;
  data_to?: string | null;
  summary_json: Record<string, unknown>;
  artifacts: TrainingArtifact[];
}

interface VersionOption {
  id: number;
  algorithmId: number;
  algorithmCode: string;
  algorithmName: string;
  algorithmActive: boolean;
  versionLabel: string;
  isCurrent: boolean;
  isActive: boolean;
  createdAt?: string;
}

const metricPriority = [
  "total_profit",
  "sharpe_ratio",
  "profit_factor",
  "max_drawdown",
  "win_rate",
  "win_rate_trade_level",
  "total_trades",
  "objective",
];

function displayMetricKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetricValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function metricPreviewEntries(summary: Record<string, unknown>) {
  return Object.entries(summary ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort(([left], [right]) => {
      const leftIndex = metricPriority.indexOf(left);
      const rightIndex = metricPriority.indexOf(right);
      const leftScore = leftIndex === -1 ? 100 : leftIndex;
      const rightScore = rightIndex === -1 ? 100 : rightIndex;
      return leftScore - rightScore || left.localeCompare(right);
    })
    .slice(0, 3);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatBytes(value?: number | null) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function Results() {
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [runSource, setRunSource] = useState("");
  const [search, setSearch] = useState("");
  const [currentOnly, setCurrentOnly] = useState(false);
  const [combinedOnly, setCombinedOnly] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
      setIsLoadingFilters(true);
      try {
        const [activeAlgorithms, retiredAlgorithms] = await Promise.all([
          apiGet<Algorithm[]>("/v1/algorithms/?limit=500"),
          apiGet<Algorithm[]>("/v1/algorithms/retired?limit=500").catch(() => [] as Algorithm[]),
        ]);
        const algorithmData = [...activeAlgorithms, ...retiredAlgorithms].sort((left, right) => (
          Number(right.is_active) - Number(left.is_active) || left.code.localeCompare(right.code)
        ));

        const versionGroups = await Promise.all(
          algorithmData.map(async (algorithm) => {
            const versions = await apiGet<AlgorithmVersion[]>(`/v1/algorithms/${algorithm.id}/versions?include_inactive=true`);
            return versions.map((version) => ({
              id: version.id,
              algorithmId: algorithm.id,
              algorithmCode: algorithm.code,
              algorithmName: algorithm.name,
              algorithmActive: algorithm.is_active,
              versionLabel: version.version_label,
              isCurrent: Boolean(version.is_current),
              isActive: version.is_active !== false,
              createdAt: version.created_at,
            }));
          }),
        );

        if (!cancelled) {
          setAlgorithms(algorithmData);
          setVersionOptions(versionGroups.flat().sort((left, right) => (
            left.algorithmCode.localeCompare(right.algorithmCode)
            || Number(right.isCurrent) - Number(left.isCurrent)
            || Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "")
          )));
        }
      } catch (error: any) {
        if (!cancelled) setMessage(error?.message ?? "Unable to load result filters.");
      } finally {
        if (!cancelled) setIsLoadingFilters(false);
      }
    }

    loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      setIsLoadingResults(true);
      setMessage(null);
      const params = new URLSearchParams({
        skip: "0",
        limit: "500",
      });

      try {
        const data = await apiGet<TrainingResult[]>(`/v1/training-results/?${params.toString()}`);
        if (!cancelled) setResults(data);
      } catch (error: any) {
        if (!cancelled) setMessage(error?.message ?? "Unable to load results.");
      } finally {
        if (!cancelled) setIsLoadingResults(false);
      }
    }

    loadResults();
    return () => {
      cancelled = true;
    };
  }, []);

  const algorithmById = useMemo(
    () => Object.fromEntries(algorithms.map((algorithm) => [algorithm.id, algorithm])),
    [algorithms],
  );

  const versionById = useMemo(
    () => Object.fromEntries(versionOptions.map((version) => [version.id, version])),
    [versionOptions],
  );

  const filteredVersionOptions = useMemo(
    () => versionOptions.filter((version) => (
      (!selectedAlgorithmId || version.algorithmId === selectedAlgorithmId)
      && (!currentOnly || (version.isCurrent && version.isActive && version.algorithmActive))
    )),
    [currentOnly, selectedAlgorithmId, versionOptions],
  );

  const linkedVersionsFor = (result: TrainingResult): AlgorithmVersionLink[] => {
    if (result.linked_versions?.length) return result.linked_versions;
    const option = versionById[result.algo_version_id];
    return [{
      id: result.algo_version_id,
      algo_id: option?.algorithmId ?? 0,
      version_label: option?.versionLabel ?? `Version ${result.algo_version_id}`,
      is_current: option?.isCurrent ?? false,
      is_active: option?.isActive ?? true,
      algorithm_code: option?.algorithmCode,
      algorithm_name: option?.algorithmName,
      algorithm_is_active: option?.algorithmActive,
    }];
  };

  const versionLabel = (version: AlgorithmVersionLink) => {
    const option = versionById[version.id];
    if (option) return `${option.algorithmCode} / ${option.versionLabel}`;
    if (version.algorithm_code) return `${version.algorithm_code} / ${version.version_label}`;
    const algorithm = algorithmById[version.algo_id];
    if (algorithm) return `${algorithm.code} / ${version.version_label}`;
    return version.algo_id ? `Algo ${version.algo_id} / ${version.version_label}` : version.version_label;
  };

  const isCurrentActiveVersion = (version: AlgorithmVersionLink) => {
    const option = versionById[version.id];
    if (option) return option.isCurrent && option.isActive && option.algorithmActive;
    return Boolean(version.is_current) && version.is_active !== false && version.algorithm_is_active !== false;
  };

  const isInactiveVersion = (version: AlgorithmVersionLink) => {
    const option = versionById[version.id];
    if (option) return !option.isActive || !option.algorithmActive;
    return version.is_active === false || version.algorithm_is_active === false;
  };

  const resultMatchesControls = (result: TrainingResult) => {
    const linkedVersions = linkedVersionsFor(result);
    if (selectedAlgorithmId && !linkedVersions.some((version) => {
      const option = versionById[version.id];
      return (option?.algorithmId ?? version.algo_id) === selectedAlgorithmId;
    })) return false;
    if (selectedVersionId && !linkedVersions.some((version) => version.id === selectedVersionId)) return false;
    if (currentOnly && !linkedVersions.every(isCurrentActiveVersion)) return false;
    if (combinedOnly && linkedVersions.length <= 1) return false;
    if (status && result.status !== status) return false;
    if (runSource.trim() && !result.run_source.toLowerCase().includes(runSource.trim().toLowerCase())) return false;
    return true;
  };

  const resultMatchesSearch = (result: TrainingResult) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const versionText = linkedVersionsFor(result).map(versionLabel).join(" ");
    const artifactText = result.artifacts.map((artifact) => artifact.file_name).join(" ");
    return [
      `result ${result.id}`,
      String(result.id),
      result.status,
      result.run_source,
      versionText,
      artifactText,
    ].some((value) => value.toLowerCase().includes(query));
  };

  const visibleResults = results.filter(resultMatchesControls).filter(resultMatchesSearch);
  const pagedResults = visibleResults.slice(page * pageSize, (page + 1) * pageSize);
  const firstVisibleRow = visibleResults.length ? page * pageSize + 1 : 0;
  const lastVisibleRow = page * pageSize + pagedResults.length;
  const combinedCount = visibleResults.filter((result) => linkedVersionsFor(result).length > 1).length;
  const currentLinkedCount = visibleResults.filter((result) => linkedVersionsFor(result).some((version) => {
    const option = versionById[version.id];
    return isCurrentActiveVersion(version);
  })).length;
  const artifactCount = visibleResults.reduce((total, result) => total + result.artifacts.length, 0);

  const clearFilters = () => {
    setSelectedAlgorithmId(null);
    setSelectedVersionId(null);
    setStatus("");
    setRunSource("");
    setSearch("");
    setCurrentOnly(false);
    setCombinedOnly(false);
    setPage(0);
  };

  const handleAlgorithmChange = (value: string) => {
    const nextAlgorithmId = Number(value) || null;
    setSelectedAlgorithmId(nextAlgorithmId);
    setSelectedVersionId(null);
    setPage(0);
  };

  const handleCurrentOnlyChange = (checked: boolean) => {
    setCurrentOnly(checked);
    if (checked && selectedVersionId && !versionById[selectedVersionId]?.isCurrent) {
      setSelectedVersionId(null);
    }
    setPage(0);
  };

  const deleteResult = async (result: TrainingResult) => {
    const confirmed = window.confirm(`Delete Result #${result.id}?\n\nThis removes the run and its attachment records from the app.`);
    if (!confirmed) return;
    setMessage(null);
    try {
      await apiDelete(`/v1/training-results/${result.id}`);
      setResults((current) => current.filter((item) => item.id !== result.id));
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to delete result.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Results library</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Find uploaded runs</h1>
          </div>
          <Link
            to="/upload-results"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Upload result
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.7fr)_minmax(180px,0.7fr)_160px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Result ID, file, source, version"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Algorithm</span>
            <select
              value={selectedAlgorithmId ?? ""}
              onChange={(event) => handleAlgorithmChange(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              disabled={isLoadingFilters}
            >
              <option value="">All algorithms</option>
              {algorithms.map((algorithm) => (
                <option key={algorithm.id} value={algorithm.id}>
                  {algorithm.code} / {algorithm.name}{algorithm.is_active ? "" : " / retired"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Version</span>
            <select
              value={selectedVersionId ?? ""}
              onChange={(event) => {
                setSelectedVersionId(Number(event.target.value) || null);
                setPage(0);
              }}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              disabled={isLoadingFilters}
            >
              <option value="">All versions</option>
              {filteredVersionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.algorithmCode} / {version.versionLabel} / {version.isCurrent ? "current" : "prior"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Run source</span>
            <input
              value={runSource}
              onChange={(event) => {
                setRunSource(event.target.value);
                setPage(0);
              }}
              placeholder="offline_upload"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={currentOnly}
                onChange={(event) => handleCurrentOnlyChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Current versions only
            </label>
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={combinedOnly}
                onChange={(event) => {
                  setCombinedOnly(event.target.checked);
                  setPage(0);
                }}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Combined runs only
            </label>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Shown</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleResults.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Combined</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{combinedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current linked</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{currentLinkedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Artifacts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{artifactCount}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Uploaded results</h2>
            <p className="mt-1 text-sm text-slate-500">
              Page {page + 1} / {isLoadingResults ? "loading" : `${visibleResults.length} matching of ${results.length} loaded`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Rows</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {message ? (
          <p className="m-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Result</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Linked versions</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Metrics</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Files</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Data window</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingResults ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Loading results...</td>
                </tr>
              ) : pagedResults.length ? pagedResults.map((result) => {
                const linkedVersions = linkedVersionsFor(result);
                const previewMetrics = metricPreviewEntries(result.summary_json);
                const firstArtifact = result.artifacts[0];
                return (
                  <tr key={result.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/results/${result.id}`} className="text-sm font-semibold text-slate-900 hover:text-slate-600">
                        Result #{result.id}
                      </Link>
                      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{formatDateTime(result.created_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">{result.run_source}</p>
                    </td>
                    <td className="min-w-64 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {linkedVersions.slice(0, 4).map((version) => {
                          const isCurrent = isCurrentActiveVersion(version);
                          const isInactive = isInactiveVersion(version);
                          return (
                            <span
                              key={`${result.id}-${version.id}`}
                              className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                                isInactive
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : isCurrent
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }`}
                            >
                              {versionLabel(version)}{isInactive ? " / deleted" : ""}
                            </span>
                          );
                        })}
                        {linkedVersions.length > 4 ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                            +{linkedVersions.length - 4}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(result.status)}`}>
                        {result.status}
                      </span>
                      {linkedVersions.length > 1 ? (
                        <p className="mt-2 text-xs font-semibold text-indigo-700">Combined</p>
                      ) : null}
                    </td>
                    <td className="min-w-56 px-4 py-3">
                      {previewMetrics.length ? (
                        <div className="flex flex-wrap gap-2">
                          {previewMetrics.map(([key, value]) => (
                            <span key={key} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {displayMetricKey(key)}: {formatMetricValue(value)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No metrics</span>
                      )}
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <p className="truncate text-sm font-medium text-slate-900">{firstArtifact?.file_name ?? "No files"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {result.artifacts.length} file{result.artifacts.length === 1 ? "" : "s"}
                        {firstArtifact ? ` / ${formatBytes(firstArtifact.byte_size)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p>{formatDate(result.data_from)}</p>
                      <p className="mt-1">{formatDate(result.data_to)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/results/${result.id}`}
                          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteResult(result)}
                          className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No uploaded results match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing rows {firstVisibleRow}-{lastVisibleRow}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0 || isLoadingResults}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Newer
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={(page + 1) * pageSize >= visibleResults.length || isLoadingResults}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Older
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Results;
