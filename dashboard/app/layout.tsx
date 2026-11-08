import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { getMeta } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "World Bank country indicators", template: "%s | World Bank country indicators" },
  description: "Country indicators, completeness, year over year changes and source lineage from the World Bank Indicators API.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let runId: string | null = null;
  try {
    runId = (await getMeta()).latest_run?.run_id ?? null;
  } catch {
    // Keep navigation and the error boundary available if the data cannot be read.
  }
  return (
    <html lang="en">
      <body>
        <a className="visually-hidden" href="#main-content">Skip to content</a>
        <header className="site-header"><Link href="/" className="site-header__brand">World Bank country indicators</Link><Navigation /></header>
        <main className="site-main" id="main-content">{children}</main>
        <footer className="site-footer"><p>Pipeline run: {runId ?? "Not available"}</p><p>Source: World Bank Indicators API</p></footer>
      </body>
    </html>
  );
}
