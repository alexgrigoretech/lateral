// snippets.json is regenerated with npm run snippets and checked by npm run lint.
import content from "@/content/brief.json";
import samples from "@/content/snippets.json";

export type Status = "met" | "note";
export type Snippet = { file: string; start: number; end: number; caption: string; lang: "python" | "sql" | "yaml" | "typescript" | "make" | "docker" };
export type Verify = { cmd: string; expect: string };
export type Live = { href: string; label: string };
export type Subsection = { id: string; section: number; number: string; title: string; requirement: string; status: Status; note?: string; summary: string; details: string[]; snippets: Snippet[]; diagrams: string[]; decisions: string[]; live: Live[]; verify: Verify[] };
export type Section = { number: number; title: string; intro: string };
export type Decision = { id: string; title: string; context: string; options: string[]; choice: string; consequence: string; subsections: string[] };
export type Diagram = { id: string; title: string; caption: string };

type Brief = { sections: Section[]; subsections: Subsection[]; decisions: Decision[]; diagrams: Diagram[] };
type CollectedSnippet = { file: string; start: number; end: number; code: string };
const brief = content as Brief;
const snippets: Record<string, CollectedSnippet> = samples;

export function getSections() { return brief.sections; }
export function getSubsections() { return brief.subsections; }
export function getSubsection(id: string) { return brief.subsections.find((item) => item.id === id); }
export function getDecisions() { return brief.decisions; }
export function getDecision(id: string) { return brief.decisions.find((item) => item.id === id); }
export function getDiagrams() { return brief.diagrams; }
export function githubUrl(file: string, start: number, end: number) {
  return `https://github.com/alexgrigoretech/lateral/blob/main/${file}#L${start}-L${end}`;
}
export function getSnippet({ file, start, end }: Snippet) {
  const key = `${file}#${start}-${end}`;
  const snippet = snippets[key];
  if (!snippet) throw new Error(`Missing collected snippet: ${key}`);
  return snippet;
}
export function counts() {
  return { total: brief.subsections.length, met: brief.subsections.filter((item) => item.status === "met").length, note: brief.subsections.filter((item) => item.status === "note").length };
}
export function neighbours(id: string) {
  const index = brief.subsections.findIndex((item) => item.id === id);
  return { previous: index > 0 ? brief.subsections[index - 1] : undefined, next: index >= 0 ? brief.subsections[index + 1] : undefined };
}
