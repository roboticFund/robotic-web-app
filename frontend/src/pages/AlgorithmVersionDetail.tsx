import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPatch } from "../api/client";

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
  description?: string | null;
  git_commit_sha?: string | null;
  github_repo_owner?: string | null;
  github_repo_name?: string | null;
  github_parameter_path?: string | null;
  github_ref?: string | null;
  effective_from?: string | null;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GitHubParameterFile {
  version_id: number;
  repository: string;
  path: string;
  ref?: string | null;
  html_url?: string | null;
  sha?: string | null;
  content_type: string;
  parameter_json: unknown;
  parameter_summary?: {
    robotic_fund_size?: unknown;
  };
  commit_date?: string | null;
  raw_text: string;
  fetched_at: string;
}

interface TrainingArtifact {
  id: number;
  artifact_type: string;
  file_name: string;
  byte_size?: number | null;
}

interface TrainingResult {
  id: number;
  run_source: string;
  status: string;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  summary_json: Record<string, unknown>;
  artifacts: TrainingArtifact[];
}

interface VersionFormState {
  version_label: string;
  description: string;
  git_commit_sha: string;
  is_current: boolean;
  github_repo_owner: string;
  github_repo_name: string;
  github_parameter_path: string;
  github_ref: string;
  effective_from: string;
}

function formStateFromVersion(version: AlgorithmVersion): VersionFormState {
  return {
    version_label: version.version_label,
    description: version.description ?? "",
    git_commit_sha: version.git_commit_sha ?? "",
    is_current: version.is_current,
    github_repo_owner: version.github_repo_owner ?? "",
    github_repo_name: version.github_repo_name ?? "",
    github_parameter_path: version.github_parameter_path ?? "",
    github_ref: version.github_ref ?? "",
    effective_from: toDateTimeLocalValue(version.effective_from),
  };
}

function nullableText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function displayLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function nullableDateTime(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatPrimitive(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null) return "null";
  if (value === undefined || value === "") return "-";
  return String(value);
}

function formatOptionalParameter(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return formatPrimitive(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="font-mono text-xs text-slate-500">[]</span>;
    }

    return (
      <div className={depth > 0 ? "mt-2 space-y-2 border-l border-slate-200 pl-3" : "space-y-2"}>
        {value.map((item, index) => (
          <div key={`${index}-${typeof item}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Item {index + 1}</div>
            <JsonValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="font-mono text-xs text-slate-500">{"{}"}</span>;
    }

    return (
      <div className={depth > 0 ? "mt-2 space-y-2 border-l border-slate-200 pl-3" : "space-y-2"}>
        {entries.map(([key, nestedValue]) => (
          <div key={key} className="grid gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 sm:grid-cols-[180px_1fr]">
            <div className="text-xs font-semibold uppercase text-slate-500">{displayLabel(key)}</div>
            <div className="min-w-0 text-sm text-slate-800">
              <JsonValue value={nestedValue} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="font-mono text-xs text-slate-700">{formatPrimitive(value)}</span>;
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function AlgorithmVersionDetail() {
  const { versionId } = useParams();
  const [version, setVersion] = useState<AlgorithmVersion | null>(null);
  const [algorithm, setAlgorithm] = useState<Algorithm | null>(null);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<VersionFormState | null>(null);
  const [githubParameters, setGithubParameters] = useState<GitHubParameterFile | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVersionDetail() {
      setIsLoading(true);
      setError(null);

      const numericVersionId = Number(versionId);
      if (!Number.isInteger(numericVersionId) || numericVersionId <= 0) {
        setError("Invalid algorithm version id.");
        setIsLoading(false);
        return;
      }

      try {
        const versionData = await apiGet<AlgorithmVersion>(`/v1/algorithm-versions/${numericVersionId}`);
        const [algorithmData, resultData] = await Promise.all([
          apiGet<Algorithm>(`/v1/algorithms/${versionData.algo_id}`).catch(() => null),
          apiGet<TrainingResult[]>(`/v1/training-results/version/${versionData.id}`).catch(() => [] as TrainingResult[]),
        ]);

        if (!cancelled) {
          setVersion(versionData);
          setFormState(formStateFromVersion(versionData));
          setAlgorithm(algorithmData);
          setResults(resultData);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Unable to load algorithm version.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadVersionDetail();
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  const shouldLoadGithubFile = Boolean(
    version?.git_commit_sha
    || version?.github_ref
    || version?.github_repo_owner
    || version?.github_repo_name
    || version?.github_parameter_path,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadGithubParameters() {
      if (!version || !shouldLoadGithubFile) {
        setGithubParameters(null);
        setGithubError(null);
        return;
      }

      setGithubLoading(true);
      setGithubError(null);
      try {
        const data = await apiGet<GitHubParameterFile>(`/v1/algorithm-versions/${version.id}/github-parameters`);
        if (!cancelled) setGithubParameters(data);
      } catch (err: any) {
        if (!cancelled) {
          setGithubParameters(null);
          setGithubError(err?.message ?? "Unable to load GitHub parameter file.");
        }
      } finally {
        if (!cancelled) setGithubLoading(false);
      }
    }

    loadGithubParameters();
    return () => {
      cancelled = true;
    };
  }, [
    version?.id,
    version?.git_commit_sha,
    version?.github_repo_owner,
    version?.github_repo_name,
    version?.github_parameter_path,
    version?.github_ref,
    shouldLoadGithubFile,
  ]);

  const refreshGithubParameters = async () => {
    if (!version || !shouldLoadGithubFile) return;
    setGithubLoading(true);
    setGithubError(null);
    try {
      const data = await apiGet<GitHubParameterFile>(`/v1/algorithm-versions/${version.id}/github-parameters`);
      setGithubParameters(data);
    } catch (err: any) {
      setGithubParameters(null);
      setGithubError(err?.message ?? "Unable to load GitHub parameter file.");
    } finally {
      setGithubLoading(false);
    }
  };

  const startEdit = () => {
    if (!version) return;
    setFormState(formStateFromVersion(version));
    setSaveMessage(null);
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (version) setFormState(formStateFromVersion(version));
    setSaveMessage(null);
    setIsEditing(false);
  };

  const saveVersion = async (event: FormEvent) => {
    event.preventDefault();
    if (!version || !formState) return;

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updated = await apiPatch<AlgorithmVersion>(`/v1/algorithm-versions/${version.id}`, {
        version_label: formState.version_label,
        description: nullableText(formState.description),
        git_commit_sha: nullableText(formState.git_commit_sha),
        is_current: formState.is_current,
        github_repo_owner: nullableText(formState.github_repo_owner),
        github_repo_name: nullableText(formState.github_repo_name),
        github_parameter_path: nullableText(formState.github_parameter_path),
        github_ref: nullableText(formState.github_ref),
        effective_from: nullableDateTime(formState.effective_from),
      });
      setVersion(updated);
      setFormState(formStateFromVersion(updated));
      setSaveMessage("Version details saved.");
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message ?? "Unable to save algorithm version.");
    } finally {
      setIsSaving(false);
    }
  };

  const positionSize = useMemo(() => {
    if (githubLoading && !githubParameters) return "Loading...";
    if (githubError) return "Unavailable";
    return formatOptionalParameter(githubParameters?.parameter_summary?.robotic_fund_size);
  }, [githubError, githubLoading, githubParameters]);

  const effectiveFrom = useMemo(() => {
    if (version?.effective_from) return formatDateTime(version.effective_from);
    if (githubLoading && !githubParameters) return "Loading...";
    return formatDateTime(githubParameters?.commit_date);
  }, [githubLoading, githubParameters, version?.effective_from]);

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading algorithm version...
      </section>
    );
  }

  if (error || !version) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-rose-600">{error ?? "Algorithm version not found."}</p>
        <Link to="/algorithm-versions" className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          Back to versions
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/algorithm-versions" className="text-sm font-semibold text-slate-300 hover:text-white">
          Back to algorithm versions
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={isEditing ? cancelEdit : startEdit}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {isEditing ? "Cancel edit" : "Edit details"}
          </button>
          <Link
            to={`/algorithm-versions?algorithmId=${version.algo_id}`}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            View version list
          </Link>
        </div>
      </div>

      {saveMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {saveMessage}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">Algorithm version</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {algorithm ? `${algorithm.code} / ${version.version_label}` : version.version_label}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {algorithm ? `${algorithm.name} / ${algorithm.instrument} / ${algorithm.resolution}` : `Algorithm #${version.algo_id}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              version.is_current ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}>
              {version.is_current ? "Current" : "Prior"}
            </span>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              version.is_active ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"
            }`}>
              {version.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Created</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(version.created_at)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Updated</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(version.updated_at)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Commit</div>
            <div className="mt-2 break-all font-mono text-xs text-slate-900">{version.git_commit_sha || "Not recorded"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Effective from</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{effectiveFrom}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Saved results</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{results.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Position size</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{positionSize}</div>
          </div>
        </div>
      </section>

      {isEditing && formState ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Edit version details</h2>
              <p className="mt-1 text-sm text-slate-500">Update metadata and GitHub source settings.</p>
            </div>
          </div>

          <form onSubmit={saveVersion} className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Version label</span>
              <input
                value={formState.version_label}
                onChange={(event) => setFormState({ ...formState, version_label: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Git commit SHA</span>
              <input
                value={formState.git_commit_sha}
                onChange={(event) => setFormState({ ...formState, git_commit_sha: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Effective from</span>
              <input
                type="datetime-local"
                value={formState.effective_from}
                onChange={(event) => setFormState({ ...formState, effective_from: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={formState.description}
                onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>

            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900">GitHub parameter source</h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Repository owner</span>
                  <input
                    value={formState.github_repo_owner}
                    onChange={(event) => setFormState({ ...formState, github_repo_owner: event.target.value })}
                    placeholder="owner"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Repository name</span>
                  <input
                    value={formState.github_repo_name}
                    onChange={(event) => setFormState({ ...formState, github_repo_name: event.target.value })}
                    placeholder="trade-engine"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Parameter file path</span>
                  <input
                    value={formState.github_parameter_path}
                    onChange={(event) => setFormState({ ...formState, github_parameter_path: event.target.value })}
                    placeholder="optional override, e.g. resources/algorithms/algo1/algo_params.py"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">GitHub ref</span>
                  <input
                    value={formState.github_ref}
                    onChange={(event) => setFormState({ ...formState, github_ref: event.target.value })}
                    placeholder="branch, tag, or commit"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formState.is_current}
                  onChange={(event) => setFormState({ ...formState, is_current: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                Current version
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSaving ? "Saving..." : "Save details"}
                </button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {version.description || "No description has been saved for this version."}
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">GitHub Source File</h2>
            <p className="mt-1 text-sm text-slate-500">
              {version.github_repo_owner && version.github_repo_name && version.github_parameter_path
                ? `${version.github_repo_owner}/${version.github_repo_name} / ${version.github_parameter_path}`
                : shouldLoadGithubFile
                ? "Using backend GitHub repository defaults and dynamic path template."
                : "No GitHub source file configured."}
            </p>
          </div>
          {shouldLoadGithubFile ? (
            <button
              type="button"
              onClick={refreshGithubParameters}
              disabled={githubLoading}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {githubLoading ? "Loading..." : "Refresh from GitHub"}
            </button>
          ) : null}
        </div>

        {!shouldLoadGithubFile ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Add a commit SHA, GitHub ref, or GitHub source settings in Edit details. Backend defaults can derive the path from the algorithm/version template when repository owner/name are configured in `.env`.
          </p>
        ) : githubError ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{githubError}</p>
        ) : githubLoading && !githubParameters ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading GitHub parameter file...
          </p>
        ) : githubParameters ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Ref</div>
                <div className="mt-2 break-all font-mono text-xs text-slate-900">{githubParameters.ref || "Default branch"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Commit date</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(githubParameters.commit_date)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">File SHA</div>
                <div className="mt-2 break-all font-mono text-xs text-slate-900">{githubParameters.sha || "-"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Type</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{githubParameters.content_type}</div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase text-slate-500">Fetched</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(githubParameters.fetched_at)}</div>
            </div>

            {githubParameters.html_url ? (
              <a
                href={githubParameters.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Open file on GitHub
              </a>
            ) : null}

            {githubParameters.parameter_json !== null && githubParameters.parameter_json !== undefined ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Parsed parameters</h3>
                <div className="mt-3">
                  <JsonValue value={githubParameters.parameter_json} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-slate-100">
                <div className="mb-3 text-sm font-semibold text-slate-200">{githubParameters.path}</div>
                <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-200">{githubParameters.raw_text}</pre>
              </div>
            )}

            {githubParameters.parameter_json !== null && githubParameters.parameter_json !== undefined ? (
              <details className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-slate-100">
                <summary className="cursor-pointer text-sm font-semibold text-slate-200">Raw file</summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-200">{githubParameters.raw_text}</pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Training Results</h2>
            <p className="mt-1 text-sm text-slate-500">Runs linked to this algorithm version.</p>
          </div>
          <Link
            to={`/results?algo_version_id=${version.id}`}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Open in results
          </Link>
        </div>

        {results.length ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Result</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Source</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Run period</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Artifacts</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900">#{result.id}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass(result.status)}`}>
                        {result.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{result.run_source}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {formatDate(result.run_started_at)}
                      {result.run_completed_at ? ` to ${formatDate(result.run_completed_at)}` : ""}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{result.artifacts.length}</td>
                    <td className="px-3 py-2 text-sm">
                      <Link
                        to={`/results/${result.id}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No training results are linked to this version yet.
          </p>
        )}
      </section>
    </div>
  );
}

export default AlgorithmVersionDetail;
