import { Fragment, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client";
import { loadInstruments, loadResolutions } from "../lib/dropdownValues";

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
  version_label: string;
  description?: string;
  parameter_set_json?: Record<string, unknown>;
  git_commit_sha?: string;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
}

const emptyVersionForm = {
  version_label: "",
  description: "",
  git_commit_sha: "",
  is_current: false,
  parameter_set_json: "{}",
};

function Algorithms() {
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [editingAlgorithmId, setEditingAlgorithmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<string[]>([]);
  const [expandedAlgorithmId, setExpandedAlgorithmId] = useState<number | null>(null);
  const [versionsByAlgorithm, setVersionsByAlgorithm] = useState<Record<number, AlgorithmVersion[]>>({});
  const [versionsLoadingByAlgorithm, setVersionsLoadingByAlgorithm] = useState<Record<number, boolean>>({});
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

  const loadVersionsForAlgorithm = async (algorithmId: number) => {
    setVersionsLoadingByAlgorithm((current) => ({ ...current, [algorithmId]: true }));
    try {
      const data = await apiGet<AlgorithmVersion[]>(`/v1/algorithms/${algorithmId}/versions`);
      setVersionsByAlgorithm((current) => ({ ...current, [algorithmId]: data }));
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
      is_current: version.is_current,
      parameter_set_json: JSON.stringify(version.parameter_set_json ?? {}, null, 2),
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

    let parameterSetJson: Record<string, unknown> = {};
    try {
      parameterSetJson = JSON.parse(versionFormState.parameter_set_json || "{}") as Record<string, unknown>;
    } catch {
      setError("Parameter set JSON must be valid JSON.");
      return;
    }

    try {
      await apiPatch(`/v1/algorithm-versions/${editingVersionId}`, {
        version_label: versionFormState.version_label,
        description: versionFormState.description || undefined,
        git_commit_sha: versionFormState.git_commit_sha || undefined,
        is_current: versionFormState.is_current,
        parameter_set_json: parameterSetJson,
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
                            <div className="grid grid-cols-[minmax(0,1.5fr)_110px_minmax(0,1fr)_190px] gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                              <span>Version</span>
                              <span>Current</span>
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
                                      <label className="block lg:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</span>
                                        <textarea
                                          value={versionFormState.description}
                                          onChange={(event) => setVersionFormState({ ...versionFormState, description: event.target.value })}
                                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                          rows={2}
                                        />
                                      </label>
                                      <label className="block lg:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Parameter set JSON</span>
                                        <textarea
                                          value={versionFormState.parameter_set_json}
                                          onChange={(event) => setVersionFormState({ ...versionFormState, parameter_set_json: event.target.value })}
                                          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                        />
                                      </label>
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
                                    <div className="grid grid-cols-[minmax(0,1.5fr)_110px_minmax(0,1fr)_190px] gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{version.version_label}</p>
                                        {version.description ? <p className="mt-1 text-sm text-slate-500">{version.description}</p> : null}
                                      </div>
                                      <div>
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                          version.is_current ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                        }`}>
                                          {version.is_current ? "Current" : "Prior"}
                                        </span>
                                      </div>
                                      <p className="truncate text-sm text-slate-600">{version.git_commit_sha || "-"}</p>
                                      <div className="flex flex-wrap gap-2">
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
