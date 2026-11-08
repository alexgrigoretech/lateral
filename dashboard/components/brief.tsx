import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { DiagramById } from "@/components/diagrams";
import { counts, getSnippet, getSubsection, githubUrl, neighbours, type Decision, type Diagram, type Snippet, type Status, type Subsection, type Verify } from "@/lib/brief";

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
  return <figure className="code-sample"><figcaption className="code-sample__head"><span className="code-sample__path">{snippet.file} lines {snippet.start} to {snippet.end}</span><a className="code-sample__link" href={githubUrl(snippet.file, snippet.start, snippet.end)} target="_blank" rel="noreferrer">View on GitHub</a></figcaption><p className="code-sample__caption">{snippet.caption}</p><pre className="code-sample__pre" tabIndex={0} role="region" aria-label={`Code from ${snippet.file}, lines ${snippet.start} to ${snippet.end}`} data-lang={snippet.lang}><code>{getSnippet(snippet).code}</code></pre></figure>;
}

export function DiagramFigure({ diagram }: { diagram: Diagram }) {
  return <figure className="diagram"><figcaption className="diagram__title">{diagram.title}</figcaption><div className="diagram__scroll" tabIndex={0} role="region" aria-label={`${diagram.title} diagram, scrolls sideways on narrow screens`}><DiagramById id={diagram.id} /></div><p className="diagram__caption">{diagram.caption}<span className="diagram__hint"> Scroll sideways to see the whole diagram.</span></p></figure>;
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
  return <div className="verify"><pre className="verify__cmd" tabIndex={0} role="region" aria-label="Command to run"><code>{verify.cmd}</code></pre><div className="verify__actions"><CopyButton value={verify.cmd} label="command" /></div><p className="verify__expect">{verify.expect}</p></div>;
}

export function Pager({ id }: { id: string }) {
  const { previous, next } = neighbours(id);
  return <nav className="pager-nav" aria-label="Previous and next">
    <Link className="pager-nav__link pager-nav__link--prev" href={previous ? `/brief/${previous.id}` : "/brief"}><span className="pager-nav__dir"><span aria-hidden="true">←</span> Previous</span><span className="pager-nav__title">{previous ? `${previous.number} ${previous.title}` : "Brief walkthrough"}</span></Link>
    <Link className="pager-nav__link pager-nav__link--next" href={next ? `/brief/${next.id}` : "/brief/decisions"}><span className="pager-nav__dir">Next <span aria-hidden="true">→</span></span><span className="pager-nav__title">{next ? `${next.number} ${next.title}` : "Decision log"}</span></Link>
  </nav>;
}
