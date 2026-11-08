import Link from "next/link";
import { describeStatus, indicatorLabel, valueFor } from "@/lib/format";
import type { Indicator, Matrix } from "@/lib/types";

export function StatusLegend() {
  return <ul className="matrix__legend">
    <li><span className="matrix__cell matrix__cell--present">Present</span><span>The API returned a value, including zero.</span></li>
    <li><span className="matrix__cell matrix__cell--null_value">Null value</span><span>The API returned the combination with a null value.</span></li>
    <li><span className="matrix__cell matrix__cell--not_returned">Not returned</span><span>The API did not return the combination.</span></li>
  </ul>;
}

export function Matrices({ matrices, indicators, compact = false }: { matrices: Matrix[]; indicators: Indicator[]; compact?: boolean }) {
  return <div className={compact ? "card-grid" : "matrix-grid"}>
    {indicators.map((indicator) => {
      const matrix = matrices.find((item) => item.indicator_code === indicator.indicator_code);
      if (!matrix) return <p key={indicator.indicator_code}>No matrix rows for {indicatorLabel(indicator)}.</p>;
      const cells = matrix.rows.flatMap((row) => row.cells);
      const present = cells.filter((cell) => cell.status === "present").length;
      return <div className={`matrix${compact ? " matrix--compact" : ""}`} key={matrix.indicator_code} tabIndex={0} role="region" aria-label={`${indicatorLabel(indicator)} completeness matrix`}>
        <table className="matrix__table">
          <caption>{indicatorLabel(indicator)} <span>{present} of {cells.length} present</span></caption>
          <thead><tr><th scope="col">Country</th>{matrix.years.map((year) => <th scope="col" key={year}>{year}</th>)}</tr></thead>
          <tbody>{matrix.rows.map((row) => <tr key={row.country_iso3}>
            <th scope="row"><Link href={`/country/${row.country_iso3}`}>{compact ? row.country_iso3 : row.country_name}</Link></th>
            {row.cells.map((cell) => <td key={cell.year} className={`matrix__cell matrix__cell--${cell.status}`} title={`${row.country_name}, ${cell.year}: ${describeStatus(cell.status)}${cell.value === null ? "" : `, ${valueFor(indicator.indicator_code, cell.value)}`}`}>
              <span className="visually-hidden">{describeStatus(cell.status)}{cell.value === null ? "" : `: ${valueFor(indicator.indicator_code, cell.value)}`}</span>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>;
    })}
  </div>;
}
