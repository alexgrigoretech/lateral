import { LatestChart } from "@/components/charts";
import { Selector } from "@/components/selectors";
import { year } from "@/lib/format";
import { selectedIndicator, type SearchParams } from "@/lib/page-params";
import { getLatest, getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Latest({ searchParams }: { searchParams: SearchParams }) {
  const [meta, params] = await Promise.all([getMeta(), searchParams]);
  const indicator = selectedIndicator(meta, params.indicator);
  const data = await getLatest(indicator.indicator_code);
  const commonYear = data.comparison[0]?.year ?? null;
  const different = data.latest_available.filter((row) => row.year !== commonYear);
  return <div className="page">
    <header><h1 className="page__title">Latest comparable year: {year(commonYear)}</h1><p className="page__lede">{indicator.label}. Countries share a comparison year so the ranking uses the same period.</p></header>
    <div className="controls"><Selector label="Indicator" parameter="indicator" value={indicator.indicator_code} options={meta.indicators.map((item) => ({ value: item.indicator_code, label: item.label }))} /></div>
    <section className="section">{data.comparison.length ? <LatestChart rows={data.comparison} indicator={indicator} /> : <p className="empty-state__text">No comparable year is available for this indicator.</p>}</section>
    {different.length > 0 && <section className="section"><h2 className="section__title">Country availability differs</h2><p className="section__note">The latest available country year differs from the comparable year for: {different.map((row) => `${row.country_name} (${year(row.year)})`).join(", ")}. The ranking above retains the common year.</p></section>}
    <p className="section__note">Shares describe only the selected country total and are shown for additive indicators. GDP uses current US dollars, so annual differences also reflect prices and exchange rates.</p>
  </div>;
}
