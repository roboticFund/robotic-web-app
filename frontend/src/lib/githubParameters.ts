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
  githubUrl?: string | null;
}

export interface GitHubVersionLink {
  url: string;
  label: string;
  title: string;
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

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function encodeGitHubPath(path: string) {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function repositoryUrl(owner: string, repo: string) {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function githubLinkForVersion(
  version: VersionGitHubSource,
  state?: RoboticFundSizeState,
): GitHubVersionLink | null {
  const fetchedUrl = cleanText(state?.githubUrl);
  if (fetchedUrl) {
    return {
      url: fetchedUrl,
      label: "Open file",
      title: "Open the resolved GitHub source file",
    };
  }

  const owner = cleanText(version.github_repo_owner);
  const repo = cleanText(version.github_repo_name);
  if (!owner || !repo) return null;

  const baseUrl = repositoryUrl(owner, repo);
  const commitSha = cleanText(version.git_commit_sha);
  const ref = cleanText(version.github_ref) ?? commitSha;
  const parameterPath = cleanText(version.github_parameter_path);

  if (parameterPath) {
    return {
      url: `${baseUrl}/blob/${encodeURIComponent(ref ?? "HEAD")}/${encodeGitHubPath(parameterPath)}`,
      label: "Open file",
      title: `Open ${parameterPath} on GitHub`,
    };
  }

  if (commitSha) {
    return {
      url: `${baseUrl}/commit/${encodeURIComponent(commitSha)}`,
      label: "Open commit",
      title: `Open commit ${commitSha} on GitHub`,
    };
  }

  if (ref) {
    return {
      url: `${baseUrl}/tree/${encodeURIComponent(ref)}`,
      label: "Open ref",
      title: `Open ${ref} on GitHub`,
    };
  }

  return {
    url: baseUrl,
    label: "Open repo",
    title: `Open ${owner}/${repo} on GitHub`,
  };
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
    ? { status: "loading", value: null, commitDate: null, githubUrl: null }
    : { status: "not_configured", value: null, commitDate: null, githubUrl: null };
}

export async function fetchRoboticFundSize(version: VersionGitHubSource): Promise<RoboticFundSizeState> {
  if (!hasGitHubParameterSource(version)) {
    return { status: "not_configured", value: null, commitDate: null, githubUrl: null };
  }

  try {
    const file = await apiGet<GitHubParameterFile>(`/v1/algorithm-versions/${version.id}/github-parameters`);
    const value = formatParameterValue(file.parameter_summary?.robotic_fund_size);
    const githubUrl = file.html_url ?? null;
    return value || file.commit_date || githubUrl
      ? { status: "loaded", value, commitDate: file.commit_date ?? null, githubUrl }
      : { status: "missing", value: null, commitDate: null, githubUrl: null };
  } catch {
    return { status: "error", value: null, commitDate: null, githubUrl: null };
  }
}
