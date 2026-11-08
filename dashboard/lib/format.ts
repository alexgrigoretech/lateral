import type { Country, Indicator, ValueStatus, YoyStatus } from "./types";

function compactOptions(precise: boolean): Intl.NumberFormatOptions {
  return { notation: "compact", maximumFractionDigits: precise ? 3 : 1 };
}

function currencyOptions(precise: boolean): Intl.NumberFormatOptions {
  return { ...compactOptions(precise), style: "currency", currency: "USD" };
}

function formatNumber(value: number | null | undefined, options: Intl.NumberFormatOptions): string {
  return value == null ? "Missing" : new Intl.NumberFormat("en-US", options).format(value);
}

export function compact(value: number | null | undefined, precise = false): string {
  return formatNumber(value, compactOptions(precise));
}

export function currency(value: number | null | undefined, precise = false): string {
  return formatNumber(value, currencyOptions(precise));
}

export function percent(value: number | null | undefined): string {
  if (value == null) return "Not available";
  const rounded = Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat("en-US", { signDisplay: "exceptZero", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rounded === 0 ? 0 : rounded)}%`;
}

export function share(value: number | null): string {
  return value === null ? "Not applicable" : `${(value * 100).toFixed(1)}%`;
}

export function year(value: number | null | undefined): string {
  return value == null ? "Not available" : String(value);
}

export function utc(value: string | null | undefined): string {
  if (!value) return "Not available";
  return `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(value))} UTC`;
}

export function sourceDate(value: string | null | undefined): string {
  return value ? `${value.slice(0, 10)} UTC` : "Not available";
}

export function countryLabel(country: Pick<Country, "country_name" | "country_iso3">): string {
  return `${country.country_name} (${country.country_iso3})`;
}

export function indicatorLabel(indicator: Pick<Indicator, "label">): string {
  return indicator.label;
}

function indicatorOptions(indicator: string, precise: boolean): Intl.NumberFormatOptions {
  if (indicator === "NY.GDP.PCAP.CD") return { style: "currency", currency: "USD", maximumFractionDigits: 0 };
  if (indicator.startsWith("NY.GDP.")) return currencyOptions(precise);
  if (indicator === "SP.DYN.LE00.IN") return { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return compactOptions(precise);
}

export function valueFor(indicator: string, value: number | null | undefined, precise = false): string {
  const formatted = formatNumber(value, indicatorOptions(indicator, precise));
  return value != null && indicator === "SP.DYN.LE00.IN" ? `${formatted} years` : formatted;
}

export function signed(indicator: string, value: number | null | undefined): string {
  const formatted = formatNumber(value, { ...indicatorOptions(indicator, true), signDisplay: "exceptZero" });
  return value != null && indicator === "SP.DYN.LE00.IN" ? `${formatted} years` : formatted;
}

export function describeStatus(status: ValueStatus | YoyStatus): string {
  const descriptions = {
    present: "Value present",
    null_value: "API returned a null value",
    not_returned: "API did not return this combination",
    ok: "Change available",
    prior_missing: "Prior year value is missing",
    prior_zero: "Prior year value is zero",
    current_missing: "Current year value is missing",
    first_year: "First year in the selected period",
  };
  return descriptions[status];
}
