import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../api/client";

function ResultDetail() {
  const { resultId } = useParams();
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultId) return;
    apiGet(`/v1/training-results/${resultId}`)
      .then((data) => setResult(data))
      .catch((err) => setError(err.message));
  }, [resultId]);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Training Result Detail</h1>
      <p className="mt-2 text-slate-600">Inspect uploaded result metadata and artifacts.</p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : result ? (
          <pre className="whitespace-pre-wrap text-sm text-slate-700">{JSON.stringify(result, null, 2)}</pre>
        ) : (
          <p className="text-slate-600">Loading result...</p>
        )}
      </div>
    </div>
  );
}

export default ResultDetail;
