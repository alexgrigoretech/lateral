import Link from "next/link";
import { Matrices, StatusLegend } from "@/components/matrices";
import { sourceDate, utc, year } from "@/lib/format";
import { getCompleteness, getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";

const entries = [
  { href: "/missing", title: "Missing data", text: "Inspect coverage and distinguish null values from combinations the API did not return." },
  { href: "/yoy", title: "Year over year", text: "Compare annual changes and inspect the reason when a change cannot be calculated." },
  { href: "/latest", title: "Latest year", text: "Rank countries in the latest comparable year and check for newer country observations." },
  { href: "/income-groups", title: "Income groups", text: "Compare sums, averages and medians within the selected country sample." },
];

export default async function Overview() {
  const [meta, completeness] = await Promise.all([getMeta(), getCompleteness()]);
  const run = meta.latest_run;
  return <div className="page">
    <header><h1 className="page__title">World Bank country indicators</h1><p className="page__lede">The World Bank release of {sourceDate(run?.source_lastupdated_max)} carries a value for {meta.counts.present} of {meta.counts.fact_rows} combinations across {meta.counts.countries} countries, {meta.counts.indicators} indicators and {meta.counts.years} years ({year(meta.counts.year_min)} to {year(meta.counts.year_max)}).</p></header>
    <section className="section" aria-label="Dataset counts and pipeline run">
      <div className="kpi-strip">
        {[[meta.counts.countries, "Countries"], [meta.counts.indicators, "Indicators"], [meta.counts.years, "Years"], [`${meta.counts.present} of ${meta.counts.fact_rows}`, "Values present"]].map(([value, label]) => <div className="kpi" key={label}><div className={`kpi__value${typeof value === "string" ? " kpi__value--meta" : ""}`}>{value}</div><div className="kpi__label">{label}</div></div>)}
      </div>
      <p className="section__note">Pipeline run {run?.run_id ?? "Not available"}, finished {utc(run?.finished_at)}, status {run?.status ?? "Not available"}.</p>
    </section>
    <section className="section" aria-labelledby="coverage-title">
      <h2 className="section__title" id="coverage-title">Completeness at a glance</h2>
      <StatusLegend />
      <Matrices matrices={completeness.matrices} indicators={meta.indicators} compact />
    </section>
    <section className="section" aria-labelledby="explore-title"><h2 className="section__title" id="explore-title">Explore the reporting layer</h2><div className="card-grid">{entries.map((entry) => <Link href={entry.href} key={entry.href} className="card"><h3 className="card__title">{entry.title}</h3><p className="card__text">{entry.text}</p></Link>)}</div></section>
    <section className="section" aria-labelledby="read-title"><h2 className="section__title" id="read-title">How to read this</h2><p>A missing value is an outcome, not a zero. A null value means the API returned the country, indicator and year with no value. Not returned means the API omitted that combination. Both remain in the expected country, indicator and year grid. Year over year changes require values in consecutive calendar years, and percentage changes also require a nonzero prior value. Income group results describe only the selected countries.</p></section>
  </div>;
}
