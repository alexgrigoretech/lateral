import { cache } from "react";
import { PARQUET_VIEWS, query } from "./db";
import type { AvailableRow, CompletenessRow, Country, Fact, IncomeRow, Indicator, LatestRow, LineageRow, Matrix, Meta, MissingRow, Run, YoyRow } from "./types";

export class ParameterError extends Error {}

export async function validateIndicator(code: string): Promise<void> {
  const { indicators } = await getMeta();
  if (!indicators.some((indicator) => indicator.indicator_code === code)) throw new ParameterError("Unknown indicator code");
}

export async function validateCountry(iso3: string): Promise<void> {
  const { countries } = await getMeta();
  if (!countries.some((country) => country.country_iso3 === iso3)) throw new ParameterError("Unknown country code");
}

export const getMeta = cache(async (): Promise<Meta> => {
  const [runs, counts, indicators, countries] = await Promise.all([
    query<Run>("SELECT run_id, started_at, finished_at, status, source_lastupdated_max FROM run_summary ORDER BY started_at DESC, run_id DESC LIMIT 1"),
    query<Meta["counts"]>(`SELECT (SELECT count(*) FROM dim_country) AS countries,
      (SELECT count(*) FROM dim_indicator) AS indicators, count(DISTINCT year) AS years,
      min(year) AS year_min, max(year) AS year_max,
      count(*) AS fact_rows, count(*) FILTER (WHERE status = 'present') AS present,
      count(*) FILTER (WHERE is_missing) AS missing FROM fct_indicator_year`),
    query<Indicator>("SELECT * FROM dim_indicator ORDER BY CASE indicator_code WHEN 'SP.POP.TOTL' THEN 0 WHEN 'NY.GDP.MKTP.CD' THEN 1 WHEN 'NY.GDP.PCAP.CD' THEN 2 ELSE 3 END"),
    query<Country>("SELECT * FROM dim_country ORDER BY country_name"),
  ]);
  return { latest_run: runs[0] ?? null, counts: counts[0], indicators, countries };
});

export async function getCompleteness(indicatorCode?: string): Promise<{ matrices: Matrix[]; completeness: CompletenessRow[]; missing: MissingRow[] }> {
  if (indicatorCode !== undefined) await validateIndicator(indicatorCode);
  const params = indicatorCode === undefined ? [] : [indicatorCode];
  const [facts, completeness, missing, meta, years] = await Promise.all([
    query<Pick<Fact, "indicator_code" | "country_iso3" | "year" | "status" | "value"> & { country_name: string }>(`SELECT f.indicator_code, f.country_iso3, c.country_name, f.year, f.status, f.value
      FROM fct_indicator_year f JOIN dim_country c USING (country_iso3)${indicatorCode === undefined ? "" : " WHERE f.indicator_code = ?"} ORDER BY f.indicator_code, c.country_name, f.year`, params),
    query<CompletenessRow>(`SELECT r.*, c.country_name, i.label FROM rpt_completeness_by_country_indicator r
      JOIN dim_country c USING (country_iso3) JOIN dim_indicator i USING (indicator_code)${indicatorCode === undefined ? "" : " WHERE r.indicator_code = ?"} ORDER BY c.country_name, i.label`, params),
    query<MissingRow>(`SELECT * FROM rpt_missing_data${indicatorCode === undefined ? "" : " WHERE indicator_code = ?"} ORDER BY country_name, indicator_code, year`, params),
    getMeta(),
    query<{ year: number }>("SELECT DISTINCT year FROM fct_indicator_year ORDER BY year"),
  ]);
  type Cell = Matrix["rows"][number]["cells"][number];
  const byIndicator = new Map<string, Map<string, Map<number, Cell>>>();
  for (const fact of facts) {
    let byCountry = byIndicator.get(fact.indicator_code);
    if (!byCountry) {
      byCountry = new Map();
      byIndicator.set(fact.indicator_code, byCountry);
    }
    let byYear = byCountry.get(fact.country_iso3);
    if (!byYear) {
      byYear = new Map();
      byCountry.set(fact.country_iso3, byYear);
    }
    byYear.set(fact.year, { year: fact.year, status: fact.status, value: fact.value });
  }
  const matrixYears = years.map((row) => row.year);
  const matrices: Matrix[] = meta.indicators
    .filter((indicator) => indicatorCode === undefined || indicator.indicator_code === indicatorCode)
    .sort((a, b) => a.indicator_code.localeCompare(b.indicator_code))
    .map((indicator) => ({
      indicator_code: indicator.indicator_code,
      years: matrixYears,
      rows: meta.countries.map((country) => {
        const byYear = byIndicator.get(indicator.indicator_code)?.get(country.country_iso3);
        return {
          country_iso3: country.country_iso3,
          country_name: country.country_name,
          cells: matrixYears.map<Cell>((year) => byYear?.get(year) ?? { year, status: "not_returned", value: null }),
        };
      }),
    }));
  return { matrices, completeness, missing };
}

export async function getYoy(indicator: string): Promise<{ rows: YoyRow[] }> {
  await validateIndicator(indicator);
  return { rows: await query<YoyRow>(`SELECT y.*, c.country_name, i.label FROM rpt_yoy_change y
    JOIN dim_country c USING (country_iso3) JOIN dim_indicator i USING (indicator_code)
    WHERE y.indicator_code = ? ORDER BY c.country_name, y.year`, [indicator]) };
}

export async function getLatest(indicator: string): Promise<{ comparison: LatestRow[]; latest_available: AvailableRow[] }> {
  await validateIndicator(indicator);
  const [comparison, latest_available] = await Promise.all([
    query<LatestRow>(`SELECT r.*, c.country_name, c.income_level_code, c.income_level_name FROM rpt_latest_year_comparison r
      JOIN dim_country c USING (country_iso3) WHERE r.indicator_code = ? ORDER BY r.value DESC NULLS LAST, c.country_name`, [indicator]),
    query<AvailableRow>(`SELECT r.*, c.country_name FROM rpt_latest_available_per_country r
      JOIN dim_country c USING (country_iso3) WHERE r.indicator_code = ? ORDER BY c.country_name`, [indicator]),
  ]);
  return { comparison, latest_available };
}

export async function getIncomeGroups(indicator: string): Promise<{ rows: IncomeRow[]; members: Pick<Country, "country_iso3" | "country_name" | "income_level_code" | "income_level_name">[] }> {
  await validateIndicator(indicator);
  const [rows, members] = await Promise.all([
    query<IncomeRow>(`SELECT * FROM rpt_income_group_by_year WHERE indicator_code = ?
      ORDER BY CASE income_level_code WHEN 'HIC' THEN 0 WHEN 'UMC' THEN 1 ELSE 2 END, year`, [indicator]),
    query<Country>(`SELECT country_iso3, country_name, income_level_code, income_level_name FROM dim_country
      ORDER BY CASE income_level_code WHEN 'HIC' THEN 0 WHEN 'UMC' THEN 1 ELSE 2 END, country_name`),
  ]);
  return { rows, members };
}

export async function getCountry(iso3: string): Promise<{ country: Country; facts: Fact[]; yoy: YoyRow[]; lineage: LineageRow[] }> {
  await validateCountry(iso3);
  const [countries, facts, yoy, lineage] = await Promise.all([
    query<Country>("SELECT * FROM dim_country WHERE country_iso3 = ?", [iso3]),
    query<Fact>("SELECT * FROM fct_indicator_year WHERE country_iso3 = ? ORDER BY indicator_code, year", [iso3]),
    query<YoyRow>(`SELECT y.*, c.country_name, i.label FROM rpt_yoy_change y JOIN dim_country c USING (country_iso3)
      JOIN dim_indicator i USING (indicator_code) WHERE y.country_iso3 = ? ORDER BY y.indicator_code, y.year`, [iso3]),
    query<LineageRow>(`SELECT source_page_id, indicator_code, MIN(year) AS year_min, MAX(year) AS year_max,
      MAX(fetched_at) AS fetched_at, MAX(source_lastupdated) AS source_lastupdated FROM fct_indicator_year
      WHERE country_iso3 = ? AND source_page_id IS NOT NULL GROUP BY source_page_id, indicator_code ORDER BY indicator_code, source_page_id`, [iso3]),
  ]);
  const country = countries[0];
  if (!country) throw new ParameterError("Unknown country code");
  return { country, facts, yoy, lineage };
}

export async function getHealth(): Promise<{ ok: true; duckdb: string; files: number }> {
  const [version] = await query<{ library_version: string }>("SELECT library_version FROM pragma_version()");
  return { ok: true, duckdb: version.library_version, files: PARQUET_VIEWS.length };
}
