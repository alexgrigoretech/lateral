export type ValueStatus = "present" | "null_value" | "not_returned";
export type YoyStatus = "ok" | "prior_missing" | "prior_zero" | "current_missing" | "first_year";
export type IncomeCode = "HIC" | "UMC" | "LMC";
export type Statistic = "sum_value" | "population_weighted_avg" | "avg_value" | "median_value";

export interface Country {
  country_iso3: string;
  country_iso2: string;
  country_name: string;
  income_level_code: IncomeCode;
  income_level_name: string;
  region_code: string;
  region_name: string;
  lending_type: string;
  capital_city: string | null;
  latitude: number | null;
  longitude: number | null;
  source_page_id: string;
}

export interface Indicator {
  indicator_code: string;
  name: string;
  unit: string;
  label: string;
  category: "population" | "economy" | "health";
  is_additive: boolean;
  source_note: string;
  source_organization: string;
  source_page_id: string;
}

export interface Run {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  source_lastupdated_max: string | null;
}

export interface Meta {
  latest_run: Run | null;
  counts: { countries: number; indicators: number; years: number; year_min: number | null; year_max: number | null; fact_rows: number; present: number; missing: number };
  indicators: Indicator[];
  countries: Country[];
}

export interface Fact {
  country_iso3: string;
  indicator_code: string;
  year: number;
  value: number | null;
  status: ValueStatus;
  is_missing: boolean;
  source_page_id: string | null;
  source_row_index: number | null;
  source_lastupdated: string | null;
  fetched_at: string | null;
  loaded_at: string | null;
}

export interface Matrix {
  indicator_code: string;
  years: number[];
  rows: { country_iso3: string; country_name: string; cells: { year: number; status: ValueStatus; value: number | null }[] }[];
}

export interface CompletenessRow {
  country_iso3: string;
  country_name: string;
  indicator_code: string;
  label: string;
  expected_years: number;
  present_years: number;
  missing_years: number;
  completeness_pct: number;
  first_year_present: number | null;
  last_year_present: number | null;
}

export interface MissingRow {
  country_iso3: string;
  country_name: string;
  indicator_code: string;
  label: string;
  year: number;
  status: ValueStatus;
}

export interface YoyRow {
  country_iso3: string;
  country_name: string;
  indicator_code: string;
  label: string;
  year: number;
  value: number | null;
  prior_year: number | null;
  prior_value: number | null;
  abs_change: number | null;
  pct_change: number | null;
  yoy_status: YoyStatus;
}

export interface LatestRow {
  country_iso3: string;
  country_name: string;
  income_level_code: IncomeCode;
  income_level_name: string;
  indicator_code: string;
  year: number;
  value: number | null;
  rank: number | null;
  share_of_total: number | null;
}

export interface AvailableRow {
  country_iso3: string;
  country_name: string;
  indicator_code: string;
  year: number | null;
  value: number | null;
}

export interface IncomeRow {
  indicator_code: string;
  income_level_code: IncomeCode;
  income_level: string;
  year: number;
  country_count: number;
  countries_present: number;
  sum_value: number | null;
  avg_value: number | null;
  median_value: number | null;
  population_weighted_avg: number | null;
  min_value: number | null;
  max_value: number | null;
}

export interface LineageRow {
  source_page_id: string;
  indicator_code: string;
  year_min: number;
  year_max: number;
  fetched_at: string | null;
  source_lastupdated: string | null;
}
