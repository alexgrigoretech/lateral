import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ValueChart, YoyChart } from "@/components/charts";
import { Selector } from "@/components/selectors";
import { YoyTable } from "@/components/tables";
import { selectedIndicator, type SearchParams } from "@/lib/page-params";
import { getMeta, getYoy } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Year over year" };

export default async function Yoy({ searchParams }: { searchParams: SearchParams }) {
  const [meta, params] = await Promise.all([getMeta(), searchParams]);
  const indicator = selectedIndicator(meta, params.indicator);
  const data = await getYoy(indicator.indicator_code);
  const latestYear = data.rows.length ? Math.max(...data.rows.map((row) => row.year)) : null;
  const latestChanges = data.rows.flatMap((row) => row.year === latestYear && row.pct_change !== null
    ? [{ country_iso3: row.country_iso3, country_name: row.country_name, magnitude: Math.abs(row.pct_change) }]
    : []);
  const defaultCountry = latestChanges.sort((a, b) => b.magnitude - a.magnitude || a.country_iso3.localeCompare(b.country_iso3))[0];
  const defaultFocus = defaultCountry?.country_iso3 ?? null;
  const focus = params.focus === "none" ? null : (params.focus ?? defaultFocus);
  if (focus !== null && (typeof focus !== "string" || !meta.countries.some((country) => country.country_iso3 === focus))) notFound();
  const changes = data.rows.flatMap((row) => row.pct_change === null ? [] : [row.pct_change]);
  const domain: [number, number] | undefined = changes.length ? [Math.floor(Math.min(...changes)), Math.ceil(Math.max(...changes))] : undefined;
  return <div className="page">
    <header><h1 className="page__title">Year over year</h1><p className="page__lede">{indicator.label}. Follow annual change and inspect each country on the same percentage scale.</p></header>
    <div className="controls"><Selector label="Indicator" parameter="indicator" value={indicator.indicator_code} options={meta.indicators.map((item) => ({ value: item.indicator_code, label: item.label }))} /></div>
    <section className="section"><YoyChart rows={data.rows} focus={focus} defaultCountryName={defaultCountry?.country_name ?? null} /></section>
    <section className="section" aria-labelledby="multiples-title"><h2 className="section__title" id="multiples-title">One country at a time</h2><p className="section__note">All nine charts use the same vertical scale.</p><div className="small-multiples">{meta.countries.map((country) => <ValueChart key={country.country_iso3} metric="pct_change" indicator={indicator} title={country.country_name} domain={domain} rows={data.rows.filter((row) => row.country_iso3 === country.country_iso3)} />)}</div></section>
    <section className="section" aria-labelledby="changes-title"><h2 className="section__title" id="changes-title">Values and change status</h2><YoyTable rows={data.rows} showIndicator={false} /></section>
  </div>;
}
