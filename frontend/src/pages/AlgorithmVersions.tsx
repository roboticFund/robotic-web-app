import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client";
import {
  fetchRoboticFundSize,
  initialRoboticFundSizeState,
  roboticFundSizeDisplay,
  type RoboticFundSizeState,
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
  description?: string | null;
  git_commit_sha?: string | null;
  github_repo_owner?: string | null;
  github_repo_name?: string | null;
  github_parameter_path?: string | null;
  github_ref?: string | null;
  effective_from?: string | null;
  is_current: boolean;
  is_active: boolean;
}

interface TrainingResult {
  id: number;
  run_source: string;
  status: string;
  run_started_at: string | null;
  run_completed_at: string | null;
  summary_json: Record<string, unknown>;
  artifacts: {
    id: number;
    artifact_type: string;
    file_name: string;
    s3_key: string;
    content_type: string;
    byte_size?: number | null;
  }[];
}

function AlgorithmVersions() {
  const [searchParams] = useSearchParams();
  const requestedAlgorithmId = Number(searchParams.get("algorithmId"));
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState<number | null>(null);
  const [versions, setVersions] = useState<AlgorithmVersion[]>([]);
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedVersionLabel, setSelectedVersionLabel] = useState<string | null>(null);
  const [roboticFundSizes, setRoboticFundSizes] = useState<Record<number, RoboticFundSizeState>>({});
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    version_label: "",
    description: "",
    git_commit_sha: "",
    github_repo_owner: "",
    github_repo_name: "",
    github_parameter_path: "",
    github_ref: "",
    effective_from: "",
    is_current: false,
  });

  const emptyFormState = {
    version_label: "",
    description: "",
    git_commit_sha: "",
    github_repo_owner: "",
    github_repo_name: "",
    github_parameter_path: "",
    github_ref: "",
    effective_from: "",
    is_current: false,
  };

  const nullableText = (value: string) => {
    const normalized = value.trim();
    return normalized ? normalized : null;
  };

  const nullableDateTime = (value: string) => {
    const normalized = value.trim();
    return normalized ? normalized : null;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  };

  const effectiveFromDisplay = (version: AlgorithmVersion) => (
    formatDateTime(version.effective_from ?? roboticFundSizes[version.id]?.commitDate)
  );

  useEffect(() => {
    apiGet<Algorithm[]>("/v1/algorithms/")
      .then((data) => {
        setAlgorithms(data);
        if (data.length > 0) {
          const requestedAlgorithm = data.find((algorithm) => algorithm.id === requestedAlgorithmId);
          setSelectedAlgorithmId(requestedAlgorithm?.id ?? data[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, [requestedAlgorithmId]);

  useEffect(() => {
    if (!selectedAlgorithmId) {
      setVersions([]);
      return;
    }

    apiGet<AlgorithmVersion[]>(`/v1/algorithms/${selectedAlgorithmId}/versions`)
      .then((data) => setVersions(data))
      .catch((err) => setError(err.message));
  }, [selectedAlgorithmId]);

  useEffect(() => {
    let cancelled = false;
    if (!versions.length) {
      setRoboticFundSizes({});
      return;
    }

    setRoboticFundSizes(Object.fromEntries(
      versions.map((version) => [version.id, initialRoboticFundSizeState(version)]),
    ));

    Promise.all(
      versions.map(async (version) => [version.id, await fetchRoboticFundSize(version)] as const),
    ).then((entries) => {
      if (!cancelled) setRoboticFundSizes(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [versions]);

  const refreshResults = async (versionId: number, versionLabel: string) => {
    setResultsError(null);
    setResultsLoading(true);
    try {
      const data = await apiGet<TrainingResult[]>(`/v1/training-results/version/${versionId}`);
      setResults(data);
      setSelectedVersionId(versionId);
      setSelectedVersionLabel(versionLabel);
    } catch (err: any) {
      setResultsError(err.message);
    } finally {
      setResultsLoading(false);
    }
  };

  const clearResults = () => {
    setSelectedVersionId(null);
    setSelectedVersionLabel(null);
    setResults([]);
    setResultsError(null);
  };

  const refreshVersions = () => {
    if (!selectedAlgorithmId) {
      return;
    }
    apiGet<AlgorithmVersion[]>(`/v1/algorithms/${selectedAlgorithmId}/versions`)
      .then((data) => setVersions(data))
      .catch((err) => setError(err.message));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedAlgorithmId) {
      setError("Please select an algorithm before creating a version.");
      return;
    }

    try {
      const payload = {
        version_label: formState.version_label,
        description: nullableText(formState.description),
        git_commit_sha: nullableText(formState.git_commit_sha),
        github_repo_owner: nullableText(formState.github_repo_owner),
        github_repo_name: nullableText(formState.github_repo_name),
        github_parameter_path: nullableText(formState.github_parameter_path),
        github_ref: nullableText(formState.github_ref),
        effective_from: nullableDateTime(formState.effective_from),
        is_current: formState.is_current,
      };

      if (editingVersionId) {
        await apiPatch(`/v1/algorithm-versions/${editingVersionId}`, payload);
      } else {
        await apiPost(`/v1/algorithms/${selectedAlgorithmId}/versions`, payload);
      }

      setEditingVersionId(null);
      setActiveTab("list");
      setFormState(emptyFormState);
      refreshVersions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (version: AlgorithmVersion) => {
    const confirmed = window.confirm(
      `Delete version "${version.version_label}"?\n\nThis will hide it from active frontend lists. Existing results linked to it will be kept and marked as deleted.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await apiDelete(`/v1/algorithm-versions/${version.id}`);
      if (editingVersionId === version.id) {
        cancelEdit();
      }
      refreshVersions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (version: AlgorithmVersion) => {
    setEditingVersionId(version.id);
    setActiveTab("create");
    setFormState({
      version_label: version.version_label,
      description: version.description ?? "",
      git_commit_sha: version.git_commit_sha ?? "",
      github_repo_owner: version.github_repo_owner ?? "",
      github_repo_name: version.github_repo_name ?? "",
      github_parameter_path: version.github_parameter_path ?? "",
      github_ref: version.github_ref ?? "",
      effective_from: toDateTimeLocalValue(version.effective_from),
      is_current: version.is_current,
    });
  };

  const cancelEdit = () => {
    setEditingVersionId(null);
    setActiveTab("list");
    setFormState(emptyFormState);
  };

  const showCreateForm = () => {
    setEditingVersionId(null);
    setActiveTab("create");
    setFormState(emptyFormState);
  };

  return (
    <div className="space-y-6">
      <section className="mb-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Select algorithm</span>
            <select
              value={selectedAlgorithmId ?? ""}
              onChange={(event) => setSelectedAlgorithmId(Number(event.target.value) || null)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Select an algorithm</option>
              {algorithms.map((algorithm) => (
                <option key={algorithm.id} value={algorithm.id}>
                  {algorithm.code} — {algorithm.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}
              onClick={() => {
                cancelEdit();
                setActiveTab("list");
              }}
            >
              Version list
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "create" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}
              onClick={() => showCreateForm()}
            >
              Create version
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Use tabs to switch between the version list and the create/update form.
        </p>
      </section>

      {(activeTab === "create" || editingVersionId) && (
        <section className="mb-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{editingVersionId ? "Edit algorithm version" : "Create algorithm version"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {editingVersionId ? "Update this version and save changes." : "Create a new version for the selected algorithm."}
              </p>
            </div>
            {editingVersionId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Version label</span>
            <input
              value={formState.version_label}
              onChange={(event) => setFormState({ ...formState, version_label: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Git commit SHA</span>
            <input
              value={formState.git_commit_sha}
              onChange={(event) => setFormState({ ...formState, git_commit_sha: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Effective from</span>
            <input
              type="datetime-local"
              value={formState.effective_from}
              onChange={(event) => setFormState({ ...formState, effective_from: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={formState.description}
              onChange={(event) => setFormState({ ...formState, description: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              rows={3}
            />
          </label>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900">GitHub parameter source</h3>
              <p className="mt-1 text-xs text-slate-500">Leave the path blank to use the backend template for this algorithm/version.</p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Repository owner</span>
              <input
                value={formState.github_repo_owner}
                onChange={(event) => setFormState({ ...formState, github_repo_owner: event.target.value })}
                placeholder="roboticFund"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Repository name</span>
              <input
                value={formState.github_repo_name}
                onChange={(event) => setFormState({ ...formState, github_repo_name: event.target.value })}
                placeholder="trade-engine"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Parameter file path</span>
              <input
                value={formState.github_parameter_path}
                onChange={(event) => setFormState({ ...formState, github_parameter_path: event.target.value })}
                placeholder="resources/algorithms/algo1/algo_params.py"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">GitHub ref</span>
              <input
                value={formState.github_ref}
                onChange={(event) => setFormState({ ...formState, github_ref: event.target.value })}
                placeholder="branch, tag, or commit"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formState.is_current}
              onChange={(event) => setFormState({ ...formState, is_current: event.target.checked })}
              className="h-5 w-5 rounded border-slate-300 text-slate-900"
            />
            <span className="text-sm text-slate-700">Mark as current version</span>
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
            >
              {editingVersionId ? "Save changes" : "Create version"}
            </button>
          </div>
        </form>
      </section>
      )}

      {activeTab === "list" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Versions</h2>
          {versions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No versions found for this algorithm yet.</p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Version</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Current</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Effective from</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Position size</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Commit</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {versions.map((version) => (
                    <tr key={version.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="text-sm font-semibold text-slate-900">{version.version_label}</div>
                        {version.description ? <div className="mt-1 text-sm text-slate-500">{version.description}</div> : null}
                        {version.github_parameter_path ? <div className="mt-1 break-all font-mono text-xs text-slate-500">{version.github_parameter_path}</div> : null}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          version.is_current ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {version.is_current ? "Current" : "Prior"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{effectiveFromDisplay(version)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-700">
                        {roboticFundSizeDisplay(roboticFundSizes[version.id])}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{version.git_commit_sha ?? "—"}</td>
                      <td className="px-3 py-2 text-sm flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(version)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <Link
                          to={`/algorithm-versions/${version.id}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                        >
                          Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(version)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => refreshResults(version.id, version.version_label)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                        >
                          View results
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedVersionId && activeTab === "list" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Training results for {selectedVersionLabel}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Click a result to inspect the metadata and visualizations.
              </p>
            </div>
            <button
              type="button"
              onClick={clearResults}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Close results
            </button>
          </div>

          <div className="mt-6">
            {resultsLoading ? (
              <p className="text-sm text-slate-500">Loading results...</p>
            ) : resultsError ? (
              <p className="text-sm text-rose-600">{resultsError}</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-slate-500">No training results found for this version.</p>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Result</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Status</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Run period</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Artifacts</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {results.map((result) => (
                      <tr key={result.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-sm text-slate-700">#{result.id}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{result.status}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {result.run_started_at ? new Date(result.run_started_at).toLocaleDateString() : "-"}
                          {result.run_completed_at ? ` → ${new Date(result.run_completed_at).toLocaleDateString()}` : ""}
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
            )}
          </div>
        </section>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default AlgorithmVersions;
