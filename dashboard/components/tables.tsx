import Link from "next/link";
import { describeStatus, percent, signed, valueFor, year } from "@/lib/format";
import type { YoyRow, YoyStatus } from "@/lib/types";

function tone(status: YoyStatus): string {
  return status === "ok" ? "ok" : status === "first_year" ? "muted" : "warn";
}

export function YoyTable({ rows, showIndicator = true }: { rows: YoyRow[]; showIndicator?: boolean }) {
  const caption = "Values and year over year changes. Percentage change uses the previous calendar year.";
  return <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}><table className="data-table">
    <caption>{caption}</caption>
    <thead><tr><th scope="col">Country</th>{showIndicator && <th scope="col">Indicator</th>}<th scope="col" className="num">Year</th><th scope="col" className="num">Value</th><th scope="col" className="num">Prior year</th><th scope="col" className="num">Prior value</th><th scope="col" className="num">Absolute change</th><th scope="col" className="num">Percentage change</th><th scope="col">Status</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={`${row.country_iso3}-${row.indicator_code}-${row.year}`}>
      <th scope="row"><Link href={`/country/${row.country_iso3}`}>{row.country_name}</Link></th>
      {showIndicator && <td>{row.label}</td>}<td className="num">{year(row.year)}</td>
      <td className={`num${row.value === null ? " na" : ""}`}>{row.value === null ? "n/a" : valueFor(row.indicator_code, row.value, true)}</td>
      <td className={`num${row.prior_year === null || row.yoy_status === "first_year" ? " na" : ""}`}>{row.prior_year === null || row.yoy_status === "first_year" ? "n/a" : year(row.prior_year)}</td>
      <td className={`num${row.prior_value === null ? " na" : ""}`}>{row.prior_value === null ? "n/a" : valueFor(row.indicator_code, row.prior_value, true)}</td>
      <td className={`num${row.abs_change === null ? " na" : ""}`}>{row.abs_change === null ? "n/a" : signed(row.indicator_code, row.abs_change)}</td>
      <td className={`num${row.pct_change === null ? " na" : ""}`}>{row.pct_change === null ? "n/a" : percent(row.pct_change)}</td>
      <td><span className={`status-word status-word--${tone(row.yoy_status)}`}>{describeStatus(row.yoy_status)}</span></td>
    </tr>)}</tbody>
  </table></div>;
}
