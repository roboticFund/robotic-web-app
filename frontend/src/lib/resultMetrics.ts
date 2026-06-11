export interface SummaryMetricContext {
  algoCode?: string | null;
  isCombined?: boolean;
}

type MetricKind = "currency" | "percent" | "integer" | "number";

interface MetricDefinition {
  key: string;
  label: string;
  kind: MetricKind;
  sourceHeaders: string[];
}

const requestedMetrics: MetricDefinition[] = [
  { key: "win_rate_pct", label: "Win Rate %", kind: "percent", sourceHeaders: ["Win Rate (%)"] },
  { key: "max_drawdown_pct", label: "Max Drawdown %", kind: "percent", sourceHeaders: ["Max Drawdown (%)"] },
  { key: "max_drawdown_dollars", label: "Max Drawdown $", kind: "currency", sourceHeaders: ["Max Drawdown ($)"] },
  { key: "return_on_capital_pct", label: "Return on Capital %", kind: "percent", sourceHeaders: ["Return on Capital (%)"] },
  { key: "profit_dollars", label: "Profit $", kind: "currency", sourceHeaders: ["Final P&L"] },
  { key: "maximum_positions_held", label: "Max Positions Held", kind: "integer", sourceHeaders: ["Maximum Positions Held"] },
  { key: "monthly_win_rate_pct", label: "Monthly Win Rate %", kind: "percent", sourceHeaders: ["Monthly Win Rate (%)"] },
  { key: "weekly_win_rate_pct", label: "Weekly Win Rate %", kind: "percent", sourceHeaders: ["Weekly Win Rate (%)"] },
  { key: "annualised_return_pct", label: "Annualised Return %", kind: "percent", sourceHeaders: ["Annualised Return (%)"] },
];

const metricByKey = Object.fromEntries(requestedMetrics.map((metric) => [metric.key, metric]));
const requestedMetricKeys = requestedMetrics.map((metric) => metric.key);

const legacyMetricPriority = [
  "total_profit",
  "sharpe_ratio",
  "profit_factor",
  "max_drawdown",
  "win_rate",
  "win_rate_trade_level",
  "total_trades",
  "objective",
];

export function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function coerceValue(value: string) {
  const normalized = value.replace(/^"|"$/g, "").trim();
  if (!normalized) return "";
  const numericText = normalized.replace(/[$,%]/g, "").replace(/,/g, "");
  const numeric = Number(numericText);
  return Number.isFinite(numeric) && normalized.length < 24 ? numeric : normalized;
}

function nullDimension(value?: string) {
  const normalized = normalizeText(value);
  return !normalized || normalized === "null" || normalized === "none" || normalized === "nan";
}

function rowValue(headers: string[], row: string[], header: string) {
  const index = headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
  return index >= 0 ? row[index] : undefined;
}

function hasAdvancedMetricColumns(headers: string[]) {
  return ["Year", "Month", "Algo"].every((header) => headers.some((candidate) => normalizeHeader(candidate) === normalizeHeader(header)))
    && requestedMetrics.some((metric) => metric.sourceHeaders.some((header) => headers.some((candidate) => normalizeHeader(candidate) === normalizeHeader(header))));
}

function extractRequestedMetrics(headers: string[], row: string[]) {
  return Object.fromEntries(
    requestedMetrics
      .map((metric) => {
        const rawValue = metric.sourceHeaders
          .map((header) => rowValue(headers, row, header))
          .find((value) => value !== undefined);
        return [metric.key, rawValue === undefined ? "" : coerceValue(rawValue)] as const;
      })
      .filter(([, value]) => value !== ""),
  );
}

function advancedMetricsRow(headers: string[], rows: string[][], context?: SummaryMetricContext) {
  if (!hasAdvancedMetricColumns(headers)) return null;

  const totalRows = rows.filter((row) => nullDimension(rowValue(headers, row, "Year")) && nullDimension(rowValue(headers, row, "Month")));
  const targetAlgo = normalizeText(context?.isCombined ? "combined" : context?.algoCode);

  if (targetAlgo === "combined") {
    const combinedRows = totalRows.filter((row) => normalizeText(rowValue(headers, row, "Algo")) === "combined");
    const multiRow = combinedRows.find((row) => normalizeText(rowValue(headers, row, "Instrument")) === "multi");
    return multiRow ?? combinedRows[0] ?? null;
  }

  if (targetAlgo) {
    const algoRow = totalRows.find((row) => normalizeText(rowValue(headers, row, "Algo")) === targetAlgo);
    if (algoRow) return algoRow;
  }

  return totalRows.find((row) => (
    normalizeText(rowValue(headers, row, "Algo")) === "combined"
    && normalizeText(rowValue(headers, row, "Instrument")) === "multi"
  )) ?? totalRows[0] ?? null;
}

export function inferCsvSummary(text: string, context?: SummaryMetricContext) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return {};

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  const advancedRow = advancedMetricsRow(headers, rows, context);
  if (advancedRow) return extractRequestedMetrics(headers, advancedRow);

  const metricIndex = headers.findIndex((header) => /metric|name|stat/i.test(header));
  const valueIndex = headers.findIndex((header) => /value|result|score/i.test(header));

  if (metricIndex >= 0 && valueIndex >= 0) {
    return Object.fromEntries(
      rows
        .slice(0, 16)
        .filter((row) => row[metricIndex] && row[valueIndex] !== undefined)
        .map((row) => [row[metricIndex].trim(), coerceValue(row[valueIndex])]),
    );
  }

  const firstRow = rows[0] ?? [];
  return Object.fromEntries(
    headers
      .map((header, index) => [header, coerceValue(firstRow[index] ?? "")])
      .filter(([header, value]) => header && value !== "")
      .slice(0, 12),
  );
}

export async function inferArtifactSummary(file: File, artifactType: string, context?: SummaryMetricContext): Promise<Record<string, unknown>> {
  if (artifactType === "stats_csv") return inferCsvSummary(await file.text(), context);
  if (artifactType === "best_params_json") {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
    const params = parsed.params && typeof parsed.params === "object" ? parsed.params as Record<string, unknown> : {};
    return {
      ...(parsed.objective_name ? { objective_name: parsed.objective_name } : {}),
      ...(parsed.objective !== undefined ? { objective: parsed.objective } : {}),
      ...(parsed.best_trial_number !== undefined ? { best_trial_number: parsed.best_trial_number } : {}),
      parameter_count: Object.keys(params).length,
    };
  }
  return {};
}

export function displayMetricKey(key: string) {
  return metricByKey[key]?.label ?? key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, maximumFractionDigits = 3) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatMetricValue(key: string, value: unknown) {
  const metric = metricByKey[key];
  if (typeof value === "number") {
    if (metric?.kind === "currency") return formatCurrency(value);
    if (metric?.kind === "percent") return `${formatNumber(value, 2)}%`;
    if (metric?.kind === "integer") return Math.round(value).toLocaleString();
    return formatNumber(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function metricEntries(summary: Record<string, unknown>, limit?: number) {
  const populatedEntries = Object.entries(summary ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "");
  const requestedEntries = requestedMetricKeys
    .filter((key) => summary?.[key] !== null && summary?.[key] !== undefined && summary?.[key] !== "")
    .map((key) => [key, summary[key]] as [string, unknown]);
  const requestedSet = new Set(requestedEntries.map(([key]) => key));
  const remainingEntries = populatedEntries
    .filter(([key]) => !requestedSet.has(key))
    .sort(([left], [right]) => {
      const leftIndex = legacyMetricPriority.indexOf(left);
      const rightIndex = legacyMetricPriority.indexOf(right);
      const leftScore = leftIndex === -1 ? 100 : leftIndex;
      const rightScore = rightIndex === -1 ? 100 : rightIndex;
      return leftScore - rightScore || left.localeCompare(right);
    });

  const entries = requestedEntries.length ? [...requestedEntries, ...remainingEntries] : remainingEntries;
  return limit ? entries.slice(0, limit) : entries;
}

export function metricPreviewEntries(summary: Record<string, unknown>, limit = 3) {
  return metricEntries(summary, limit);
}
