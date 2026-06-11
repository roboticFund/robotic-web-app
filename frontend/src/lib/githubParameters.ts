import { apiGet } from "../api/client";

export interface VersionGitHubSource {
  id: number;
  git_commit_sha?: string | null;
  github_repo_owner?: string | null;
  github_repo_name?: string | null;
  github_parameter_path?: string | null;
  github_ref?: string | null;
  effective_from?: string | null;
}

export interface GitHubParameterSummary {
  robotic_fund_size?: unknown;
}

export interface GitHubParameterFile {
  version_id: number;
  repository: string;
  path: string;
  ref?: string | null;
  html_url?: string | null;
  sha?: string | null;
  content_type: string;
  parameter_json: unknown;
  parameter_summary?: GitHubParameterSummary;
  commit_date?: string | null;
  raw_text: string;
  fetched_at: string;
}

export interface RoboticFundSizeState {
  status: "not_configured" | "loading" | "loaded" | "missing" | "error";
  value: string | null;
  commitDate?: string | null;
}

export function hasGitHubParameterSource(version: VersionGitHubSource) {
  return Boolean(
    version.git_commit_sha
    || version.github_ref
    || version.github_repo_owner
    || version.github_repo_name
    || version.github_parameter_path,
  );
}

export function formatParameterValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function roboticFundSizeDisplay(state?: RoboticFundSizeState) {
  if (!state || state.status === "loading") return "Loading...";
  if (state.status === "loaded" && state.value) return state.value;
  if (state.status === "error") return "Unavailable";
  return "-";
}

export function initialRoboticFundSizeState(version: VersionGitHubSource): RoboticFundSizeState {
  return hasGitHubParameterSource(version)
    ? { status: "loading", value: null, commitDate: null }
    : { status: "not_configured", value: null, commitDate: null };
}

export async function fetchRoboticFundSize(version: VersionGitHubSource): Promise<RoboticFundSizeState> {
  if (!hasGitHubParameterSource(version)) {
    return { status: "not_configured", value: null, commitDate: null };
  }

  try {
    const file = await apiGet<GitHubParameterFile>(`/v1/algorithm-versions/${version.id}/github-parameters`);
    const value = formatParameterValue(file.parameter_summary?.robotic_fund_size);
    return value || file.commit_date
      ? { status: "loaded", value, commitDate: file.commit_date ?? null }
      : { status: "missing", value: null, commitDate: null };
  } catch {
    return { status: "error", value: null, commitDate: null };
  }
}
