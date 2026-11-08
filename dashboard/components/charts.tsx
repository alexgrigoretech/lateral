"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { describeStatus, percent, share, valueFor, year } from "@/lib/format";
import { EMPHASIS, INCOME_ORDER, INK, SERIES, SURFACE } from "@/lib/tokens";
import type { Fact, IncomeRow, Indicator, LatestRow, Statistic, YoyRow } from "@/lib/types";

const tickStyle = { fill: INK[1], fontSize: 12 };

type Point = { year: number; [key: string]: number | null };

function numeric(value: unknown, formatter: (value: number) => string): string {
  return typeof value === "number" ? formatter(value) : "Missing";
}

function chartPoints<T extends { year: number }>(rows: T[], key: (row: T) => string, value: (row: T) => number | null): Point[] {
  const points = new Map<number, Point>();
  for (const row of rows) {
    const point = points.get(row.year) ?? { year: row.year };
    point[key(row)] = value(row);
    points.set(row.year, point);
  }
  return Array.from(points.values()).sort((a, b) => a.year - b.year);
}

export function YoyChart({ rows, focus, defaultCountryName }: { rows: YoyRow[]; focus: string | null; defaultCountryName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const countries = Array.from(new Map(rows.map((row) => [row.country_iso3, row.country_name])));
  const points = chartPoints(rows, (row) => row.country_iso3, (row) => row.pct_change);
  function select(iso3: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (focus === iso3) params.set("focus", "none");
    else params.set("focus", iso3);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }
  return <div className="chart">
    <h2 className="chart__title">All countries</h2>
    <figure className="chart__body" aria-label="Year over year percentage changes by country. The values and statuses are in the table below.">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={points} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
          <CartesianGrid strokeWidth={0.5} vertical={false} />
          <XAxis dataKey="year" tickFormatter={year} tick={tickStyle} />
          <YAxis domain={[(min: number) => Math.floor(min), (max: number) => Math.ceil(max)]} tickCount={5} tickFormatter={(value: number) => value === 0 ? "0%" : `${value > 0 ? "+" : ""}${value}%`} tick={tickStyle} width={80} />
          <ReferenceLine y={0} stroke="var(--ink-3)" strokeDasharray="3 3" />
          <Tooltip cursor={{ strokeWidth: 1 }} formatter={(value) => numeric(value, percent)} labelFormatter={(value) => `Year ${value}`} itemSorter={(item) => -(Number(item.value) || 0)} />
          {[...countries].sort(([a], [b]) => Number(a === focus) - Number(b === focus)).map(([iso3, name]) => <Line key={iso3} dataKey={iso3} name={name} type="linear" stroke={iso3 === focus ? "var(--accent)" : "var(--series-muted)"} strokeWidth={iso3 === focus ? 2.5 : 1.5} isAnimationActive={false} dot={false} activeDot={{ r: 4 }} connectNulls={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </figure>
    <p className="section__note">{defaultCountryName ? `${defaultCountryName} is emphasized by default.` : "No country has an available change in the latest year."} Select a country in the legend to emphasize its line. Missing changes leave a gap.</p>
    <div className="chart__legend" role="group" aria-label="Emphasize a country">{countries.map(([iso3, name]) => <button type="button" key={iso3} aria-pressed={iso3 === focus} onClick={() => select(iso3)}>{name}{iso3 === focus ? " (focused)" : ""}</button>)}</div>
  </div>;
}

type ValueChartProps = { indicator: Indicator; title: string; domain?: [number, number] } & (
  { metric: "value"; rows: Pick<Fact, "year" | "value" | "status">[] } |
  { metric: "pct_change"; rows: Pick<YoyRow, "year" | "pct_change" | "yoy_status">[] }
);

export function ValueChart(props: ValueChartProps) {
  const { indicator, title, domain, metric } = props;
  const rows = props.metric === "pct_change"
    ? props.rows.map((row) => ({ year: row.year, value: row.pct_change, status: describeStatus(row.yoy_status) }))
    : props.rows.map((row) => ({ year: row.year, value: row.value, status: describeStatus(row.status) }));
  const formatValue = (value: number) => metric === "pct_change" ? percent(value) : valueFor(indicator.indicator_code, value);
  const metricLabel = metric === "pct_change" ? "Percentage change" : "Value";
  const latest = rows.length ? rows.reduce((a, b) => a.year > b.year ? a : b) : undefined;
  return <div className="chart">
    <h3 className="chart__title">{title}</h3>
    <figure className="chart__body" aria-label={`${title}. ${metricLabel} by year is in the accompanying table.`}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeWidth={0.5} vertical={false} />
          <XAxis dataKey="year" tickFormatter={year} tick={tickStyle} minTickGap={20} />
          <YAxis domain={domain ?? (metric === "pct_change" || indicator.indicator_code === "SP.DYN.LE00.IN" ? ["auto", "auto"] : [0, "auto"])} tickFormatter={formatValue} tick={tickStyle} width={90} />
          {metric === "pct_change" && <ReferenceLine y={0} stroke="var(--ink-3)" strokeDasharray="3 3" />}
          <Tooltip cursor={{ strokeWidth: 1 }} formatter={(value) => numeric(value, formatValue)} labelFormatter={(value) => `Year ${value}`} />
          <Line dataKey="value" name={metric === "pct_change" ? "Percentage change" : indicator.label} type="linear" stroke={EMPHASIS} strokeWidth={2} isAnimationActive={false} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
          {latest && latest.value !== null && <ReferenceDot x={latest.year} y={latest.value} r={4} fill={EMPHASIS} stroke={SURFACE} />}
        </LineChart>
      </ResponsiveContainer>
    </figure>
    <table className="visually-hidden"><caption>{title}, {metricLabel.toLowerCase()} by year</caption><thead><tr><th scope="col">Year</th><th scope="col">{metricLabel}</th><th scope="col">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.year}><th scope="row">{row.year}</th><td>{row.value === null ? row.status : formatValue(row.value)}</td><td>{row.status}</td></tr>)}</tbody></table>
  </div>;
}

export function LatestChart({ rows, indicator }: { rows: LatestRow[]; indicator: Indicator }) {
  const caption = `Latest comparable values${indicator.is_additive ? " and shares of the selected country total" : ""}`;
  return <div className="chart">
    <h2 className="chart__title">{indicator.indicator_code === "SP.DYN.LE00.IN" ? "Country ranking, years" : "Country ranking"}</h2>
    <figure className="chart__body" aria-label="Countries ranked by value, largest first. Exact values and shares are in the table below.">
      <ResponsiveContainer width="100%" height={Math.max(280, rows.length * 48)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
          <CartesianGrid strokeWidth={0.5} horizontal={false} />
          <XAxis type="number" tickFormatter={(value: number) => indicator.indicator_code === "SP.DYN.LE00.IN" ? value.toFixed(0) : valueFor(indicator.indicator_code, value)} tick={tickStyle} />
          <YAxis type="category" dataKey="country_name" width={110} tick={tickStyle} />
          <Tooltip formatter={(value) => numeric(value, (item) => valueFor(indicator.indicator_code, item))} />
          <Bar dataKey="value" name={indicator.label} fill={EMPHASIS} isAnimationActive={false} maxBarSize={26}>
            <LabelList dataKey="value" position="right" formatter={(value: unknown) => numeric(value, (item) => valueFor(indicator.indicator_code, item))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}><table className="data-table"><caption>{caption}</caption><thead><tr><th scope="col" className="num">Rank</th><th scope="col">Country</th><th scope="col">Income group</th><th scope="col" className="num">Year</th><th scope="col" className="num">Value</th>{indicator.is_additive && <th scope="col" className="num">Share of selected total</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.country_iso3}><td className="num">{row.rank ?? "Not ranked"}</td><th scope="row"><Link href={`/country/${row.country_iso3}`}>{row.country_name}</Link></th><td>{row.income_level_name}</td><td className="num">{row.year}</td><td className="num">{valueFor(indicator.indicator_code, row.value, true)}</td>{indicator.is_additive && <td className="num">{share(row.share_of_total)}</td>}</tr>)}</tbody></table></div>
  </div>;
}

export function IncomeChart({ rows, indicator, statistic, statisticLabel }: { rows: IncomeRow[]; indicator: Indicator; statistic: Statistic; statisticLabel: string }) {
  const points = chartPoints(rows, (row) => row.income_level_code, (row) => row[statistic]);
  const names = new Map(rows.map((row) => [row.income_level_code, row.income_level]));
  const counts = new Map(rows.map((row) => [row.income_level_code, row.country_count]));
  const caption = `${statisticLabel} and country coverage within the selected sample`;
  return <div className="chart">
    <h2 className="chart__title">{statisticLabel} by income group</h2>
    {statistic === "sum_value" && <p className="section__note">Sums cover different numbers of countries (see legend). Use average or median to compare groups of different size.</p>}
    <figure className="chart__body" aria-label={`${indicator.label}, ${statisticLabel.toLowerCase()} by income group. Values and coverage are in the table below.`}>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={points} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
          <CartesianGrid strokeWidth={0.5} vertical={false} />
          <XAxis dataKey="year" tickFormatter={year} tick={tickStyle} />
          <YAxis tickFormatter={(value: number) => valueFor(indicator.indicator_code, value)} tick={tickStyle} width={100} />
          <Tooltip cursor={{ strokeWidth: 1 }} formatter={(value) => numeric(value, (item) => valueFor(indicator.indicator_code, item))} labelFormatter={(value) => `Year ${value}`} />
          {INCOME_ORDER.map((code, index) => <Line key={code} dataKey={code} name={names.get(code) ?? code} type="linear" stroke={SERIES[index]} strokeDasharray={code === "UMC" ? "6 3" : code === "LMC" ? "2 2" : undefined} strokeWidth={2} isAnimationActive={false} dot={false} activeDot={{ r: 4 }} connectNulls={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </figure>
    <ul className="chart__legend">{INCOME_ORDER.map((code) => {
      const count = counts.get(code);
      return <li key={code} className={`chart__legend-item chart__legend-item--${code.toLowerCase()}`}>{names.get(code) ?? code} ({code}), {count === undefined ? "country count unavailable" : `${count} ${count === 1 ? "country" : "countries"}`}</li>;
    })}</ul>
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}><table className="data-table"><caption>{caption}</caption><thead><tr><th scope="col">Income group</th><th scope="col" className="num">Year</th><th scope="col" className="num">Value</th><th scope="col" className="num">Countries present</th><th scope="col" className="num">Countries selected</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.income_level_code}-${row.year}`}><th scope="row">{row.income_level}</th><td className="num">{row.year}</td><td className="num">{valueFor(indicator.indicator_code, row[statistic], true)}</td><td className="num">{row.countries_present}</td><td className="num">{row.country_count}</td></tr>)}</tbody></table></div>
  </div>;
}
