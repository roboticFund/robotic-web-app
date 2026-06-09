import { useState } from "react";
import { API_BASE_URL } from "../api/client";

function UploadResults() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setMessage("Select a file before uploading.");
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const uploadResponse = await fetch(`${API_BASE_URL}/v1/training-results/uploads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_name: file.name,
          artifact_type: "raw_result_csv",
          content_type: file.type || "text/csv",
          byte_size: file.size,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload target request failed: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      const uploadUrl = uploadData.upload_url.startsWith("/")
        ? `${API_BASE_URL}${uploadData.upload_url}`
        : uploadData.upload_url;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "text/csv",
        },
        body: file,
      });

      setMessage("File pre-signed upload created. Finalize the result metadata in a later step.");
    } catch (error: any) {
      setMessage(error?.message ?? "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Upload Results</h1>
      <p className="mt-2 text-slate-600">Upload offline result artifacts and finalize training run metadata.</p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Result file</label>
            <input type="file" onChange={handleFileChange} className="mt-2 block w-full text-sm text-slate-700" />
          </div>
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Upload File"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}

export default UploadResults;
