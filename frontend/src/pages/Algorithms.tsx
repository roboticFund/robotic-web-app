import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

interface Algorithm {
  id: number;
  code: string;
  name: string;
  instrument: string;
  resolution: string;
  is_active: boolean;
}

function Algorithms() {
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet("/v1/algorithms/")
      .then((data) => setAlgorithms(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Algorithms</h1>
      <p className="mt-2 text-slate-600">View and manage algorithm registry metadata.</p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Instrument</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Resolution</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {algorithms.map((algo) => (
              <tr key={algo.id}>
                <td className="px-6 py-4 text-sm text-slate-700">{algo.code}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{algo.name}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{algo.instrument}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{algo.resolution}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{algo.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default Algorithms;
