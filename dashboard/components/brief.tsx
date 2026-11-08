import Link from "next/link";
import { counts, getSnippet, getSubsection, githubUrl, neighbours, type Decision, type Snippet, type Status, type Subsection, type Verify } from "@/lib/brief";

export function StatusChip({ status }: { status: Status }) {
  return <span className={`status-chip status-chip--${status}`}>{status === "met" ? "Met" : "Met, with a note"}</span>;
}

export function SummaryTiles() {
  const { total, met, note } = counts();
  return <div className="brief-summary">{([["all", total, "requirements in the brief"], ["met", met, "met"], ["note", note, "met, with a note"]] as const).map(([status, value, label]) => <div className={`brief-tile brief-tile--${status}`} key={status}><span className="brief-tile__n">{value}</span><span className="brief-tile__l">{label}</span></div>)}</div>;
}

export function RequirementRow({ subsection }: { subsection: Subsection }) {
  return <Link className="brief-row" href={`/brief/${subsection.id}`}><span className="brief-row__num">{subsection.number}</span><span className="brief-row__req">{subsection.title}</span><StatusChip status={subsection.status} /></Link>;
}

export function CodeSample({ snippet }: { snippet: Snippet }) {
  return <figure className="code-sample"><figcaption className="code-sample__head"><span className="code-sample__path">{snippet.file} lines {snippet.start} to {snippet.end}</span><a className="code-sample__link" href={githubUrl(snippet.file, snippet.start, snippet.end)} target="_blank" rel="noreferrer">View on GitHub</a></figcaption><pre className="code-sample__pre" data-lang={snippet.lang}><code>{getSnippet(snippet).code}</code></pre><p className="code-sample__caption">{snippet.caption}</p></figure>;
}

export function DecisionCard({ decision, references = false }: { decision: Decision; references?: boolean }) {
  return <article className="decision" id={decision.id}><p className="decision__id">{decision.id}</p><h3 className="decision__title">{decision.title}</h3><dl>
    <div className="decision__field"><dt className="decision__label">Context</dt><dd>{decision.context}</dd></div>
    <div className="decision__field"><dt className="decision__label">Options</dt><dd><ul>{decision.options.map((option) => <li key={option}>{option}</li>)}</ul></dd></div>
    <div className="decision__field"><dt className="decision__label">Choice</dt><dd>{decision.choice}</dd></div>
    <div className="decision__field"><dt className="decision__label">Consequence</dt><dd>{decision.consequence}</dd></div>
  </dl>{references && <p className="decision__refs">Applies to: {decision.subsections.map((id, index) => {
    const item = getSubsection(id);
    return <span key={id}>{index > 0 && ", "}<Link href={`/brief/${id}`}>{item ? `${item.number} ${item.title}` : id}</Link></span>;
  })}</p>}</article>;
}

export function VerifyBlock({ verify }: { verify: Verify }) {
  return <div className="verify"><pre className="verify__cmd"><code>{verify.cmd}</code></pre><p className="verify__expect">{verify.expect}</p></div>;
}

export function Pager({ id }: { id: string }) {
  const { previous, next } = neighbours(id);
  return <nav className="pager-nav" aria-label="Previous and next">
    {previous && <Link className="pager-nav__link pager-nav__link--prev" href={`/brief/${previous.id}`}><span className="pager-nav__dir">Previous</span><span className="pager-nav__title">{previous.number} {previous.title}</span></Link>}
    {next && <Link className="pager-nav__link pager-nav__link--next" href={`/brief/${next.id}`}><span className="pager-nav__dir">Next</span><span className="pager-nav__title">{next.number} {next.title}</span></Link>}
  </nav>;
}
