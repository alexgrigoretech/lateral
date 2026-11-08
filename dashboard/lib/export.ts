import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DATASETS } from "@/lib/datasets";
import { execute } from "@/lib/db";
import { ParameterError, validateCountry, validateIndicator } from "@/lib/queries";

export type ExportFormat = "csv" | "parquet";
export const FORMATS: { value: ExportFormat; label: string; extension: string; contentType: string }[] = [
  { value: "csv", label: "CSV", extension: "csv", contentType: "text/csv; charset=utf-8" },
  { value: "parquet", label: "Parquet", extension: "parquet", contentType: "application/vnd.apache.parquet" },
];

type Filters = { indicator?: string; country?: string };
export type Manifest = { run_id: string; exported_at: string; generator: string; files: { path: string; format: string; rows: number | null; bytes: number; sha256: string }[] };

export function exportHref(dataset: string, format: ExportFormat, filters: Filters = {}): string {
  const params = new URLSearchParams({ format });
  if (filters.indicator !== undefined) params.set("indicator", filters.indicator);
  if (filters.country !== undefined) params.set("country", filters.country);
  return `/api/export/${dataset}?${params}`;
}

export function exportFilename(dataset: string, format: ExportFormat, filters: Filters = {}): string {
  const extension = FORMATS.find((item) => item.value === format)!.extension;
  return [dataset, filters.indicator, filters.country, extension].filter((part) => part !== undefined).join(".");
}

export async function exportFile(dataset: string, format: string, filters: Filters): Promise<{ body: Uint8Array<ArrayBuffer>; filename: string; contentType: string }> {
  const definition = DATASETS.find((item) => item.name === dataset);
  if (!definition) throw new ParameterError("Unknown dataset");
  const selectedFormat = FORMATS.find((item) => item.value === format);
  if (!selectedFormat) throw new ParameterError("Format must be csv or parquet");
  const allowedFilters: readonly string[] = definition.filters;
  for (const filter of ["indicator", "country"] as const) {
    if (filters[filter] !== undefined && !allowedFilters.includes(filter)) throw new ParameterError(`This dataset cannot be filtered by ${filter}`);
  }
  if (filters.indicator !== undefined) await validateIndicator(filters.indicator);
  if (filters.country !== undefined) await validateCountry(filters.country);
  const filename = exportFilename(dataset, selectedFormat.value, filters);
  const contentType = selectedFormat.contentType;
  if (format === "parquet" && filters.indicator === undefined && filters.country === undefined) {
    return { body: await readFile(path.join(process.cwd(), "data", `${dataset}.parquet`)), filename, contentType };
  }
  const file = path.join(/* turbopackIgnore: true */ os.tmpdir(), `${randomUUID()}.${selectedFormat.extension}`);
  const literal = file.replaceAll("\\", "/").replaceAll("'", "''");
  const conditions: string[] = [];
  // Filter values are inlined only after validation against the known codes in meta.
  if (filters.indicator !== undefined) conditions.push(`indicator_code = '${filters.indicator.replaceAll("'", "''")}'`);
  if (filters.country !== undefined) conditions.push(`country_iso3 = '${filters.country.replaceAll("'", "''")}'`);
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const order = dataset === "run_summary" ? "run_id" : "ALL";
  const options = format === "csv" ? "FORMAT csv, HEADER true, NULL ''" : "FORMAT parquet, COMPRESSION zstd";
  try {
    await execute(`COPY (SELECT * FROM ${dataset}${where} ORDER BY ${order}) TO '${literal}' (${options})`);
    return { body: await readFile(/* turbopackIgnore: true */ file), filename, contentType };
  } finally {
    await unlink(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.error("Temp export file not removed", file, error);
    });
  }
}

export async function readManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(path.join(process.cwd(), "data", "manifest.json"), "utf8")) as Manifest;
}
