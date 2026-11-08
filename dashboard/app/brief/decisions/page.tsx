import type { Metadata } from "next";
import Link from "next/link";
import { DecisionCard } from "@/components/brief";
import { getDecisions } from "@/lib/brief";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Decision log" };

export default function Decisions() {
  return <div className="page">
    <nav className="brief-page__crumbs" aria-label="Breadcrumb"><Link href="/brief">Brief walkthrough</Link>{" / "}<span>Decision log</span></nav>
    <header><h1 className="page__title">Decision log</h1><p className="page__lede">Every trade-off taken while building the pipeline, with the options that lost and the consequence that followed.</p></header>
    <section className="section"><h2 className="section__title">Decisions</h2>{getDecisions().map((decision) => <DecisionCard key={decision.id} decision={decision} references />)}</section>
  </div>;
}
