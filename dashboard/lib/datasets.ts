import { PARQUET_VIEWS } from "@/lib/db";

const definitions = {
  dim_country: { grain: "country", key: "country_iso3", filters: ["country"] },
  dim_indicator: { grain: "indicator", key: "indicator_code", filters: ["indicator"] },
  fct_indicator_year: { grain: "expected country, indicator and calendar year", key: "country_iso3, indicator_code, year", filters: ["indicator", "country"] },
  rpt_completeness_by_country_indicator: { grain: "country and indicator", key: "country_iso3, indicator_code", filters: ["indicator", "country"] },
  rpt_missing_data: { grain: "missing country, indicator and year", key: "country_iso3, indicator_code, year", filters: ["indicator", "country"] },
  rpt_yoy_change: { grain: "country, indicator and year (the fact grain)", key: "country_iso3, indicator_code, year", filters: ["indicator", "country"] },
  rpt_latest_year_comparison: { grain: "country and indicator", key: "country_iso3, indicator_code", filters: ["indicator", "country"] },
  rpt_latest_available_per_country: { grain: "country and indicator", key: "country_iso3, indicator_code", filters: ["indicator", "country"] },
  rpt_income_group_by_year: { grain: "indicator, income group and year", key: "indicator_code, income_level_code, year", filters: ["indicator"] },
  run_summary: { grain: "pipeline run", key: "run_id", filters: [] },
} satisfies Record<typeof PARQUET_VIEWS[number], { grain: string; key: string; filters: ("indicator" | "country")[] }>;

export const DATASETS = PARQUET_VIEWS.map((name) => ({ name, ...definitions[name] }));
export const GRAINS = Object.entries(definitions).map(([name, { grain, key }]) => [name, grain, key] as const);
