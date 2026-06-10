import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client";

interface TrainingModel {
  id: number;
  key: string;
  name: string;
  description?: string;
  optimizer?: string;
  is_active: boolean;
}

function TrainingModels() {
  const [models, setModels] = useState<TrainingModel[]>([]);
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    key: "",
    name: "",
    description: "",
    optimizer: "",
  });

  const loadModels = () => {
    apiGet<TrainingModel[]>("/v1/training-models/")
      .then((data) => setModels(data))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (editingModelId) {
        await apiPatch(`/v1/training-models/${editingModelId}`, {
          name: formState.name,
          description: formState.description,
          optimizer: formState.optimizer,
        });
      } else {
        await apiPost("/v1/training-models/", formState);
      }
      setEditingModelId(null);
      setFormState({ key: "", name: "", description: "", optimizer: "" });
      loadModels();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (modelId: number) => {
    setError(null);
    try {
      await apiDelete(`/v1/training-models/${modelId}`);
      if (editingModelId === modelId) {
        cancelEdit();
      }
      loadModels();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (model: TrainingModel) => {
    setEditingModelId(model.id);
    setFormState({
      key: model.key,
      name: model.name,
      description: model.description ?? "",
      optimizer: model.optimizer ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingModelId(null);
    setFormState({ key: "", name: "", description: "", optimizer: "" });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{editingModelId ? "Edit training model" : "Create training model"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingModelId ? "Update the selected model configuration." : "Add a new training model profile."}
            </p>
          </div>
          {editingModelId ? (
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
            <span className="text-sm font-medium text-slate-700">Key</span>
            <input
              value={formState.key}
              onChange={(event) => setFormState({ ...formState, key: event.target.value })}
              disabled={editingModelId !== null}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={formState.name}
              onChange={(event) => setFormState({ ...formState, name: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              required
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <input
              value={formState.description}
              onChange={(event) => setFormState({ ...formState, description: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Optimizer</span>
            <input
              value={formState.optimizer}
              onChange={(event) => setFormState({ ...formState, optimizer: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
            >
              {editingModelId ? "Save changes" : "Add training model"}
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Model</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Optimizer</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Status</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {models.map((model) => (
              <tr key={model.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="text-sm font-semibold text-slate-900">{model.key}</div>
                  <div className="mt-1 text-sm text-slate-500">{model.name}</div>
                  {model.description ? <div className="mt-2 text-xs text-slate-400">{model.description}</div> : null}
                </td>
                <td className="px-3 py-2 text-sm text-slate-700">{model.optimizer ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    model.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {model.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(model)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(model.id)}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default TrainingModels;
