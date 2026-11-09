"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page">
    <header><h1 className="page__title">The data could not be loaded</h1><p className="page__lede">The reporting files behind this page could not be read{error.digest ? ` (reference ${error.digest})` : ""}.</p></header>
    <div className="empty-state">
      <h2 className="empty-state__title">What to check</h2>
      <p className="empty-state__text">The health route reports whether the committed Parquet files and the manifest are readable: <a href="/api/health">/api/health</a>.</p>
      <p className="empty-state__text"><button type="button" className="button" onClick={reset}>Load the page again</button></p>
    </div>
  </div>;
}
