export type RouteId = "health" | "meta" | "completeness" | "yoy" | "latest" | "income-groups" | "country" | "export" | "manifest";
export type Param = "indicator" | "country" | "dataset" | "format";
export type Language = "curl" | "python" | "node";
export type ExportFormat = "csv" | "parquet";

export type RouteDefinition = { id: RouteId; label: string; pattern: string; params: readonly Param[]; returns: string };
export const ROUTES: readonly RouteDefinition[] = [
  { id: "health", label: "Health", pattern: "/api/health", params: [], returns: "The health status, DuckDB version and number of Parquet views." },
  { id: "meta", label: "Metadata", pattern: "/api/meta", params: [], returns: "The latest pipeline run, row counts and year range, indicator metadata and country metadata." },
  { id: "completeness", label: "Completeness", pattern: "/api/completeness", params: [], returns: "Country and year matrices for each indicator, completeness counts and percentages, and the rows with missing values." },
  { id: "yoy", label: "Year over year", pattern: "/api/yoy?indicator=", params: ["indicator"], returns: "Rows of value, prior value, absolute and percentage change per country and year for one indicator, with the status that explains a missing change." },
  { id: "latest", label: "Latest year", pattern: "/api/latest?indicator=", params: ["indicator"], returns: "Countries compared at one indicator's latest year with rank and share of total, plus each country's latest available value and year." },
  { id: "income-groups", label: "Income groups", pattern: "/api/income-groups?indicator=", params: ["indicator"], returns: "Yearly income group statistics for one indicator, including sums, weighted averages, means, medians, ranges and counts, plus the countries in each group." },
  { id: "country", label: "Country", pattern: "/api/country/{iso3}", params: ["country"], returns: "One country's metadata, indicator facts, year over year changes and source page lineage with year ranges and source timestamps." },
  { id: "export", label: "Export", pattern: "/api/export/{dataset}?format=", params: ["dataset", "format", "indicator", "country"], returns: "CSV or Parquet for dim_country, dim_indicator, fct_indicator_year, rpt_completeness_by_country_indicator, rpt_missing_data, rpt_yoy_change, rpt_latest_year_comparison, rpt_latest_available_per_country, rpt_income_group_by_year or run_summary, with indicator and country filters only where the dataset has the column." },
  { id: "manifest", label: "Manifest", pattern: "/api/export/manifest", params: [], returns: "The export manifest: every committed export file with its path, rows, bytes, SHA-256 digest and the run that produced it." },
];
export const LANGUAGES: readonly { value: Language; label: string }[] = [
  { value: "curl", label: "curl" },
  { value: "python", label: "Python" },
  { value: "node", label: "Node" },
];
export const FORMAT_OPTIONS: readonly { value: ExportFormat; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "parquet", label: "Parquet" },
];
export const DEFAULT_ORIGIN = "https://lateral.analyticslab.ro";

export type Selection = { route: RouteId; indicator: string; country: string; dataset: string; format: ExportFormat };
export type PlaygroundOptions = {
  indicators: { value: string; label: string }[];
  countries: { value: string; label: string }[];
  datasets: { value: string; label: string; filters: ("indicator" | "country")[] }[];
  manifest: Record<string, string>;
};

export type BuiltRequest = { path: string; url: string };

export function buildRequest(selection: Selection, origin: string, options: PlaygroundOptions): BuiltRequest {
  let path = `/api/${selection.route}`;
  const params = new URLSearchParams();
  if (selection.route === "country") path += `/${encodeURIComponent(selection.country)}`;
  else if (selection.route === "manifest") path = "/api/export/manifest";
  else if (selection.route === "export") {
    path += `/${encodeURIComponent(selection.dataset)}`;
    params.set("format", selection.format);
    const dataset = options.datasets.find((item) => item.value === selection.dataset);
    for (const filter of ["indicator", "country"] as const) {
      if (dataset?.filters.includes(filter) && selection[filter] !== "") params.set(filter, selection[filter]);
    }
  } else if (["yoy", "latest", "income-groups"].includes(selection.route)) params.set("indicator", selection.indicator);
  if (params.size) path += `?${params}`;
  return { path, url: origin.replace(/\/$/, "") + path };
}

export function snippet(language: Language, request: BuiltRequest, selection: Selection): string {
  const url = JSON.stringify(request.url);
  const isExport = selection.route === "export";
  const params = isExport ? new URL(request.url).searchParams : new URLSearchParams();
  const filename = [selection.dataset, params.get("indicator"), params.get("country"), selection.format].filter((part) => part !== null).join(".");
  if (language === "curl") return `curl${isExport ? " --fail" : ""} ${url}${isExport ? ` -o ${filename}` : ""}`;
  if (language === "python") {
    if (isExport && selection.format === "parquet") return [
      "import urllib.request",
      `with urllib.request.urlopen(${url}) as res:`,
      `    with open(${JSON.stringify(filename)}, "wb") as file:`,
      "        file.write(res.read())",
    ].join("\n");
    return [
      isExport ? "import urllib.request" : "import json, urllib.request",
      `with urllib.request.urlopen(${url}) as res:`,
      isExport ? "    print(res.read().decode())" : "    print(json.load(res))",
    ].join("\n");
  }
  if (isExport && selection.format === "parquet") return [
    'import { writeFile } from "node:fs/promises";',
    `const res = await fetch(${url});`,
    'if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);',
    `await writeFile(${JSON.stringify(filename)}, Buffer.from(await res.arrayBuffer()));`,
  ].join("\n");
  return [
    `const res = await fetch(${url});`,
    ...(isExport ? ['if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);'] : []),
    `const data = await res.${isExport ? "text" : "json"}();`,
    "console.log(data);",
  ].join("\n");
}

export type RunResult = {
  ok: boolean; status: number; statusText: string; contentType: string; elapsedMs: number; sizeLabel: string;
  kind: "json" | "text" | "parquet";
  body: string;
  truncatedNote: string | null;
  digest: string | null;
  manifest: "match" | "mismatch" | "filtered" | "none";
  manifestLabel: string;
};

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  404: "Not Found",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export async function runRequest(request: BuiltRequest, selection: Selection, options: PlaygroundOptions): Promise<RunResult> {
  const started = performance.now();
  try {
    const response = await fetch(request.url);
    const buffer = await response.arrayBuffer();
    const elapsedMs = Math.round(performance.now() - started);
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const result: RunResult = {
      ok: response.ok, status: response.status, statusText: response.statusText || STATUS_TEXT[response.status] || "", contentType, elapsedMs, sizeLabel: sizeLabel(buffer.byteLength),
      kind: "text", body: "", truncatedNote: null, digest: null, manifest: "none", manifestLabel: "No manifest entry",
    };
    if (contentType === "application/vnd.apache.parquet" || contentType === "application/x-parquet" || (contentType === "application/octet-stream" && new TextDecoder().decode(buffer.slice(0, 4)) === "PAR1")) {
      result.kind = "parquet";
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) {
        result.manifestLabel = "Digest unavailable outside a secure context";
        return result;
      }
      const hash = await subtle.digest("SHA-256", buffer);
      result.digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const params = new URL(request.url).searchParams;
      if (params.has("indicator") || params.has("country")) {
        result.manifest = "filtered";
        result.manifestLabel = "Filtered download, no manifest digest";
      } else if (options.manifest[selection.dataset]) {
        result.manifest = result.digest === options.manifest[selection.dataset] ? "match" : "mismatch";
        result.manifestLabel = result.manifest === "match" ? "Matches the committed file" : "Does not match the committed file";
      }
      return result;
    }
    let body = new TextDecoder().decode(buffer);
    if (contentType === "application/json" || contentType.endsWith("+json")) {
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
        result.kind = "json";
      } catch {
        result.kind = "text";
      }
    }
    const lines = body.split(/\r?\n/);
    result.body = lines.length > 200 ? lines.slice(0, 200).join("\n") : body;
    if (lines.length > 200) result.truncatedNote = `Showing the first 200 of ${lines.length.toLocaleString("en-US")} lines`;
    return result;
  } catch (error) {
    return {
      ok: false, status: 0, statusText: "Network error", contentType: "", elapsedMs: Math.round(performance.now() - started), sizeLabel: "0 B",
      kind: "text", body: error instanceof Error ? error.message : String(error), truncatedNote: null, digest: null, manifest: "none", manifestLabel: "No manifest entry",
    };
  }
}
