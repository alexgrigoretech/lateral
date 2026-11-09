import type { Metadata } from "next";
import Link from "next/link";
import { LatestChart } from "@/components/charts";
import { ExportLinks } from "@/components/export-links";
import { Selector } from "@/components/selectors";
import { year } from "@/lib/format";
import { selectedIndicator, type SearchParams } from "@/lib/page-params";
import { getLatest, getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Latest year" };

export default async function Latest({ searchParams }: { searchParams: SearchParams }) {
  const [meta, params] = await Promise.all([getMeta(), searchParams]);
  const indicator = selectedIndicator(meta, params.indicator);
  const data = await getLatest(indicator.indicator_code);
  const commonYear = data.comparison[0]?.year ?? null;
  const different = data.latest_available.filter((row) => row.year !== commonYear);
  return <div className="page">
    <header><h1 className="page__title">Latest comparable year: {year(commonYear)}</h1><p className="page__lede">{indicator.label}. Countries share a comparison year so the ranking uses the same period.</p></header>
    <div className="controls"><Selector label="Indicator" parameter="indicator" value={indicator.indicator_code} options={meta.indicators.map((item) => ({ value: item.indicator_code, label: item.label }))} /></div>
    <ExportLinks items={[{ dataset: "rpt_latest_year_comparison", label: `Latest year comparison (${indicator.label})`, filters: { indicator: indicator.indicator_code } }, { dataset: "rpt_latest_available_per_country", label: `Latest available per country (${indicator.label})`, filters: { indicator: indicator.indicator_code } }]} />
    <section className="section">{data.comparison.length ? <LatestChart rows={data.comparison} indicator={indicator} /> : <div className="empty-state"><h2 className="empty-state__title">No comparable year for {indicator.label}</h2><p className="empty-state__text">A comparable year needs a value for every selected country in the same calendar year, and the current release has none for this indicator. Select another indicator above, or inspect which combinations are missing.</p><p className="empty-state__text"><Link href="/missing">Missing data report</Link></p></div>}</section>
    {different.length > 0 && <section className="section"><h2 className="section__title">Country availability differs</h2><p className="section__note">The latest available country year differs from the comparable year for: {different.map((row) => `${row.country_name} (${year(row.year)})`).join(", ")}. The ranking above retains the common year.</p></section>}
    <p className="section__note">Shares describe only the selected country total and are shown for additive indicators. GDP uses current US dollars, so annual differences also reflect prices and exchange rates.</p>
  </div>;
}
