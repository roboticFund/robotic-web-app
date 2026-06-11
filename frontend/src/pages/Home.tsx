import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL, apiGet } from "../api/client";
import {
  fetchRoboticFundSize,
  roboticFundSizeDisplay,
  type VersionGitHubSource,
} from "../lib/githubParameters";

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
    .slice(0, 4);
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

  const dashboardMetrics = metricPreviewEntries(dashboardResult?.summary_json ?? {});
  const dashboardVersions = dashboardResult?.linked_versions ?? [];
  const dashboardRunDate = dashboardResult?.run_started_at ?? dashboardResult?.run_completed_at ?? dashboardResult?.created_at ?? null;
  const dashboardChart = dashboardResult?.artifacts.find(isImageArtifact) ?? null;

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
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Combined stats</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                {dashboardResult ? `Result #${dashboardResult.id}` : "No dashboard result tagged"}
              </h1>
            </div>
            {dashboardResult ? (
              <Link
                to={`/results/${dashboardResult.id}`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Open result
              </Link>
            ) : (
              <Link
                to="/results"
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Results library
              </Link>
            )}
          </div>

          {dashboardResult ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
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
                </div>
                <p className="mt-3 truncate text-sm text-slate-500" title={dashboardResult.run_source}>
                  {dashboardResult.run_source}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dashboardVersions.length ? dashboardVersions.slice(0, 8).map((version) => (
                    <span key={version.id} className="max-w-56 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                      {versionLabel(version)}
                    </span>
                  )) : (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                      Linked version data unavailable
                    </span>
                  )}
                  {dashboardVersions.length > 8 ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                      +{dashboardVersions.length - 8}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {dashboardMetrics.length ? dashboardMetrics.map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{displayMetricKey(key)}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{formatMetricValue(value)}</p>
                    </div>
                  )) : (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 sm:col-span-2 xl:col-span-4">
                      No summary metrics saved for this result.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Run date</span>
                  <span className="text-right font-medium text-slate-900">{formatDate(dashboardRunDate)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4">
                  <span className="text-slate-500">Data from</span>
                  <span className="text-right font-medium text-slate-900">{formatDate(dashboardResult.data_from)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4">
                  <span className="text-slate-500">Data to</span>
                  <span className="text-right font-medium text-slate-900">{formatDate(dashboardResult.data_to)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4">
                  <span className="text-slate-500">Files</span>
                  <span className="text-right font-medium text-slate-900">{dashboardResult.artifacts.length}</span>
                </div>
                {dashboardResult.artifacts[0] ? (
                  <p className="mt-3 truncate text-xs text-slate-500" title={dashboardResult.artifacts[0].file_name}>
                    {dashboardResult.artifacts[0].file_name}
                  </p>
                ) : null}
              </div>
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
