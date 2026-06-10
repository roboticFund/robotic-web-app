import { useEffect, useState } from "react";
import { API_BASE_URL, apiGet, apiPost } from "../api/client";

interface Algorithm {
  id: number;
  code: string;
  name: string;
}

interface AlgorithmVersion {
  id: number;
  version_label: string;
}

interface TrainingModel {
  id: number;
  key: string;
  name: string;
}

interface UploadResponse {
  object_key: string;
  upload_url: string;
  expires_in_seconds: number;
  storage_type: "local" | "s3";
}

const artifactTypes = [
  { value: "stats_csv", label: "Stats CSV" },
  { value: "analysis_html", label: "Analysis HTML" },
  { value: "analysis_png", label: "Analysis PNG" },
  { value: "raw_result_csv", label: "Raw result CSV" },
  { value: "best_params_json", label: "Best params JSON" },
  { value: "other", label: "Other" },
];

async function calculateSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function UploadResults() {
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [versions, setVersions] = useState<AlgorithmVersion[]>([]);
  const [models, setModels] = useState<TrainingModel[]>([]);
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [artifactType, setArtifactType] = useState("analysis_html");
  const [runSource, setRunSource] = useState("offline_upload");
  const [status, setStatus] = useState("completed");
  const [summaryJson, setSummaryJson] = useState("{}");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    apiGet<Algorithm[]>("/v1/algorithms/")
      .then((data) => setAlgorithms(data))
      .catch((err) => setMessage(err.message));
    apiGet<TrainingModel[]>("/v1/training-models/")
      .then((data) => setModels(data))
      .catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    if (!selectedAlgorithmId) {
      setVersions([]);
      setSelectedVersionId(null);
      return;
    }
    apiGet<AlgorithmVersion[]>(`/v1/algorithms/${selectedAlgorithmId}/versions`)
      .then((data) => setVersions(data))
      .catch((err) => setMessage(err.message));
  }, [selectedAlgorithmId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !selectedVersionId) {
      setMessage("Select a result file and algorithm version before uploading.");
      return;
    }

    let summary = {};
    try {
      summary = summaryJson ? JSON.parse(summaryJson) : {};
    } catch (error) {
      setMessage("Summary JSON is invalid.");
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const uploadData = await apiPost<UploadResponse>("/v1/training-results/uploads", {
        file_name: file.name,
        artifact_type: artifactType,
        content_type: file.type || "application/octet-stream",
        byte_size: file.size,
      });
      const uploadUrl = uploadData.upload_url.startsWith("/")
        ? `${API_BASE_URL}${uploadData.upload_url}`
        : uploadData.upload_url;

      const checksumSha256 = await calculateSha256(file);
      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        credentials: uploadData.storage_type === "local" ? "include" : "omit",
        body: file,
      });
      if (!uploadResult.ok) {
        throw new Error(`Artifact upload failed: ${uploadResult.status}`);
      }

      await apiPost("/v1/training-results/", {
        algo_version_id: selectedVersionId,
        model_id: selectedModelId,
        run_source: runSource,
        status,
        summary_json: summary,
        chart_series_json: {},
        artifacts: [
          {
            artifact_type: artifactType,
            file_name: file.name,
            s3_key: uploadData.object_key,
            content_type: file.type || "application/octet-stream",
            byte_size: file.size,
            checksum_sha256: checksumSha256,
          },
        ],
      });

      setMessage("Training result uploaded and linked to the selected algorithm version.");
      setFile(null);
      setSelectedModelId(null);
      setSelectedVersionId(null);
      setSummaryJson("{}");
    } catch (error: any) {
      setMessage(error?.message ?? "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-800 bg-[#0f102d]/90 p-8 text-slate-100 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold text-white">Upload Training Results</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
          Upload a result artifact and link it to a specific algorithm version.
        </p>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Algorithm</span>
              <select
                value={selectedAlgorithmId ?? ""}
                onChange={(event) => setSelectedAlgorithmId(Number(event.target.value) || null)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                required
              >
                <option value="">Select an algorithm</option>
                {algorithms.map((algorithm) => (
                  <option key={algorithm.id} value={algorithm.id}>
                    {algorithm.code} — {algorithm.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Algorithm version</span>
              <select
                value={selectedVersionId ?? ""}
                onChange={(event) => setSelectedVersionId(Number(event.target.value) || null)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                required
              >
                <option value="">Select a version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Training model</span>
              <select
                value={selectedModelId ?? ""}
                onChange={(event) => setSelectedModelId(Number(event.target.value) || null)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">None</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.key} — {model.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Artifact type</span>
              <select
                value={artifactType}
                onChange={(event) => setArtifactType(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              >
                {artifactTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Run source</span>
              <input
                value={runSource}
                onChange={(event) => setRunSource(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Summary JSON</span>
            <textarea
              value={summaryJson}
              onChange={(event) => setSummaryJson(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              rows={4}
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700">Result file</label>
            <input type="file" onChange={handleFileChange} className="mt-2 block w-full text-sm text-slate-700" required />
          </div>

          <button
            type="submit"
            disabled={isUploading || !selectedVersionId || !file}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Upload Results"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}

export default UploadResults;
