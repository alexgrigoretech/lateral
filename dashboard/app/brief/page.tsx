import type { Metadata } from "next";
import Link from "next/link";
import { RequirementRow, SummaryTiles } from "@/components/brief";
import { getSections, getSubsections } from "@/lib/brief";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Brief walkthrough" };

export default function BriefOverview() {
  const subsections = getSubsections();
  return <div className="page">
    <header><h1 className="page__title">Brief walkthrough</h1><p className="page__lede">Every requirement of the Senior Data Engineer take-home mapped to the code that meets it, with the evidence read from this repository.</p><p><a href="https://github.com/alexgrigoretech/lateral" target="_blank" rel="noreferrer">Repository on GitHub</a>{" · "}<a href="https://github.com/alexgrigoretech/lateral#readme" target="_blank" rel="noreferrer">README</a>{" · "}<Link href="/brief/architecture">Architecture and diagrams</Link>{" · "}<Link href="/brief/decisions">Decision log</Link></p></header>
    <SummaryTiles />
    {getSections().map((section) => <section className="brief-section" id={`section-${section.number}`} key={section.number}>
      <div className="brief-section__head"><h2 className="section__title"><span className="brief-row__num">{section.number}</span>{section.title}</h2><p className="brief-section__intro">{section.intro}</p></div>
      {subsections.filter((item) => item.section === section.number).map((item) => <RequirementRow key={item.id} subsection={item} />)}
    </section>)}
    <section className="section"><h2 className="section__title">Notes a reviewer will notice</h2><ul className="brief-notes">{subsections.filter((item) => item.status === "note").map((item) => <li key={item.id}><Link href={`/brief/${item.id}`}>{item.number} {item.title}</Link>: {item.note}</li>)}</ul></section>
  </div>;
}
