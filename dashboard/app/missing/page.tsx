import type { Metadata } from "next";
import Link from "next/link";
import { Matrices, StatusLegend } from "@/components/matrices";
import { groupConsecutive } from "@/components/tables";
import { describeStatus, sourceDate, year } from "@/lib/format";
import { getCompleteness, getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Missing data" };

export default async function Missing() {
  const [meta, data] = await Promise.all([getMeta(), getCompleteness()]);
  const counts = { present: 0, null_value: 0, not_returned: 0 };
  for (const matrix of data.matrices) {
    for (const row of matrix.rows) {
      for (const cell of row.cells) counts[cell.status] += 1;
    }
  }
  const statuses = [["present", "Present"], ["null_value", "Null value"], ["not_returned", "Not returned"]] as const;
  const missingCaption = "Country, indicator and year combinations without a value";
  const completenessCaption = "Present years out of expected years, with the first and last year containing a value";
  const completenessGroups = groupConsecutive(data.completeness, (row) => row.country_iso3);
  return <div className="page">
    <header><h1 className="page__title">Missing data</h1><p className="page__lede">Inspect every expected country, indicator and year, including combinations without a value.</p></header>
    <div className="kpi-strip" role="group" aria-label="Value status counts">
      {statuses.map(([status, label]) => <div className="kpi" key={status}><div className="kpi__value">{counts[status]}</div><div className="kpi__label"><span className={`matrix__cell matrix__cell--${status}`} aria-hidden="true"></span>{label}</div></div>)}
    </div>
    <section className="section" aria-labelledby="missing-title">
      <h2 className="section__title" id="missing-title">Missing combinations</h2>
      {data.missing.length > 0 && <StatusLegend />}
      {data.missing.length ? <div className="table-scroll" role="region" aria-label={missingCaption} tabIndex={0}>
        <table className="data-table">
          <caption>{missingCaption}</caption>
          <thead><tr><th scope="col">Country</th><th scope="col">Indicator</th><th scope="col" className="num">Year</th><th scope="col">Status</th></tr></thead>
          <tbody>{data.missing.map((row) => <tr key={`${row.country_iso3}-${row.indicator_code}-${row.year}`}><th scope="row"><Link href={`/country/${row.country_iso3}`}>{row.country_name}</Link></th><td>{row.label}</td><td className="num">{row.year}</td><td><span className="status-word status-word--warn">{describeStatus(row.status)}</span></td></tr>)}</tbody>
        </table>
      </div> : <div className="empty-state empty-state--clear"><h3 className="empty-state__title">No gaps in the current release</h3><p className="empty-state__text">The World Bank release of {sourceDate(meta.latest_run?.source_lastupdated_max)} carries a value for all {meta.counts.present} of {meta.counts.fact_rows} combinations across {meta.counts.countries} countries, {meta.counts.indicators} indicators and {meta.counts.years} years ({year(meta.counts.year_min)} to {year(meta.counts.year_max)}). The model still distinguishes a value the API returned as null from a combination it did not return at all; both would appear here with their status.</p><StatusLegend /><p className="empty-state__text"><Link href="/brief/3-1">See how a gap is reported, with the synthetic sample</Link></p></div>}
      {data.missing.length > 0 && <p className="section__note"><Link href="/brief/3-1">See how a gap is reported, with the synthetic sample</Link></p>}
    </section>
    <section className="section" aria-labelledby="matrix-title"><h2 className="section__title" id="matrix-title">Coverage by indicator</h2><Matrices matrices={data.matrices} indicators={meta.indicators} /></section>
    <section className="section" aria-labelledby="completeness-title">
      <h2 className="section__title" id="completeness-title">Completeness by country and indicator</h2>
      <div className="table-scroll" role="region" aria-label={completenessCaption} tabIndex={0}>
        <table className="data-table">
          <caption>{completenessCaption}</caption>
          <thead><tr><th scope="col">Country</th><th scope="col">Indicator</th><th scope="col" className="num">Present / expected</th><th scope="col" className="num">Missing</th><th scope="col" className="num">Completeness</th><th scope="col" className="num">First present</th><th scope="col" className="num">Last present</th></tr></thead>
          {completenessGroups.map((group, groupIndex) => <tbody key={`${group[0].country_iso3}-${groupIndex}`}>{group.map((row, index) => <tr key={`${row.country_iso3}-${row.indicator_code}`}>{index === 0 && <th scope="rowgroup" rowSpan={group.length} className="cell-head"><Link href={`/country/${row.country_iso3}`}>{row.country_name}</Link></th>}<td>{row.label}</td><td className="num">{row.present_years} / {row.expected_years}</td><td className="num">{row.missing_years}</td><td className="num">{row.completeness_pct.toFixed(1)}%</td><td className="num">{year(row.first_year_present)}</td><td className="num">{year(row.last_year_present)}</td></tr>)}</tbody>)}
        </table>
      </div>
    </section>
  </div>;
}
