import { apiDelete, apiGet, apiPost } from "../api/client";

export const defaultInstruments = ["EURUSD", "BTCUSD", "AAPL", "ETHUSD"];
export const defaultResolutions = ["1m", "5m", "1h", "1d"];

interface AdminOption {
  id: number;
  option_type: "instrument" | "resolution";
  value: string;
}

interface AdminOptionResetResponse {
  instruments: string[];
  resolutions: string[];
}

function valuesFromOptions(options: AdminOption[], fallback: string[]) {
  return options.length ? options.map((option) => option.value) : fallback;
}

export async function loadInstruments() {
  const options = await apiGet<AdminOption[]>("/v1/admin/options/instrument");
  return valuesFromOptions(options, defaultInstruments);
}

export async function loadResolutions() {
  const options = await apiGet<AdminOption[]>("/v1/admin/options/resolution");
  return valuesFromOptions(options, defaultResolutions);
}

export async function addInstrument(value: string) {
  await apiPost<AdminOption>("/v1/admin/options", { option_type: "instrument", value });
}

export async function addResolution(value: string) {
  await apiPost<AdminOption>("/v1/admin/options", { option_type: "resolution", value });
}

export async function removeInstrument(value: string) {
  await apiDelete<AdminOption>(`/v1/admin/options/instrument/${encodeURIComponent(value)}`);
}

export async function removeResolution(value: string) {
  await apiDelete<AdminOption>(`/v1/admin/options/resolution/${encodeURIComponent(value)}`);
}

export async function resetAdminLists() {
  return apiPost<AdminOptionResetResponse>("/v1/admin/options/reset", {});
}
