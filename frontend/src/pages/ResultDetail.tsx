import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL, apiGet } from "../api/client";

interface TrainingArtifact {
  id: number;
  artifact_type: string;
  file_name: string;
  s3_key: string;
  content_type: string;
  byte_size?: number | null;
}

interface TrainingResult {
  id: number;
  status: string;
  run_source: string;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  summary_json: Record<string, unknown>;
  artifacts: TrainingArtifact[];
}

function ResultDetail() {
  const { resultId } = useParams();
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultId) return;
    apiGet<TrainingResult>(`/v1/training-results/${resultId}`)
      .then((data) => setResult(data))
      .catch((err) => setError(err.message));
  }, [resultId]);

  const artifactUrl = (artifact: TrainingArtifact) => {
    const encodedKey = artifact.s3_key.split("/").map(encodeURIComponent).join("/");
    return `${API_BASE_URL}/v1/training-results/artifacts/${encodedKey}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Training Result Detail</h1>
        <p className="mt-2 text-slate-600">Inspect uploaded result metadata and view available visualizations.</p>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">{error}</div>
      ) : result ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Result metadata</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex justify-between gap-4"><span className="font-medium text-slate-600">Result ID</span><span>#{result.id}</span></div>
                <div className="flex justify-between gap-4"><span className="font-medium text-slate-600">Status</span><span>{result.status}</span></div>
                <div className="flex justify-between gap-4"><span className="font-medium text-slate-600">Run source</span><span>{result.run_source}</span></div>
                <div className="flex justify-between gap-4"><span className="font-medium text-slate-600">Started</span><span>{result.run_started_at ? new Date(result.run_started_at).toLocaleString() : "—"}</span></div>
                <div className="flex justify-between gap-4"><span className="font-medium text-slate-600">Completed</span><span>{result.run_completed_at ? new Date(result.run_completed_at).toLocaleString() : "—"}</span></div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Summary</h2>
              <div className="mt-4 grid gap-3">
                {result.summary_json && Object.keys(result.summary_json).length > 0 ? (
                  Object.entries(result.summary_json).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <span className="font-medium text-slate-500">{key}</span>
                      <span>{String(value)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No summary metrics available.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Artifacts</h2>
            {result.artifacts.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No artifacts were uploaded for this result.</p>
            ) : (
              <div className="mt-5 grid gap-5">
                {result.artifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{artifact.file_name}</p>
                        <p className="text-sm text-slate-500">{artifact.artifact_type}</p>
                        <p className="mt-1 text-sm text-slate-500">{artifact.content_type} • {artifact.byte_size ?? "—"} bytes</p>
                      </div>
                      <a
                        href={artifactUrl(artifact)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        Download
                      </a>
                    </div>
                    {artifact.content_type.startsWith("image/") ? (
                      <img
                        src={artifactUrl(artifact)}
                        alt={artifact.file_name}
                        className="mt-4 max-h-80 w-full rounded-3xl object-contain"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-slate-600">Loading result...</p>
        </div>
      )}
    </div>
  );
}

export default ResultDetail;
