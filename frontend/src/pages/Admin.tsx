import { useEffect, useState } from "react";
import {
  addInstrument as createInstrument,
  addResolution as createResolution,
  loadInstruments,
  loadResolutions,
  removeInstrument as deleteInstrument,
  removeResolution as deleteResolution,
  resetAdminLists,
} from "../lib/dropdownValues";

function Admin() {
  const [instruments, setInstruments] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<string[]>([]);
  const [newInstrument, setNewInstrument] = useState("");
  const [newResolution, setNewResolution] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshLists();
  }, []);

  const refreshLists = async () => {
    setMessage(null);
    try {
      const [instrumentValues, resolutionValues] = await Promise.all([loadInstruments(), loadResolutions()]);
      setInstruments(instrumentValues);
      setResolutions(resolutionValues);
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to load admin values.");
    }
  };

  const addInstrument = async () => {
    const trimmed = newInstrument.trim();
    if (!trimmed || instruments.includes(trimmed)) return;
    try {
      await createInstrument(trimmed);
      setNewInstrument("");
      await refreshLists();
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to add instrument.");
    }
  };

  const addResolution = async () => {
    const trimmed = newResolution.trim();
    if (!trimmed || resolutions.includes(trimmed)) return;
    try {
      await createResolution(trimmed);
      setNewResolution("");
      await refreshLists();
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to add resolution.");
    }
  };

  const removeInstrument = async (value: string) => {
    try {
      await deleteInstrument(value);
      await refreshLists();
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to remove instrument.");
    }
  };

  const removeResolution = async (value: string) => {
    try {
      await deleteResolution(value);
      await refreshLists();
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to remove resolution.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin values</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage the instrument and resolution dropdown options used by the algorithm creation form.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Instruments</h2>
              <p className="mt-1 text-sm text-slate-500">Add or remove instrument values used in Algorithms.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const resetValues = await resetAdminLists();
                  setInstruments(resetValues.instruments);
                  setResolutions(resetValues.resolutions);
                  setMessage("Defaults restored.");
                } catch (error: any) {
                  setMessage(error?.message ?? "Unable to reset defaults.");
                }
              }}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Reset defaults
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {instruments.length === 0 ? (
              <p className="text-sm text-slate-500">No instruments are configured yet.</p>
            ) : (
              <div className="grid gap-2">
                {instruments.map((instrument) => (
                  <div key={instrument} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span>{instrument}</span>
                    <button
                      type="button"
                      onClick={() => removeInstrument(instrument)}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <input
              value={newInstrument}
              onChange={(event) => setNewInstrument(event.target.value)}
              placeholder="New instrument"
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={addInstrument}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Add
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Resolutions</h2>
            <p className="mt-1 text-sm text-slate-500">Add or remove resolution options used in Algorithms.</p>
          </div>

          <div className="mt-5 space-y-3">
            {resolutions.length === 0 ? (
              <p className="text-sm text-slate-500">No resolutions are configured yet.</p>
            ) : (
              <div className="grid gap-2">
                {resolutions.map((resolution) => (
                  <div key={resolution} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span>{resolution}</span>
                    <button
                      type="button"
                      onClick={() => removeResolution(resolution)}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <input
              value={newResolution}
              onChange={(event) => setNewResolution(event.target.value)}
              placeholder="New resolution"
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={addResolution}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Add
            </button>
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}

export default Admin;
