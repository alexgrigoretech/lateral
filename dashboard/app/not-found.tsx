import Link from "next/link";

export default function NotFound() {
  return <div className="page"><h1 className="page__title">Page not found</h1><p className="page__lede">This page, country or selection is not in the current dataset.</p><Link href="/">Return to overview</Link></div>;
}
