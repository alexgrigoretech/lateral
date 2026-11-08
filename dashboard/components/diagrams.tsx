import { useId, type ReactNode } from "react";

function Canvas({ id, height, label, children }: { id: string; height: number; label: string; children: (marker: string) => ReactNode }) {
  const marker = `${id}-arrow-${useId().replaceAll(":", "")}`;
  return <svg width="100%" viewBox={`0 0 960 ${height}`} role="img" aria-label={label} fontSize="13" style={{ fontFamily: "var(--font)" }}>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--accent-wash)" stroke="var(--accent)" /></marker></defs>
    {children(marker)}
  </svg>;
}

function Box({ x, y, width, height, title, lines = [], accent = false, pill = false }: { x: number; y: number; width: number; height: number; title: string; lines?: string[]; accent?: boolean; pill?: boolean }) {
  return <g><rect x={x} y={y} width={width} height={height} rx={pill ? height / 2 : 8} fill={accent ? "var(--accent-wash)" : "var(--surface-2)"} stroke="var(--rule)" /><text x={x + 12} y={lines.length ? y + 25 : y + height / 2 + 5} fill="var(--ink)">{title}</text>{lines.map((line, index) => <text key={index} x={x + 12} y={y + 49 + index * 21} fill="var(--ink-2)">{line}</text>)}</g>;
}

function Arrow({ d, marker }: { d: string; marker: string }) {
  return <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" markerEnd={`url(#${marker})`} />;
}

function Diamond({ cx, cy, width, height, lines }: { cx: number; cy: number; width: number; height: number; lines: string[] }) {
  return <g><path d={`M ${cx} ${cy - height / 2} L ${cx + width / 2} ${cy} L ${cx} ${cy + height / 2} L ${cx - width / 2} ${cy} Z`} fill="var(--accent-wash)" stroke="var(--rule)" />{lines.map((line, index) => <text key={index} x={cx} y={cy - (lines.length - 1) * 10 + index * 20 + 5} textAnchor="middle" fill="var(--ink)">{line}</text>)}</g>;
}

export function FlowDiagram() {
  const boxes = [
    { title: "World Bank API", lines: ["public, no key"] },
    { title: "WorldBankClient", lines: ["paging", "retries 429 and 5xx", "backoff"] },
    { title: "Raw layer", lines: ["api_pages, page_sightings", "exploded rows", "files per run"] },
    { title: "Staging views", lines: ["typed, trimmed", "latest sighting"] },
    { title: "Marts", lines: ["dim_country", "dim_indicator", "fct_indicator_year"] },
    { title: "Reporting views", lines: ["six rpt_ views"] },
    { title: "Exports", lines: ["CSV, Parquet", "run_summary"] },
    { title: "Dashboard", lines: ["DuckDB over Parquet", "in route handlers"] },
  ];
  return <Canvas id="flow" height={410} label="Eight steps from the public World Bank API through the client, raw, staging, marts, reporting and exports to the dashboard">{(marker) => <>
    {boxes.map((box, index) => <Box key={box.title} x={10 + index % 4 * 240} y={index < 4 ? 30 : 250} width={218} height={125} {...box} accent={index === 7} />)}
    {[0, 1, 2].map((index) => <Arrow key={`top-${index}`} d={`M ${228 + index * 240} 92 H ${250 + index * 240}`} marker={marker} />)}
    <Arrow d="M 839 155 V 205 H 119 V 250" marker={marker} />
    {[0, 1, 2].map((index) => <Arrow key={`bottom-${index}`} d={`M ${228 + index * 240} 312 H ${250 + index * 240}`} marker={marker} />)}
  </>}</Canvas>;
}

export function LayersDiagram() {
  const bands = [
    { title: "raw", note: "pages and rows append-only", relations: ["runs, api_pages, page_sightings", "country_rows, indicator_meta_rows", "observation_rows, config_spine"] },
    { title: "staging", note: "views, dedup on business key", relations: ["stg_countries, stg_indicators", "stg_observations"] },
    { title: "marts", note: "tables rebuilt from the spine", relations: ["dim_country, dim_indicator", "fct_indicator_year"] },
    { title: "reporting", note: "views exported to CSV and Parquet", relations: ["rpt_missing_data, rpt_yoy_change", "rpt_completeness_by_country_indicator", "rpt_latest_year_comparison", "rpt_latest_available_per_country", "rpt_income_group_by_year"] },
  ];
  return <Canvas id="layers" height={570} label="Four stacked schema bands: raw source storage, staging views, mart tables and exported reporting views">{(marker) => <>
    {bands.map((band, index) => <g key={band.title}>
      <rect x="20" y={20 + index * 135} width="920" height="120" rx="8" fill={index === 2 ? "var(--accent-wash)" : "var(--surface-2)"} stroke="var(--rule)" />
      <text x="36" y={50 + index * 135} fill="var(--ink)">{band.title}</text><text x="36" y={75 + index * 135} fill="var(--ink-2)">{band.note}</text>
      {band.relations.map((relation, row) => <text key={relation} x="450" y={44 + index * 135 + row * 20} fill="var(--ink-2)">{relation}</text>)}
    </g>)}
    {[0, 1, 2].map((index) => <Arrow key={index} d={`M 220 ${140 + index * 135} V ${155 + index * 135}`} marker={marker} />)}
  </>}</Canvas>;
}

export function PageIdDiagram() {
  return <Canvas id="pageid" height={475} label="Request URL and response body feed SHA-256 to create page_id; a known page appends a sighting and a new page inserts all rows in one transaction">{(marker) => <>
    <Box x={20} y={20} width={290} height={60} title="request URL" />
    <Box x={20} y={110} width={290} height={60} title="response body" />
    <Box x={400} y={65} width={150} height={60} title="SHA-256" />
    <Box x={640} y={65} width={120} height={60} title="page_id" accent />
    <Arrow d="M 310 50 H 360 V 95 H 400" marker={marker} /><Arrow d="M 310 140 H 360 V 95 H 400" marker={marker} />
    <Arrow d="M 550 95 H 640" marker={marker} /><Arrow d="M 700 125 V 155" marker={marker} />
    <Diamond cx={700} cy={235} width={320} height={160} lines={["already in", "raw.api_pages?"]} />
    <Arrow d="M 540 235 H 400 V 390 H 350" marker={marker} /><text x="425" y="220" fill="var(--ink-2)">yes</text>
    <Arrow d="M 700 315 V 355" marker={marker} /><text x="715" y="340" fill="var(--ink-2)">no</text>
    <Box x={20} y={355} width={330} height={70} title="append one page_sightings row" />
    <Box x={560} y={355} width={375} height={90} title="insert page, sighting and" lines={["exploded rows in one transaction"]} accent />
  </>}</Canvas>;
}

export function StatusDiagram() {
  return <Canvas id="status" height={460} label="An observation absent from the spine join is not_returned; a joined null is null_value; a joined number is present">{(marker) => <>
    <Diamond cx={300} cy={100} width={440} height={160} lines={["observation joined", "to the spine?"]} />
    <Arrow d="M 80 100 H 30 V 310 H 80" marker={marker} /><text x="45" y="125" fill="var(--ink-2)">no</text>
    <Box x={80} y={280} width={160} height={60} title="not_returned" pill />
    <Arrow d="M 520 100 H 670 V 150" marker={marker} /><text x="545" y="87" fill="var(--ink-2)">yes</text>
    <Diamond cx={670} cy={225} width={380} height={150} lines={["value is null?"]} />
    <Arrow d="M 480 225 H 360 V 310 H 400" marker={marker} /><text x="405" y="212" fill="var(--ink-2)">yes</text>
    <Box x={400} y={280} width={150} height={60} title="null_value" pill />
    <Arrow d="M 670 300 V 390 H 780" marker={marker} /><text x="685" y="335" fill="var(--ink-2)">no</text>
    <Box x={780} y={360} width={150} height={60} title="present" accent pill />
  </>}</Canvas>;
}

function Many({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) {
  const innerX = x + dx * 14;
  const innerY = y + dy * 14;
  return <g stroke="var(--accent)" fill="none"><path d={`M ${x - dy * 6} ${y + dx * 6} L ${innerX} ${innerY} L ${x + dy * 6} ${y - dx * 6} M ${x} ${y} L ${innerX} ${innerY}`} /></g>;
}

export function ErDiagram() {
  return <Canvas id="er" height={1020} label="Entity relationships from runs and API pages through sightings, source rows, dimensions and configuration spine to the indicator year fact, with crow's feet at many ends">{(marker) => <>
    <Arrow d="M 180 90 V 245 H 330" marker={marker} /><Many x={330} y={245} dx={-1} dy={0} />
    <Arrow d="M 470 150 V 205" marker={marker} /><Many x={470} y={205} dx={0} dy={-1} />
    <Arrow d="M 390 150 V 175 H 155 V 330" marker={marker} /><Many x={155} y={330} dx={0} dy={-1} />
    <Arrow d="M 550 150 V 175 H 785 V 330" marker={marker} /><Many x={785} y={330} dx={0} dy={-1} />
    <Arrow d="M 470 285 V 330" marker={marker} /><Many x={470} y={330} dx={0} dy={-1} />
    <Arrow d="M 155 430 V 525" marker={marker} /><Many x={155} y={430} dx={0} dy={1} />
    <Arrow d="M 785 430 V 525" marker={marker} /><Many x={785} y={430} dx={0} dy={1} />
    <Arrow d="M 300 565 H 325 V 790 H 350" marker={marker} /><Many x={350} y={790} dx={-1} dy={0} />
    <Arrow d="M 640 565 H 620 V 790 H 590" marker={marker} /><Many x={590} y={790} dx={1} dy={0} />
    <Arrow d="M 470 625 V 710" marker={marker} /><path d="M 463 694 H 477 M 463 700 H 477 M 463 640 H 477 M 463 646 H 477" stroke="var(--accent)" />
    <Arrow d="M 470 430 V 455 H 935 V 850 H 590" marker={marker} />
    <circle cx="905" cy="455" r="4" fill="var(--surface-2)" stroke="var(--accent)" /><path d="M 895 448 V 462" stroke="var(--accent)" />
    <circle cx="612" cy="850" r="4" fill="var(--surface-2)" stroke="var(--accent)" /><path d="M 623 843 V 857" stroke="var(--accent)" />
    <Box x={40} y={20} width={280} height={70} title="RUNS" lines={["run_id"]} />
    <Box x={330} y={20} width={280} height={130} title="API_PAGES" lines={["page_id", "request_url", "body"]} />
    <Box x={330} y={205} width={280} height={80} title="PAGE_SIGHTINGS" lines={["page_id, run_id"]} />
    <Box x={15} y={330} width={280} height={100} title="COUNTRY_ROWS" lines={["page_id", "row_index"]} />
    <Box x={330} y={330} width={280} height={100} title="OBSERVATION_ROWS" lines={["page_id", "row_index"]} />
    <Box x={645} y={330} width={280} height={100} title="INDICATOR_META_ROWS" lines={["page_id", "row_index"]} />
    <Box x={20} y={525} width={280} height={80} title="DIM_COUNTRY" lines={["country_iso3"]} />
    <Box x={330} y={490} width={280} height={135} title="CONFIG_SPINE" lines={["country_iso3", "indicator_code", "year"]} />
    <Box x={640} y={525} width={280} height={80} title="DIM_INDICATOR" lines={["indicator_code"]} />
    <Box x={350} y={710} width={240} height={215} title="FCT_INDICATOR_YEAR" lines={["country_iso3", "indicator_code", "year", "status", "source_page_id", "source_row_index"]} accent />
    <text x="35" y="975" fill="var(--ink-2)">Three short lines mark a many end; circles mark an optional source record.</text>
  </>}</Canvas>;
}

export function YoyDiagram() {
  const statuses = ["first_year", "ok", "ok", "current_missing", "prior_missing", "ok", "ok"];
  return <Canvas id="yoy" height={230} label="Timeline for one country and indicator from 2018 to 2024: a missing 2021 produces current_missing, then prior_missing in 2022">{(marker) => <>
    <text x="30" y="30" fill="var(--ink-2)">One country and indicator</text><Arrow d="M 40 95 H 925" marker={marker} />
    {statuses.map((status, index) => <g key={2018 + index}>
      <circle cx={70 + index * 135} cy="95" r="7" fill={index === 3 ? "var(--surface-2)" : "var(--accent-wash)"} stroke="var(--accent)" strokeWidth="2" />
      <text x={70 + index * 135} y="135" textAnchor="middle" fill={index === 3 || index === 4 ? "var(--ink-2)" : "var(--ink)"}>{2018 + index}</text>
      <text x={70 + index * 135} y={index === 4 ? 190 : 165} textAnchor="middle" fill={index === 3 || index === 4 ? "var(--ink-2)" : "var(--ink)"}>{status}</text>
    </g>)}
  </>}</Canvas>;
}

export function DiagramById({ id }: { id: string }) {
  switch (id) {
    case "flow": return <FlowDiagram />;
    case "layers": return <LayersDiagram />;
    case "pageid": return <PageIdDiagram />;
    case "status": return <StatusDiagram />;
    case "er": return <ErDiagram />;
    case "yoy": return <YoyDiagram />;
    default: throw new Error(`Unknown diagram: ${id}`);
  }
}
