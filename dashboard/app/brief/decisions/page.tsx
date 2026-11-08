import type { Metadata } from "next";
import Link from "next/link";
import { DecisionCard } from "@/components/brief";
import { getDecisions } from "@/lib/brief";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Decision log" };

export default function Decisions() {
  const decisions = getDecisions();
  return <div className="page">
    <header className="brief-page__head">
      <nav className="brief-page__crumbs" aria-label="Breadcrumb"><Link href="/brief">Brief walkthrough</Link><span aria-current="page">Decision log</span></nav>
      <h1 className="page__title">Decision log</h1><p className="page__lede">Every trade-off taken while building the pipeline, with the options that lost and the consequence that followed.</p>
    </header>
    <nav className="decision-index" aria-label="All decisions"><ol>{decisions.map((decision) => <li key={decision.id}><a href={`#${decision.id}`}>{decision.id} {decision.title}</a></li>)}</ol></nav>
    <section className="section"><h2 className="section__title">All decisions</h2>{decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} references />)}</section>
  </div>;
}
