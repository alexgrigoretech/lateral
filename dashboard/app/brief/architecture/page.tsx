import type { Metadata } from "next";
import Link from "next/link";
import { DiagramById } from "@/components/diagrams";
import { getDiagrams } from "@/lib/brief";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Architecture and diagrams" };

export default function Architecture() {
  return <div className="page">
    <nav className="brief-page__crumbs" aria-label="Breadcrumb"><Link href="/brief">Brief walkthrough</Link>{" / "}<span>Architecture and diagrams</span></nav>
    <header><h1 className="page__title">Architecture and diagrams</h1><p className="page__lede">How a World Bank response becomes a tested fact row, an exported report and a chart on this site.</p></header>
    <section className="section"><h2 className="section__title">Diagrams</h2>{getDiagrams().map((diagram) => <figure className="diagram" key={diagram.id}><figcaption className="diagram__title">{diagram.title}</figcaption><DiagramById id={diagram.id} /><p className="diagram__caption">{diagram.caption}</p></figure>)}</section>
  </div>;
}
