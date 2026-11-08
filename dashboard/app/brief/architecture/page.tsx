import type { Metadata } from "next";
import Link from "next/link";
import { DiagramFigure } from "@/components/brief";
import { getDiagrams } from "@/lib/brief";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Architecture and diagrams" };

export default function Architecture() {
  return <div className="page">
    <header className="brief-page__head">
      <nav className="brief-page__crumbs" aria-label="Breadcrumb"><Link href="/brief">Brief walkthrough</Link><span aria-current="page">Architecture and diagrams</span></nav>
      <h1 className="page__title">Architecture and diagrams</h1><p className="page__lede">How a World Bank response becomes a tested fact row, an exported report and a chart on this site.</p>
    </header>
    <section className="section"><h2 className="section__title">Diagrams</h2>{getDiagrams().map((diagram) => <DiagramFigure key={diagram.id} diagram={diagram} />)}</section>
  </div>;
}
