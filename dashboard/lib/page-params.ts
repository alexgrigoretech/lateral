import { notFound } from "next/navigation";
import type { Indicator, Meta, Statistic } from "./types";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function selectedIndicator(meta: Meta, value: string | string[] | undefined): Indicator {
  const indicator = meta.indicators.find((item) => item.indicator_code === (value ?? "SP.POP.TOTL"));
  if (!indicator) notFound();
  return indicator;
}

export const STATISTICS: { value: Statistic; label: string }[] = [
  { value: "sum_value", label: "Sum" },
  { value: "population_weighted_avg", label: "Population weighted average" },
  { value: "avg_value", label: "Average" },
  { value: "median_value", label: "Median" },
];

export function statisticOptions(indicator: Indicator) {
  return STATISTICS.filter((item) => indicator.is_additive ? item.value !== "population_weighted_avg" : item.value !== "sum_value");
}

export function selectedStatistic(indicator: Indicator, value: string | string[] | undefined): Statistic {
  const fallback = indicator.is_additive ? "sum_value" : "population_weighted_avg";
  const option = statisticOptions(indicator).find((item) => item.value === (value ?? fallback));
  return option?.value ?? fallback;
}
