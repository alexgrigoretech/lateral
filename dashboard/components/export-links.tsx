import Link from "next/link";
import { exportFilename, exportHref } from "@/lib/export";

export function ExportLinks({ items }: { items: { dataset: string; label: string; filters?: { indicator?: string; country?: string } }[] }) {
  return <div className="export-links" role="group" aria-label="Download the data behind this page">
    <span className="export-links__label">Download</span>
    <ul className="export-links__list">{items.map(({ dataset, label, filters }) => <li className="export-links__item" key={exportHref(dataset, "csv", filters)}>
      <span className="export-links__name">{label}</span>
      <a className="download-link" href={exportHref(dataset, "csv", filters)} download={exportFilename(dataset, "csv", filters)}>CSV<span className="visually-hidden">, {label}</span></a>
      <a className="download-link" href={exportHref(dataset, "parquet", filters)} download={exportFilename(dataset, "parquet", filters)}>Parquet<span className="visually-hidden">, {label}</span></a>
    </li>)}</ul>
    <Link className="export-links__all" href="/export">All datasets</Link>
  </div>;
}
