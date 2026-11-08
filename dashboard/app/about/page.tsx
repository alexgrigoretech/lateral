import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About the data" };

const GRAINS = [
  ["dim_country", "country", "country_iso3"],
  ["dim_indicator", "indicator", "indicator_code"],
  ["fct_indicator_year", "expected country, indicator and calendar year", "country_iso3, indicator_code, year"],
  ["rpt_completeness_by_country_indicator", "country and indicator", "country_iso3, indicator_code"],
  ["rpt_missing_data", "missing country, indicator and year", "country_iso3, indicator_code, year"],
  ["rpt_yoy_change", "country, indicator and year (the fact grain)", "country_iso3, indicator_code, year"],
  ["rpt_latest_year_comparison", "country and indicator", "country_iso3, indicator_code"],
  ["rpt_latest_available_per_country", "country and indicator", "country_iso3, indicator_code"],
  ["rpt_income_group_by_year", "indicator, income group and year", "indicator_code, income_level_code, year"],
  ["run_summary", "pipeline run", "run_id"],
] as const;

export default function About() {
  return <div className="page">
    <header><h1 className="page__title">About the data</h1><p className="page__lede">A reporting layer for World Bank country indicators with explicit coverage and source lineage.</p></header>
    <section className="section" aria-labelledby="grain-title"><h2 className="section__title" id="grain-title">Model grains and business keys</h2>
      <p className="section__note">The dbt models carry a business_key data test on the key shown.</p>
      <div className="table-scroll" role="region" aria-label="Model grains and business keys" tabIndex={0}><table className="data-table">
        <caption>Grain and business key of each model</caption>
        <thead><tr><th scope="col">Model</th><th scope="col">One row per</th><th scope="col">Business key</th></tr></thead>
        <tbody>{GRAINS.map(([model, grain, key]) => <tr key={model}><th scope="row"><code>{model}</code></th><td>{grain}</td><td><code>{key}</code></td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="section"><h2 className="section__title">Value status</h2><p>Present means the API returned a numeric value, including zero. Null value means the API returned the combination with a null value. Not returned means the expected combination was absent from the response. Both missing statuses remain in the fact table and completeness denominator. No missing numeric value is filled with zero.</p></section>
    <section className="section"><h2 className="section__title">Year over year status</h2><p>Change available means consecutive calendar years have values and the prior value is nonzero. First year marks the start of the selected period. Current missing and prior missing explain unavailable comparisons. Prior zero means a percentage change cannot be calculated; an absolute change can still be available. Percentage change is 100 times the difference divided by the prior value.</p></section>
    <section className="section"><h2 className="section__title">Comparisons and aggregation</h2><p>Latest comparable year uses the reporting model&apos;s common year, while latest available observations preserve each country&apos;s own most recent value. Population and GDP totals are additive. GDP per capita and life expectancy use population weighted averages by default. Average and median give each country equal weight. Income group summaries cover only the selected countries. GDP is measured in current US dollars.</p></section>
    <section className="section"><h2 className="section__title">Stack and data delivery</h2><p>Python and dbt build the reporting layer with DuckDB and export Parquet. Next.js 16 serves the dashboard and JSON routes with TypeScript and the Node.js runtime. DuckDB queries the bundled Parquet files at request time, and Recharts renders the charts. The dashboard does not query the World Bank API directly. Dates and timestamps display in UTC.</p><p><a href="https://github.com/alexgrigoretech/lateral" rel="noreferrer">README in the repository</a></p><p>The <Link href="/brief">brief walkthrough</Link> maps every requirement of the assessment to the code that meets it.</p></section>
  </div>;
}
