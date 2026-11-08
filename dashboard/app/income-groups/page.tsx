import type { Metadata } from "next";
import Link from "next/link";
import { IncomeChart } from "@/components/charts";
import { Selector } from "@/components/selectors";
import { selectedIndicator, selectedStatistic, statisticOptions, STATISTICS, type SearchParams } from "@/lib/page-params";
import { getIncomeGroups, getMeta } from "@/lib/queries";
import { INCOME_ORDER } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Income groups" };

export default async function IncomeGroups({ searchParams }: { searchParams: SearchParams }) {
  const [meta, params] = await Promise.all([getMeta(), searchParams]);
  const indicator = selectedIndicator(meta, params.indicator);
  const statistic = selectedStatistic(indicator, params.stat);
  const data = await getIncomeGroups(indicator.indicator_code);
  const statisticLabel = STATISTICS.find((item) => item.value === statistic)!.label;
  return <div className="page">
    <header><h1 className="page__title">Income groups</h1><p className="page__lede">{indicator.label}. Compare income groups within the selected country sample.</p></header>
    <div className="controls">
      <Selector label="Indicator" parameter="indicator" value={indicator.indicator_code} options={meta.indicators.map((item) => ({ value: item.indicator_code, label: item.label }))} />
      <Selector label="Statistic" parameter="stat" value={statistic} options={statisticOptions(indicator)} />
    </div>
    <section className="section"><p className="section__note">These groups describe only the selected countries, not global income group totals.</p><IncomeChart rows={data.rows} indicator={indicator} statistic={statistic} statisticLabel={statisticLabel} /><details><summary>How the statistics are calculated</summary><p>Use sums for population and GDP totals. Use population weighted averages for GDP per capita and life expectancy. Average and median describe the countries in the sample without weighting by population. Missing values remain missing; the table reports how many countries have values. These groups do not represent global income group totals.</p></details></section>
    <section className="section" aria-labelledby="members-title"><h2 className="section__title" id="members-title">Countries in each group</h2><div className="card-grid">{INCOME_ORDER.map((code) => {
      const members = data.members.filter((country) => country.income_level_code === code);
      return <div className="card" key={code}><h3 className="card__title">{members[0]?.income_level_name ?? code} ({code})</h3><ul>{members.map((country) => <li key={country.country_iso3}><Link href={`/country/${country.country_iso3}`}>{country.country_name}</Link></li>)}</ul></div>;
    })}</div></section>
  </div>;
}
