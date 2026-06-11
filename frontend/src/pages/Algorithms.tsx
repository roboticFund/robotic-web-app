import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client";
import { loadInstruments, loadResolutions } from "../lib/dropdownValues";
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
  instrument: string;
  resolution: string;
  is_active: boolean;
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

const emptyVersionForm = {
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

function nullableText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function nullableDateTime(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
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

function effectiveFromDisplay(version: AlgorithmVersion, state?: RoboticFundSizeState) {
  return formatDateTime(version.effective_from ?? state?.commitDate);
}

function Algorithms() {
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [editingAlgorithmId, setEditingAlgorithmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<string[]>([]);
  const [expandedAlgorithmId, setExpandedAlgorithmId] = useState<number | null>(null);
  const [versionsByAlgorithm, setVersionsByAlgorithm] = useState<Record<number, AlgorithmVersion[]>>({});
  const [versionsLoadingByAlgorithm, setVersionsLoadingByAlgorithm] = useState<Record<number, boolean>>({});
  const [roboticFundSizes, setRoboticFundSizes] = useState<Record<number, RoboticFundSizeState>>({});
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
  const [versionFormState, setVersionFormState] = useState(emptyVersionForm);
  const [formState, setFormState] = useState({
    code: "",
    name: "",
    instrument: "",
    resolution: "",
  });

  const loadAlgorithms = () => {
    apiGet<Algorithm[]>("/v1/algorithms/")
      .then((data) => setAlgorithms(data))
      .catch((err) => setError(err.message));
  };

  const loadRoboticFundSizes = async (versions: AlgorithmVersion[]) => {
    if (!versions.length) return;
    setRoboticFundSizes((current) => ({
      ...current,
      ...Object.fromEntries(versions.map((version) => [version.id, initialRoboticFundSizeState(version)])),
    }));

    const entries = await Promise.all(
      versions.map(async (version) => [version.id, await fetchRoboticFundSize(version)] as const),
    );
    setRoboticFundSizes((current) => ({
      ...current,
      ...Object.fromEntries(entries),
    }));
  };

  const loadVersionsForAlgorithm = async (algorithmId: number) => {
    setVersionsLoadingByAlgorithm((current) => ({ ...current, [algorithmId]: true }));
    try {
      const data = await apiGet<AlgorithmVersion[]>(`/v1/algorithms/${algorithmId}/versions`);
      setVersionsByAlgorithm((current) => ({ ...current, [algorithmId]: data }));
      loadRoboticFundSizes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVersionsLoadingByAlgorithm((current) => ({ ...current, [algorithmId]: false }));
    }
  };

  const toggleAlgorithm = (algorithmId: number) => {
    setExpandedAlgorithmId((current) => {
      if (current === algorithmId) {
        setEditingVersionId(null);
        setVersionFormState(emptyVersionForm);
        return null;
      }
      if (!versionsByAlgorithm[algorithmId]) {
        loadVersionsForAlgorithm(algorithmId);
      }
      return algorithmId;
    });
  };

  useEffect(() => {
    loadAlgorithms();
    Promise.all([loadInstruments(), loadResolutions()])
      .then(([instrumentValues, resolutionValues]) => {
        setInstruments(instrumentValues);
        setResolutions(resolutionValues);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (editingAlgorithmId) {
        await apiPatch(`/v1/algorithms/${editingAlgorithmId}`, {
          name: formState.name,
          instrument: formState.instrument,
          resolution: formState.resolution,
        });
      } else {
        await apiPost("/v1/algorithms/", formState);
      }
      setEditingAlgorithmId(null);
      setFormState({ code: "", name: "", instrument: "", resolution: "" });
      loadAlgorithms();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (algorithm: Algorithm) => {
    const confirmed = window.confirm(
      `Delete algorithm "${algorithm.code}"?\n\nThis will hide the algorithm and all of its versions from active frontend lists. Existing results will be kept and marked as deleted.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await apiDelete(`/v1/algorithms/${algorithm.id}`);
      if (editingAlgorithmId === algorithm.id) {
        cancelEdit();
      }
      if (expandedAlgorithmId === algorithm.id) {
        setExpandedAlgorithmId(null);
      }
      loadAlgorithms();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (algorithm: Algorithm) => {
    setEditingAlgorithmId(algorithm.id);
    setFormState({
      code: algorithm.code,
      name: algorithm.name,
      instrument: algorithm.instrument,
      resolution: algorithm.resolution,
    });
  };

  const cancelEdit = () => {
    setEditingAlgorithmId(null);
    setFormState({ code: "", name: "", instrument: "", resolution: "" });
  };

  const handleVersionEdit = (version: AlgorithmVersion) => {
    setEditingVersionId(version.id);
    setVersionFormState({
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

  const cancelVersionEdit = () => {
    setEditingVersionId(null);
    setVersionFormState(emptyVersionForm);
  };

  const handleVersionSubmit = async (event: React.FormEvent, algorithmId: number) => {
    event.preventDefault();
    if (!editingVersionId) return;
    setError(null);

    try {
      await apiPatch(`/v1/algorithm-versions/${editingVersionId}`, {
        version_label: versionFormState.version_label,
        description: nullableText(versionFormState.description),
        git_commit_sha: nullableText(versionFormState.git_commit_sha),
        github_repo_owner: nullableText(versionFormState.github_repo_owner),
        github_repo_name: nullableText(versionFormState.github_repo_name),
        github_parameter_path: nullableText(versionFormState.github_parameter_path),
        github_ref: nullableText(versionFormState.github_ref),
        effective_from: nullableDateTime(versionFormState.effective_from),
        is_current: versionFormState.is_current,
      });
      cancelVersionEdit();
      loadVersionsForAlgorithm(algorithmId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVersionDelete = async (version: AlgorithmVersion, algorithmId: number) => {
    const confirmed = window.confirm(
      `Delete version "${version.version_label}"?\n\nThis will hide it from active frontend lists. Existing results linked to it will be kept and marked as deleted.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await apiDelete(`/v1/algorithm-versions/${version.id}`);
      if (editingVersionId === version.id) {
        cancelVersionEdit();
      }
      loadVersionsForAlgorithm(algorithmId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Create algorithm</h2>
            <p className="mt-1 text-sm text-slate-500">A compact form for adding new algorithms quickly.</p>
          </div>
          {editingAlgorithmId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Code</span>
            <input
              value={formState.code}
              onChange={(event) => setFormState({ ...formState, code: event.target.value })}
              disabled={editingAlgorithmId !== null}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Name</span>
            <input
              value={formState.name}
              onChange={(event) => setFormState({ ...formState, name: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Instrument</span>
            <select
              value={formState.instrument}
              onChange={(event) => setFormState({ ...formState, instrument: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              required
            >
              <option value="">Select instrument</option>
              {instruments.map((instrument) => (
                <option key={instrument} value={instrument}>
                  {instrument}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Resolution</span>
            <select
              value={formState.resolution}
              onChange={(event) => setFormState({ ...formState, resolution: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              required
            >
              <option value="">Select resolution</option>
              {resolutions.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={!instruments.length || !resolutions.length}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {editingAlgorithmId ? "Save changes" : "Add algorithm"}
            </button>
            {!instruments.length || !resolutions.length ? (
              <p className="mt-2 text-xs text-rose-600">
                Configure instruments and resolutions in the Admin page first.
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Algorithm</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Instrument</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Resolution</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Status</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {algorithms.map((algo) => {
              const expanded = expandedAlgorithmId === algo.id;
              const versions = versionsByAlgorithm[algo.id] ?? [];
              const versionsLoading = Boolean(versionsLoadingByAlgorithm[algo.id]);

              return (
                <Fragment key={algo.id}>
                  <tr
                    onClick={() => toggleAlgorithm(algo.id)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{algo.code}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {expanded ? "Hide versions" : "Show versions"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{algo.name}</div>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{algo.instrument}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{algo.resolution}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        algo.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {algo.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="flex gap-2 px-3 py-2 text-sm">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEdit(algo);
                        }}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(algo);
                        }}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-4 py-4">
                        {versionsLoading ? (
                          <p className="text-sm text-slate-500">Loading versions...</p>
                        ) : versions.length ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="grid grid-cols-[minmax(0,1.3fr)_100px_150px_120px_minmax(0,1fr)_240px] gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                              <span>Version</span>
                              <span>Current</span>
                              <span>Effective from</span>
                              <span>Position size</span>
                              <span>Commit</span>
                              <span>Actions</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {versions.map((version) => (
                                <div key={version.id} className="px-3 py-3">
                                  {editingVersionId === version.id ? (
                                    <form onSubmit={(event) => handleVersionSubmit(event, algo.id)} className="grid gap-3 lg:grid-cols-2">
                                      <label className="block">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Version label</span>
                                        <input
                                          value={versionFormState.version_label}
                                          onChange={(event) => setVersionFormState({ ...versionFormState, version_label: event.target.value })}
                                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          required
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Git commit SHA</span>
                                        <input
                                          value={versionFormState.git_commit_sha}
                                          onChange={(event) => setVersionFormState({ ...versionFormState, git_commit_sha: event.target.value })}
                                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Effective from</span>
                                        <input
                                          type="datetime-local"
                                          value={versionFormState.effective_from}
                                          onChange={(event) => setVersionFormState({ ...versionFormState, effective_from: event.target.value })}
                                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                        />
                                      </label>
                                      <label className="block lg:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</span>
                                        <textarea
                                          value={versionFormState.description}
                                          onChange={(event) => setVersionFormState({ ...versionFormState, description: event.target.value })}
                                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          rows={2}
                                        />
                                      </label>
                                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2 lg:grid-cols-2">
                                        <div className="lg:col-span-2">
                                          <h4 className="text-sm font-semibold text-slate-900">GitHub parameter source</h4>
                                          <p className="mt-1 text-xs text-slate-500">Leave the path blank to use the backend template for this algorithm/version.</p>
                                        </div>
                                        <label className="block">
                                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Repository owner</span>
                                          <input
                                            value={versionFormState.github_repo_owner}
                                            onChange={(event) => setVersionFormState({ ...versionFormState, github_repo_owner: event.target.value })}
                                            placeholder="roboticFund"
                                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Repository name</span>
                                          <input
                                            value={versionFormState.github_repo_name}
                                            onChange={(event) => setVersionFormState({ ...versionFormState, github_repo_name: event.target.value })}
                                            placeholder="trade-engine"
                                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Parameter file path</span>
                                          <input
                                            value={versionFormState.github_parameter_path}
                                            onChange={(event) => setVersionFormState({ ...versionFormState, github_parameter_path: event.target.value })}
                                            placeholder="resources/algorithms/algo1/algo_params.py"
                                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">GitHub ref</span>
                                          <input
                                            value={versionFormState.github_ref}
                                            onChange={(event) => setVersionFormState({ ...versionFormState, github_ref: event.target.value })}
                                            placeholder="branch, tag, or commit"
                                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          />
                                        </label>
                                      </div>
                                      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={versionFormState.is_current}
                                            onChange={(event) => setVersionFormState({ ...versionFormState, is_current: event.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                                          />
                                          Mark as current
                                        </label>
                                        <div className="flex gap-2">
                                          <button type="button" onClick={cancelVersionEdit} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                            Cancel
                                          </button>
                                          <button type="submit" className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700">
                                            Save version
                                          </button>
                                        </div>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="grid grid-cols-[minmax(0,1.3fr)_100px_150px_120px_minmax(0,1fr)_240px] gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{version.version_label}</p>
                                        {version.description ? <p className="mt-1 text-sm text-slate-500">{version.description}</p> : null}
                                        {version.github_parameter_path ? <p className="mt-1 truncate font-mono text-xs text-slate-500">{version.github_parameter_path}</p> : null}
                                      </div>
                                      <div>
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                          version.is_current ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                        }`}>
                                          {version.is_current ? "Current" : "Prior"}
                                        </span>
                                      </div>
                                      <p className="text-sm text-slate-600">{effectiveFromDisplay(version, roboticFundSizes[version.id])}</p>
                                      <p className="text-sm font-semibold text-slate-700">{roboticFundSizeDisplay(roboticFundSizes[version.id])}</p>
                                      <p className="truncate text-sm text-slate-600">{version.git_commit_sha || "-"}</p>
                                      <div className="flex flex-wrap gap-2">
                                        <Link
                                          to={`/algorithm-versions/${version.id}`}
                                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                                        >
                                          Details
                                        </Link>
                                        <button
                                          type="button"
                                          onClick={() => handleVersionEdit(version)}
                                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleVersionDelete(version, algo.id)}
                                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                            No active versions found for this algorithm.
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default Algorithms;
