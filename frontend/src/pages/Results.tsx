import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api/client";
import { displayMetricKey, formatMetricValue, metricPreviewEntries } from "../lib/resultMetrics";

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
  comments?: string | null;
  status: string;
  created_at?: string;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  data_from?: string | null;
  data_to?: string | null;
  summary_json: Record<string, unknown>;
  is_dashboard_latest?: boolean;
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

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
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

function Results() {
  const [searchParams] = useSearchParams();
  const requestedAlgorithmId = Number(searchParams.get("algo_id"));
  const requestedVersionId = Number(searchParams.get("algo_version_id"));
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState<number | null>(
    Number.isInteger(requestedAlgorithmId) && requestedAlgorithmId > 0 ? requestedAlgorithmId : null,
  );
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    Number.isInteger(requestedVersionId) && requestedVersionId > 0 ? requestedVersionId : null,
  );
  const [status, setStatus] = useState("");
  const [runSource, setRunSource] = useState("");
  const [search, setSearch] = useState("");
  const [currentOnly, setCurrentOnly] = useState(false);
  const [combinedOnly, setCombinedOnly] = useState(false);
  const [dashboardOnly, setDashboardOnly] = useState(false);
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
    if (dashboardOnly && !result.is_dashboard_latest) return false;
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
      result.comments ?? "",
      result.is_dashboard_latest ? "dashboard latest" : "",
      versionText,
      artifactText,
    ].some((value) => value.toLowerCase().includes(query));
  };

  const visibleResults = results.filter(resultMatchesControls).filter(resultMatchesSearch);
  const pagedResults = visibleResults.slice(page * pageSize, (page + 1) * pageSize);
  const firstVisibleRow = visibleResults.length ? page * pageSize + 1 : 0;
  const lastVisibleRow = page * pageSize + pagedResults.length;

  const clearFilters = () => {
    setSelectedAlgorithmId(null);
    setSelectedVersionId(null);
    setStatus("");
    setRunSource("");
    setSearch("");
    setCurrentOnly(false);
    setCombinedOnly(false);
    setDashboardOnly(false);
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

  const toggleDashboardResult = async (result: TrainingResult) => {
    setMessage(null);
    try {
      const updated = result.is_dashboard_latest
        ? await apiDelete<TrainingResult>(`/v1/training-results/${result.id}/dashboard-latest`)
        : await apiPost<TrainingResult>(`/v1/training-results/${result.id}/dashboard-latest`, {});
      setResults((current) => current.map((item) => {
        if (item.id === updated.id) return updated;
        return updated.is_dashboard_latest ? { ...item, is_dashboard_latest: false } : item;
      }));
      setPage(0);
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to update dashboard result.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Results library</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Find uploaded runs</h1>
          </div>
          <Link
            to="/upload-results"
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Upload result
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[220px_minmax(180px,1fr)_minmax(190px,1fr)_130px_160px_auto] xl:items-end">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="ID, file, comment"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Algorithm</span>
            <select
              value={selectedAlgorithmId ?? ""}
              onChange={(event) => handleAlgorithmChange(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
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
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Version</span>
            <select
              value={selectedVersionId ?? ""}
              onChange={(event) => {
                setSelectedVersionId(Number(event.target.value) || null);
                setPage(0);
              }}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
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
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Run source</span>
            <input
              value={runSource}
              onChange={(event) => {
                setRunSource(event.target.value);
                setPage(0);
              }}
              placeholder="Source"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={clearFilters}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={currentOnly}
                onChange={(event) => handleCurrentOnlyChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Current only
            </label>
            <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={combinedOnly}
                onChange={(event) => {
                  setCombinedOnly(event.target.checked);
                  setPage(0);
                }}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Combined only
            </label>
            <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={dashboardOnly}
                onChange={(event) => {
                  setDashboardOnly(event.target.checked);
                  setPage(0);
                }}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Dashboard
            </label>
          </div>

          <p className="text-xs text-slate-500">
            {isLoadingResults ? "Loading results..." : `${visibleResults.length} matching of ${results.length} loaded`}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Uploaded results</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Page {page + 1} / {isLoadingResults ? "loading" : `${visibleResults.length} matching of ${results.length} loaded`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Rows</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
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
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-700">Result</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-700">Linked versions</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-700">Status</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-700">Metrics</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-700">Data window</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingResults ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">Loading results...</td>
                </tr>
              ) : pagedResults.length ? pagedResults.map((result) => {
                const linkedVersions = linkedVersionsFor(result);
                const previewMetrics = metricPreviewEntries(result.summary_json);
                return (
                  <tr key={result.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={`/results/${result.id}`} className="text-sm font-semibold text-slate-900 hover:text-slate-600">
                        Result #{result.id}
                      </Link>
                      <p className="mt-0.5 whitespace-nowrap text-[11px] text-slate-500">{formatDateTime(result.created_at)}</p>
                      <p className="mt-0.5 max-w-36 truncate text-[11px] text-slate-500" title={result.run_source}>{result.run_source}</p>
                      {result.comments ? (
                        <p className="mt-0.5 max-w-44 truncate text-[11px] text-slate-600" title={result.comments}>{result.comments}</p>
                      ) : null}
                    </td>
                    <td className="min-w-56 px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {linkedVersions.slice(0, 3).map((version) => {
                          const isCurrent = isCurrentActiveVersion(version);
                          const isInactive = isInactiveVersion(version);
                          const label = versionLabel(version);
                          return (
                            <span
                              key={`${result.id}-${version.id}`}
                              title={`${label}${isInactive ? " / deleted" : ""}`}
                              className={`inline-block max-w-52 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                                isInactive
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : isCurrent
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }`}
                            >
                              {label}{isInactive ? " / deleted" : ""}
                            </span>
                          );
                        })}
                        {linkedVersions.length > 3 ? (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            +{linkedVersions.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${statusClass(result.status)}`}>
                          {result.status}
                        </span>
                        {linkedVersions.length > 1 ? (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">Combined</span>
                        ) : null}
                        {result.is_dashboard_latest ? (
                          <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">Dashboard</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="min-w-48 px-3 py-2">
                      {previewMetrics.length ? (
                        <div className="flex flex-wrap gap-1">
                          {previewMetrics.map(([key, value]) => (
                            <span key={key} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                              {displayMetricKey(key)}: {formatMetricValue(key, value)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No metrics</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <p>{formatDate(result.data_from)}</p>
                      <p className="mt-0.5">{formatDate(result.data_to)}</p>
                    </td>
                    <td className="min-w-[300px] whitespace-nowrap px-3 py-2">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Link
                          to={`/results/${result.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleDashboardResult(result)}
                          className={`inline-flex h-8 items-center rounded-md border px-2 text-xs font-semibold ${
                            result.is_dashboard_latest
                              ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-700"
                              : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          {result.is_dashboard_latest ? "On dashboard" : "Show on dashboard"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteResult(result)}
                          className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    No uploaded results match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing rows {firstVisibleRow}-{lastVisibleRow}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0 || isLoadingResults}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Newer
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={(page + 1) * pageSize >= visibleResults.length || isLoadingResults}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
