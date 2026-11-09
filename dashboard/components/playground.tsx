"use client";

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { CopyButton } from "@/components/copy-button";
import { buildRequest, DEFAULT_ORIGIN, FORMAT_OPTIONS, LANGUAGES, ROUTES, runRequest, snippet, type Language, type PlaygroundOptions, type RunResult, type Selection } from "@/lib/playground";

function Segmented({ label, value, options, onChange, compact = false }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (next: string) => void; compact?: boolean }) {
  const labelId = useId();
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
    onChange(options[next].value);
  }
  return <div className={compact ? "control control--inline" : "control"}>
    <span className="control__label" id={labelId}>{label}</span>
    <div className={compact ? "segmented segmented--compact" : "segmented"} role="radiogroup" aria-labelledby={labelId}>
      {options.map((option, index) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} tabIndex={value === option.value ? 0 : -1} className={`segmented__option${value === option.value ? " segmented__option--active" : ""}`} onClick={() => onChange(option.value)} onKeyDown={(event) => navigate(event, index)}>{option.label}</button>)}
    </div>
  </div>;
}

const subscribe = () => () => {};
const readOrigin = () => window.location.origin;
const readServerOrigin = () => DEFAULT_ORIGIN;

export function Playground({ options }: { options: PlaygroundOptions }) {
  const [selection, setSelection] = useState<Selection>({ route: "health", indicator: options.indicators[0]?.value ?? "", country: options.countries[0]?.value ?? "", dataset: options.datasets[0]?.value ?? "", format: "csv" });
  const [language, setLanguage] = useState<Language>("curl");
  const origin = useSyncExternalStore(subscribe, readOrigin, readServerOrigin);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const selectId = useId();
  const runId = useRef(0);

  const route = ROUTES.find((item) => item.id === selection.route) ?? ROUTES[0];
  const request = buildRequest(selection, origin, options);
  const code = snippet(language, request, selection);
  const ready = route.params.every((param) => param === "format" || param === "dataset" ? Boolean(selection[param]) : route.id === "export" || Boolean(selection[param]));

  const allOption = { value: "", label: "All" };
  function update(patch: Partial<Selection>) {
    runId.current += 1;
    setRunning(false);
    setSelection((current) => {
      const next = { ...current, ...patch };
      if (next.route === "export") {
        if (current.route !== "export") { next.indicator = ""; next.country = ""; }
      } else {
        if (!next.indicator) next.indicator = options.indicators[0]?.value ?? "";
        if (!next.country) next.country = options.countries[0]?.value ?? "";
      }
      return next;
    });
    setResult(null);
  }
  async function run() {
    const id = ++runId.current;
    setRunning(true);
    setMessage("Running the request");
    try {
      const next = await runRequest(request, selection, options);
      if (id !== runId.current) return;
      setResult(next);
      setMessage(`Response ${next.status} ${next.statusText}`);
    } catch (error) {
      if (id !== runId.current) return;
      setMessage(`The request could not be run: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }

  return <>
    <div className="controls">
      <Segmented label="Route" value={selection.route} options={ROUTES.map((item) => ({ value: item.id, label: item.label }))} onChange={(next) => update({ route: next as Selection["route"] })} />
      {route.params.includes("dataset") && <div className="control">
        <label className="control__label" htmlFor={selectId}>Dataset</label>
        <select id={selectId} className="select" value={selection.dataset} onChange={(event) => update({ dataset: event.target.value })}>
          {options.datasets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>}
      {route.params.includes("indicator") && (route.id !== "export" || options.datasets.find((item) => item.value === selection.dataset)?.filters.includes("indicator")) && <Segmented label="Indicator" value={selection.indicator} options={route.id === "export" ? [allOption, ...options.indicators] : options.indicators} onChange={(next) => update({ indicator: next })} />}
      {route.params.includes("country") && (route.id !== "export" || options.datasets.find((item) => item.value === selection.dataset)?.filters.includes("country")) && <Segmented label="Country" value={selection.country} options={route.id === "export" ? [allOption, ...options.countries] : options.countries} onChange={(next) => update({ country: next })} />}
      {route.params.includes("format") && <Segmented label="Format" value={selection.format} options={FORMAT_OPTIONS} onChange={(next) => update({ format: next as Selection["format"] })} />}
    </div>

    <section className="console" aria-labelledby="request-title">
      <div className="console__head">
        <h2 className="console__title" id="request-title"><span className="console__method">GET</span> <code className="console__path">{request.path}</code></h2>
        <button type="button" className="button button--primary" onClick={run} disabled={running || !ready}>{running ? "Running" : "Run"}</button>
      </div>
      <div className="console__tabs">
        <Segmented label="Language" value={language} options={LANGUAGES} onChange={(next) => setLanguage(next as Language)} compact />
        <CopyButton key={code} value={code} label="snippet" />
      </div>
      <pre className="code-sample__pre console__snippet" tabIndex={0} role="region" aria-label={`Request in ${LANGUAGES.find((item) => item.value === language)?.label ?? language}`}><code>{code}</code></pre>
      <div className="console__response">
        <div className="console__meta">
          <span className="console__label">Response</span>
          {result ? <>
            <span className={`status-word ${result.ok ? "status-word--ok" : "status-word--warn"}`}>{result.status} {result.statusText}</span>
            <span className="console__fact">{result.contentType}</span>
            <span className="console__fact">{result.elapsedMs} ms</span>
            <span className="console__fact">{result.sizeLabel}</span>
          </> : <span className="console__fact">{running ? "Waiting for the server" : "Not run yet"}</span>}
        </div>
        {result ? result.kind === "parquet" ? <dl className="console__facts">
          <div><dt>Bytes</dt><dd>{result.sizeLabel}</dd></div>
          <div><dt>SHA-256</dt><dd><code className="hash">{result.digest}</code></dd></div>
          <div><dt>Manifest</dt><dd><span className={`status-word ${result.manifest === "match" ? "status-word--ok" : result.manifest === "mismatch" ? "status-word--warn" : "status-word--muted"}`}>{result.manifestLabel}</span></dd></div>
        </dl> : <>
          <pre className="code-sample__pre console__body" tabIndex={0} role="region" aria-label="Response body"><code>{result.body}</code></pre>
          {result.truncatedNote && <p className="console__note">{result.truncatedNote}</p>}
        </> : <p className="console__placeholder">Run the request to see the status, the time it took and the body here. Nothing leaves your browser except the request itself.</p>}
      </div>
    </section>
    <p className="section__note"><strong>Returns</strong> {route.returns}</p>
    <span className="visually-hidden" role="status">{message}</span>
  </>;
}
