import Link from "next/link";
import { describeStatus, percent, signed, valueFor, year } from "@/lib/format";
import type { YoyRow, YoyStatus } from "@/lib/types";

function tone(status: YoyStatus): string {
  return status === "ok" ? "ok" : status === "first_year" ? "muted" : "warn";
}

export function groupConsecutive<T>(rows: T[], key: (row: T) => string): T[][] {
  const groups: T[][] = [];
  for (const row of rows) {
    const group = groups[groups.length - 1];
    if (group && key(group[0]) === key(row)) group.push(row);
    else groups.push([row]);
  }
  return groups;
}

export function YoyTable({ rows, showIndicator = true, showCountry = true, className = "data-table" }: { rows: YoyRow[]; showIndicator?: boolean; showCountry?: boolean; className?: string }) {
  const caption = "Values and year over year changes. Percentage change uses the previous calendar year.";
  const groups = showCountry || showIndicator ? groupConsecutive(rows, (row) => showCountry ? row.country_iso3 : row.indicator_code) : [rows];
  return <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}><table className={className}>
    <caption>{caption}</caption>
    <thead><tr>{showCountry && <th scope="col">Country</th>}{showIndicator && <th scope="col">Indicator</th>}<th scope="col" className="num cell-num">Year</th><th scope="col" className="num cell-num">Value</th><th scope="col" className="num cell-num">Prior year</th><th scope="col" className="num cell-num">Prior value</th><th scope="col" className="num cell-num">Absolute change</th><th scope="col" className="num cell-num">Percentage change</th><th scope="col">Status</th></tr></thead>
    {groups.map((group, groupIndex) => <tbody key={showCountry ? `${group[0].country_iso3}-${groupIndex}` : showIndicator ? `${group[0].indicator_code}-${groupIndex}` : "rows"}>{group.map((row, index) => <tr key={`${row.country_iso3}-${row.indicator_code}-${row.year}`}>
      {showCountry && index === 0 && <th scope="rowgroup" rowSpan={group.length} className="cell-head"><Link href={`/country/${row.country_iso3}`}>{row.country_name}</Link></th>}
      {showIndicator && (showCountry ? <td>{row.label}</td> : index === 0 && <th scope="rowgroup" rowSpan={group.length} className="cell-head">{row.label}</th>)}{!showCountry && !showIndicator ? <th scope="row" className="num cell-num">{year(row.year)}</th> : <td className="num cell-num">{year(row.year)}</td>}
      <td className={`num cell-num${row.value === null ? " na" : ""}`}>{row.value === null ? "n/a" : valueFor(row.indicator_code, row.value, true)}</td>
      <td className={`num cell-num${row.prior_year === null || row.yoy_status === "first_year" ? " na" : ""}`}>{row.prior_year === null || row.yoy_status === "first_year" ? "n/a" : year(row.prior_year)}</td>
      <td className={`num cell-num${row.prior_value === null ? " na" : ""}`}>{row.prior_value === null ? "n/a" : valueFor(row.indicator_code, row.prior_value, true)}</td>
      <td className={`num cell-num${row.abs_change === null ? " na" : ""}`}>{row.abs_change === null ? "n/a" : signed(row.indicator_code, row.abs_change)}</td>
      <td className={`num cell-num${row.pct_change === null ? " na" : ""}`}>{row.pct_change === null ? "n/a" : percent(row.pct_change)}</td>
      <td><span className={`status-word status-word--${tone(row.yoy_status)}`}>{describeStatus(row.yoy_status)}</span></td>
    </tr>)}</tbody>)}
  </table></div>;
}
