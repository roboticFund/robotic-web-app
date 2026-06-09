import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet("/v1/training-models/")
      .then((data) => setModels(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Training Models</h1>
      <p className="mt-2 text-slate-600">Define and re-use optimization and training configurations.</p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Key</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Optimizer</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {models.map((model) => (
              <tr key={model.id}>
                <td className="px-6 py-4 text-sm text-slate-700">{model.key}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{model.name}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{model.optimizer ?? "—"}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{model.is_active ? "Active" : "Inactive"}</td>
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
