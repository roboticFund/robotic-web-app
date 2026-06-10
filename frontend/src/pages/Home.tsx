import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

interface Algorithm {
  id: number;
  code: string;
  name: string;
}

interface AlgorithmVersion {
  id: number;
  version_label: string;
  created_at?: string;
}

interface AlgorithmRow {
  id: number;
  code: string;
  name: string;
  latestVersionLabel: string;
}

function Home() {
  const [algorithms, setAlgorithms] = useState<AlgorithmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    apiGet<Algorithm[]>("/v1/algorithms/")
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Unexpected algorithm response");
        }

        return Promise.all(
          data.map(async (algorithm) => {
            const versions = await apiGet<AlgorithmVersion[]>(`/v1/algorithms/${algorithm.id}/versions`);
            const latestVersion = [...versions]
              .sort((a, b) => {
                const aTime = a.created_at ? Date.parse(a.created_at) : 0;
                const bTime = b.created_at ? Date.parse(b.created_at) : 0;
                return bTime - aTime;
              })[0];

            return {
              id: algorithm.id,
              code: algorithm.code,
              name: algorithm.name,
              latestVersionLabel: latestVersion?.version_label ?? "No versions",
            };
          })
        );
      })
      .then((rows) => setAlgorithms(rows))
      .catch((err: any) => setError(err.message || "Unable to load algorithms."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10 pt-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Algorithms and latest versions</h1>
          </div>
          <p className="text-sm text-slate-500">All active algorithms and their most recent version labels.</p>
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
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">Latest version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-center text-sm text-slate-500">Loading algorithms…</td>
                </tr>
              ) : algorithms.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-center text-sm text-slate-500">No algorithms found.</td>
                </tr>
              ) : (
                algorithms.map((algorithm) => (
                  <tr key={algorithm.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900">{algorithm.code}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{algorithm.name}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{algorithm.latestVersionLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default Home;
