"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page"><h1 className="page__title">The data could not be loaded</h1><p className="page__lede">The reporting files may be unavailable. Try loading this page again.</p><button type="button" onClick={reset}>Try again</button></div>;
}
