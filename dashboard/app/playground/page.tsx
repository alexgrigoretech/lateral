import type { Metadata } from "next";
import { Playground } from "@/components/playground";
import { ROUTES } from "@/lib/playground";
import { playgroundOptions } from "@/lib/playground-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Try the API" };

export default async function PlaygroundPage() {
  const options = await playgroundOptions();
  return <div className="page">
    <header><h1 className="page__title">Try the API</h1><p className="page__lede">Every route behind this site, callable from here. Pick a route and its parameters, copy the request in curl, Python or Node, or run it and read the response. The routes are read only and need no key.</p></header>
    <Playground options={options} />
    <section className="section" aria-labelledby="routes-title">
      <h2 className="section__title" id="routes-title">All routes</h2>
      <div className="table-scroll" role="region" aria-label="Routes" tabIndex={0}><table className="data-table data-table--static-head routes-table">
        <caption>Every route answers GET with JSON, except the export route, which answers with the file</caption>
        <thead><tr><th scope="col">Route</th><th scope="col">Path</th><th scope="col">Parameters</th><th scope="col">Returns</th></tr></thead>
        <tbody>{ROUTES.map((route) => <tr key={route.id}><th scope="row">{route.label}</th><td><code>{route.pattern}</code></td><td>{route.params.length ? route.params.join(", ") : <span className="na">none</span>}</td><td>{route.returns}</td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
