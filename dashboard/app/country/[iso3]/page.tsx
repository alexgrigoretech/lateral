import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ValueChart } from "@/components/charts";
import { CopyButton } from "@/components/copy-button";
import { YoyTable } from "@/components/tables";
import { countryLabel, sourceDate, utc, year } from "@/lib/format";
import { getCountry, getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ iso3: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ iso3 }, meta] = await Promise.all([params, getMeta()]);
  const country = meta.countries.find((item) => item.country_iso3 === iso3);
  return { title: country ? countryLabel(country) : "Country not found" };
}

export default async function CountryPage({ params }: Props) {
  const [{ iso3 }, meta] = await Promise.all([params, getMeta()]);
  const index = meta.countries.findIndex((country) => country.country_iso3 === iso3);
  if (index < 0) notFound();
  const data = await getCountry(iso3);
  const previous = meta.countries[index - 1];
  const next = meta.countries[index + 1];
  return <div className="page">
    <header><Link href="/latest" className="page__back">Latest comparable year</Link><h1 className="page__title">{countryLabel(data.country)}</h1><p className="page__lede">{data.country.income_level_name} · {data.country.region_name} · Capital: {data.country.capital_city || "Not available"}</p></header>
    <section className="section" aria-labelledby="values-title"><h2 className="section__title" id="values-title">Indicators over time</h2><p className="section__note">Each chart uses the indicator&apos;s own scale. A dot marks the latest year when its value is present.</p><div className="country-charts">{meta.indicators.map((indicator) => <ValueChart key={indicator.indicator_code} metric="value" indicator={indicator} title={indicator.label} rows={data.facts.filter((row) => row.indicator_code === indicator.indicator_code)} />)}</div></section>
    <section className="section" aria-labelledby="yoy-title"><h2 className="section__title" id="yoy-title">Year over year changes</h2><YoyTable rows={data.yoy} showCountry={false} className="data-table data-table--static-head" /></section>
    <section className="section" aria-labelledby="lineage-title"><h2 className="section__title" id="lineage-title">Source lineage</h2><p className="section__note">Every value on this page traces to a stored API response identified by its page id. The request link reproduces the equivalent call against the live API, not the stored response.</p>
      <div className="table-scroll" role="region" aria-label="Source lineage" tabIndex={0}><table className="data-table data-table--static-head"><caption>Stored API responses behind this page</caption><thead><tr><th scope="col">Indicator</th><th scope="col">Years</th><th scope="col">Page id</th><th scope="col">Fetched</th><th scope="col">Source last updated</th><th scope="col">API request</th></tr></thead><tbody>{data.lineage.map((row) => <tr key={`${row.indicator_code}-${row.source_page_id}`}><th scope="row">{meta.indicators.find((indicator) => indicator.indicator_code === row.indicator_code)?.label ?? row.indicator_code}</th><td>{year(row.year_min)} to {year(row.year_max)}</td><td className="cell-id"><code>{row.source_page_id}</code> <CopyButton value={row.source_page_id} /></td><td>{utc(row.fetched_at)}</td><td>{sourceDate(row.source_lastupdated)}</td><td><a href={`https://api.worldbank.org/v2/country/${iso3}/indicator/${row.indicator_code}?format=json&date=${row.year_min}:${row.year_max}`} rel="noopener">Equivalent request</a></td></tr>)}</tbody></table></div>
      {!data.lineage.length && <p className="section__note">No stored response is associated with these combinations.</p>}
    </section>
    <nav className="pager" aria-label="Countries in alphabetical order">{previous && <Link href={`/country/${previous.country_iso3}`}>Previous: {previous.country_name}</Link>}{next && <Link className="pager__next" href={`/country/${next.country_iso3}`}>Next: {next.country_name}</Link>}</nav>
  </div>;
}
