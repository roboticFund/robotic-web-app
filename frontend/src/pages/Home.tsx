import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL, apiGet } from "../api/client";
import {
  fetchRoboticFundSize,
  roboticFundSizeDisplay,
  type VersionGitHubSource,
} from "../lib/githubParameters";
import {
  displayMetricKey,
  formatMetricValue,
  inferCsvDateRange,
  inferCsvMonthlyMetricRows,
  inferCsvSummary,
  inferCsvYearlyMetricRows,
  metricEntries,
  type CsvDateRange,
  type MonthlyMetricRow,
  type PeriodMetricRow,
  type SummaryMetricContext,
} from "../lib/resultMetrics";

interface Algorithm {
  id: number;
  code: string;
  name: string;
}

interface AlgorithmVersion extends VersionGitHubSource {
  id: number;
  version_label: string;
  is_current: boolean;
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
  algorithm_code?: string | null;
  algorithm_name?: string | null;
}

interface TrainingResult {
  id: number;
  linked_versions?: AlgorithmVersionLink[];
  run_source: string;
  status: string;
  created_at?: string;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  data_from?: string | null;
  data_to?: string | null;
  summary_json: Record<string, unknown>;
  artifacts: TrainingArtifact[];
  is_dashboard_latest?: boolean;
}

interface AlgorithmRow {
  id: number;
  code: string;
  name: string;
  currentVersionLabel: string;
  latestVersionId: number | null;
  latestResultId: number | null;
  effectiveFrom: string;
  positionSize: string;
}

type DashboardTab = "chart" | "stats" | "algorithms";
type PeriodTableMode = "monthly" | "yearly";

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

function versionLabel(version: AlgorithmVersionLink) {
  return version.algorithm_code
    ? `${version.algorithm_code} / ${version.version_label}`
    : version.version_label;
}

function artifactUrl(artifact: TrainingArtifact) {
  const encodedKey = artifact.s3_key.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE_URL}/v1/training-results/artifacts/${encodedKey}`;
}

function isImageArtifact(artifact: TrainingArtifact) {
  return artifact.content_type.startsWith("image/") || artifact.artifact_type === "analysis_png";
}

function isStatsCsvArtifact(artifact: TrainingArtifact) {
  return artifact.artifact_type === "stats_csv" || artifact.file_name.toLowerCase().includes("advanced_metrics");
}

function versionNumberParts(versionLabel: string) {
  return (versionLabel.match(/\d+/g) ?? []).map((part) => Number(part));
}

function compareVersionLabelsNewestFirst(left: AlgorithmVersion, right: AlgorithmVersion) {
  const leftParts = versionNumberParts(left.version_label);
  const rightParts = versionNumberParts(right.version_label);
  if (leftParts.length && !rightParts.length) return -1;
  if (!leftParts.length && rightParts.length) return 1;
  const maxParts = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxParts; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return right.version_label.localeCompare(left.version_label);
}

function Home() {
  const [algorithms, setAlgorithms] = useState<AlgorithmRow[]>([]);
  const [dashboardResult, setDashboardResult] = useState<TrainingResult | null>(null);
  const [dashboardArtifactSummary, setDashboardArtifactSummary] = useState<Record<string, unknown>>({});
  const [dashboardArtifactDateRange, setDashboardArtifactDateRange] = useState<CsvDateRange>({ dataFrom: null, dataTo: null });
  const [dashboardStatsCsvText, setDashboardStatsCsvText] = useState<string | null>(null);
  const [dashboardMonthlyRows, setDashboardMonthlyRows] = useState<MonthlyMetricRow[]>([]);
  const [dashboardYearlyRows, setDashboardYearlyRows] = useState<PeriodMetricRow[]>([]);
  const [periodTableMode, setPeriodTableMode] = useState<PeriodTableMode>("monthly");
  const [monthlyAlgoFilter, setMonthlyAlgoFilter] = useState("combined");
  const [activeTab, setActiveTab] = useState<DashboardTab>("chart");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [data, pinnedResult] = await Promise.all([
          apiGet<Algorithm[]>("/v1/algorithms/"),
          apiGet<TrainingResult | null>("/v1/training-results/dashboard/latest").catch(() => null),
        ]);
        if (!Array.isArray(data)) {
          throw new Error("Unexpected algorithm response");
        }

        const rows = await Promise.all(
          data.map(async (algorithm) => {
            const versions = await apiGet<AlgorithmVersion[]>(`/v1/algorithms/${algorithm.id}/versions`);
            const latestVersion = [...versions]
              .sort(compareVersionLabelsNewestFirst)[0];
            const currentVersion = versions.find((version) => version.is_current) ?? latestVersion;
            const githubMetadata = currentVersion
              ? await fetchRoboticFundSize(currentVersion)
              : undefined;
            const positionSize = currentVersion ? roboticFundSizeDisplay(githubMetadata) : "-";
            const effectiveFrom = formatDateTime(currentVersion?.effective_from ?? githubMetadata?.commitDate);
            const latestResults = latestVersion
              ? await apiGet<TrainingResult[]>(`/v1/training-results/version/${latestVersion.id}?limit=1`).catch(() => [] as TrainingResult[])
              : [];

            return {
              id: algorithm.id,
              code: algorithm.code,
              name: algorithm.name,
              currentVersionLabel: currentVersion?.version_label ?? "No versions",
              latestVersionId: latestVersion?.id ?? null,
              latestResultId: latestResults[0]?.id ?? null,
              effectiveFrom,
              positionSize,
            };
          })
        );
        if (!cancelled) {
          setDashboardResult(pinnedResult);
          setAlgorithms(rows);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Unable to load algorithms.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const dashboardVersions = dashboardResult?.linked_versions ?? [];
  const dashboardMetricContext: SummaryMetricContext = {
    algoCode: dashboardVersions.length > 1 ? "combined" : dashboardVersions[0]?.algorithm_code ?? null,
    isCombined: dashboardVersions.length > 1,
  };
  const dashboardRunDate = dashboardResult?.run_started_at ?? dashboardResult?.run_completed_at ?? dashboardResult?.created_at ?? null;
  const dashboardChart = dashboardResult?.artifacts.find(isImageArtifact) ?? null;
  const dashboardStatsCsv = dashboardResult?.artifacts.find(isStatsCsvArtifact) ?? null;
  const dashboardMetrics = metricEntries({
    ...(dashboardResult?.summary_json ?? {}),
    ...dashboardArtifactSummary,
  }, 10);
  const dashboardDataFrom = dashboardArtifactDateRange.dataFrom ?? dashboardResult?.data_from ?? null;
  const dashboardDataTo = dashboardArtifactDateRange.dataTo ?? dashboardResult?.data_to ?? null;
  const monthlyFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const algoOptions = dashboardVersions
      .filter((version) => {
        const code = version.algorithm_code?.trim();
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((version) => ({
        key: version.algorithm_code?.trim() ?? "",
        label: versionLabel(version),
      }))
      .filter((option) => option.key);

    return [{ key: "combined", label: "Combined" }, ...algoOptions];
  }, [dashboardVersions]);
  const monthlyMetricContext: SummaryMetricContext = monthlyAlgoFilter === "combined"
    ? { algoCode: "combined", isCombined: true }
    : { algoCode: monthlyAlgoFilter, isCombined: false };

  useEffect(() => {
    setMonthlyAlgoFilter("combined");
  }, [dashboardResult?.id]);

  useEffect(() => {
    let cancelled = false;
    setDashboardArtifactSummary({});
    setDashboardArtifactDateRange({ dataFrom: null, dataTo: null });
    setDashboardStatsCsvText(null);
    setDashboardMonthlyRows([]);
    setDashboardYearlyRows([]);
    if (!dashboardStatsCsv) return () => {
      cancelled = true;
    };

    fetch(artifactUrl(dashboardStatsCsv))
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to fetch stats CSV: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setDashboardStatsCsvText(text);
          setDashboardArtifactSummary(inferCsvSummary(text, dashboardMetricContext));
          setDashboardArtifactDateRange(inferCsvDateRange(text, dashboardMetricContext));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardArtifactSummary({});
          setDashboardArtifactDateRange({ dataFrom: null, dataTo: null });
          setDashboardStatsCsvText(null);
          setDashboardMonthlyRows([]);
          setDashboardYearlyRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardStatsCsv?.s3_key, dashboardMetricContext.algoCode, dashboardMetricContext.isCombined]);

  useEffect(() => {
    if (!dashboardStatsCsvText) {
      setDashboardMonthlyRows([]);
      setDashboardYearlyRows([]);
      return;
    }
    setDashboardMonthlyRows(inferCsvMonthlyMetricRows(dashboardStatsCsvText, monthlyMetricContext));
    setDashboardYearlyRows(inferCsvYearlyMetricRows(dashboardStatsCsvText, monthlyMetricContext));
  }, [dashboardStatsCsvText, monthlyMetricContext.algoCode, monthlyMetricContext.isCombined]);

  const periodRows = periodTableMode === "monthly" ? dashboardMonthlyRows : dashboardYearlyRows;
  const periodMetricColumns = periodTableMode === "monthly" ? monthlyMetricColumns : yearlyMetricColumns;
  const periodLabel = periodTableMode === "monthly" ? "Monthly stats" : "Yearly stats";

  return (
    <main className="mx-auto w-full max-w-[1900px] space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {([
            ["chart", "Combined chart"],
            ["stats", "Combined stats"],
            ["algorithms", "Algorithms"],
          ] as [DashboardTab, string][]).map(([tab, label]) => (
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

      {activeTab === "chart" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {dashboardResult ? (
            dashboardChart ? (
              <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-md bg-white">
                <img
                  src={artifactUrl(dashboardChart)}
                  alt={dashboardChart.file_name}
                  className="block max-h-[calc(100vh-150px)] w-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No chart image is attached to the tagged combined result.
              </div>
            )
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {loading ? "Loading combined chart..." : "No result is currently selected for the dashboard."}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Combined stats</h1>
              {dashboardResult ? (
                <>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    Result #{dashboardResult.id}
                  </span>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(dashboardResult.status)}`}>
                    {dashboardResult.status}
                  </span>
                  {dashboardVersions.length > 1 ? (
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                      Combined
                    </span>
                  ) : null}
                  <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                    Dashboard
                  </span>
                </>
              ) : (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                  No dashboard result tagged
                </span>
              )}
            </div>
            {dashboardResult ? (
              <Link
                to={`/results/${dashboardResult.id}`}
                className="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Open result
              </Link>
            ) : (
              <Link
                to="/results"
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                Results library
              </Link>
            )}
          </div>

          {dashboardResult ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <span className="text-slate-500">Run</span>
                  <span className="ml-2 font-semibold text-slate-900">{formatDate(dashboardRunDate)}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <span className="text-slate-500">From</span>
                  <span className="ml-2 font-semibold text-slate-900">{formatDate(dashboardDataFrom)}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <span className="text-slate-500">To</span>
                  <span className="ml-2 font-semibold text-slate-900">{formatDate(dashboardDataTo)}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <span className="text-slate-500">Files</span>
                  <span className="ml-2 font-semibold text-slate-900">{dashboardResult.artifacts.length}</span>
                </div>
                <div className="truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" title={dashboardResult.run_source}>
                  <span className="text-slate-500">Source</span>
                  <span className="ml-2 font-semibold text-slate-900">{dashboardResult.run_source}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {dashboardVersions.length ? dashboardVersions.slice(0, 10).map((version) => (
                  <span key={version.id} className="max-w-52 truncate rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {versionLabel(version)}
                  </span>
                )) : (
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    Linked version data unavailable
                  </span>
                )}
                {dashboardVersions.length > 10 ? (
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    +{dashboardVersions.length - 10}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                {dashboardMetrics.length ? dashboardMetrics.map(([key, value]) => (
                  <div key={key} className="min-h-14 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <p className="truncate text-[11px] font-semibold uppercase text-slate-500" title={displayMetricKey(key)}>{displayMetricKey(key)}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={formatMetricValue(key, value)}>{formatMetricValue(key, value)}</p>
                  </div>
                )) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-500 sm:col-span-2 lg:col-span-5">
                    No summary metrics saved for this result.
                  </p>
                )}
              </div>

              {dashboardStatsCsvText ? (
                <div>
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">{periodLabel}</h2>
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
                      {monthlyFilterOptions.map((option) => (
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
                  <div className="mt-1.5 max-h-[360px] overflow-auto rounded-md border border-slate-200">
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
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {loading ? "Loading combined stats..." : "No result is currently selected for the dashboard."}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "algorithms" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Algorithms and current versions</h1>
            </div>
            <p className="text-sm text-slate-500">All active algorithms, current versions, and configured position size.</p>
          </div>

          {error ? (
            <div className="mt-6 rounded-3xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Algorithm</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Name</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Current version</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Effective from</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Position size</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Latest result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-center text-sm text-slate-500">Loading algorithms...</td>
                  </tr>
                ) : algorithms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-center text-sm text-slate-500">No algorithms found.</td>
                  </tr>
                ) : (
                  algorithms.map((algorithm) => (
                    <tr key={algorithm.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-semibold text-slate-900">{algorithm.code}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{algorithm.name}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{algorithm.currentVersionLabel}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{algorithm.effectiveFrom}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-700">{algorithm.positionSize}</td>
                      <td className="px-3 py-2 text-sm">
                        {algorithm.latestResultId ? (
                          <Link
                            to={`/results/${algorithm.latestResultId}`}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Open latest result
                          </Link>
                        ) : algorithm.latestVersionId ? (
                          <span className="text-slate-500">No results</span>
                        ) : (
                          <span className="text-slate-500">No version</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default Home;
