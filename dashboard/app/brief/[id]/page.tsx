import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeSample, DecisionCard, Pager, StatusChip, VerifyBlock } from "@/components/brief";
import { DiagramById } from "@/components/diagrams";
import { getDecision, getDiagrams, getSections, getSubsection, getSubsections } from "@/lib/brief";

export const dynamic = "force-static";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() { return getSubsections().map(({ id }) => ({ id })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = getSubsection((await params).id);
  if (!item) notFound();
  return { title: `${item.number} ${item.title}` };
}

export default async function BriefSubsection({ params }: Props) {
  const item = getSubsection((await params).id);
  if (!item) notFound();
  const section = getSections().find((entry) => entry.number === item.section)!;
  return <div className="page">
    <nav className="brief-page__crumbs" aria-label="Breadcrumb"><Link href="/brief">Brief walkthrough</Link>{" / "}<span>{section.number} {section.title}</span>{" / "}<span>{item.number}</span></nav>
    <header><h1 className="page__title"><span className="brief-row__num">{item.number}</span>{item.title}</h1><StatusChip status={item.status} /></header>
    <blockquote className="brief-page__quote"><p>{item.requirement}</p><footer>From the assessment brief, section {section.number} {section.title}</footer></blockquote>
    <p className="page__lede">{item.summary}</p>
    {item.note && <aside className="brief-note" role="note"><p className="brief-note__label">Note</p><p>{item.note}</p></aside>}
    <section className="section"><h2 className="section__title">How it is met</h2>{item.details.map((detail) => <p key={detail}>{detail}</p>)}</section>
    {item.snippets.length > 0 && <section className="section"><h2 className="section__title">Code</h2>{item.snippets.map((snippet) => <CodeSample key={`${snippet.file}#${snippet.start}-${snippet.end}`} snippet={snippet} />)}</section>}
    {item.diagrams.length > 0 && <section className="section"><h2 className="section__title">Diagram</h2>{item.diagrams.map((id) => {
      const diagram = getDiagrams().find((entry) => entry.id === id)!;
      return <figure className="diagram" key={id}><figcaption className="diagram__title">{diagram.title}</figcaption><DiagramById id={id} /><p className="diagram__caption">{diagram.caption}</p></figure>;
    })}</section>}
    {item.decisions.length > 0 && <section className="section"><h2 className="section__title">Decisions</h2>{item.decisions.map((id) => <DecisionCard key={id} decision={getDecision(id)!} />)}</section>}
    {item.live.length > 0 && <section className="section"><h2 className="section__title">See it live</h2><ul className="brief-live">{item.live.map((live) => <li key={live.href}><Link href={live.href}>{live.label}</Link></li>)}</ul></section>}
    {item.verify.length > 0 && <section className="section"><h2 className="section__title">Verify it yourself</h2><p className="verify__note">Commands assume a POSIX shell (Git Bash on Windows) at the repository root after make setup; on Windows the interpreter is .venv/Scripts/python.exe. Queries use the duckdb CLI when available; otherwise run them through python -c with the duckdb module.</p>{item.verify.map((verify) => <VerifyBlock key={verify.cmd} verify={verify} />)}</section>}
    <Pager id={item.id} />
  </div>;
}
