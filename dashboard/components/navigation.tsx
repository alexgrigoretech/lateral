"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPORT_LINKS } from "@/lib/site-links";

export function Navigation() {
  const pathname = usePathname();
  return <nav className="site-nav" aria-label="Main navigation">
    {REPORT_LINKS.map(([href, label]) => <Link className="site-nav__link" key={href} href={href} aria-current={(href === "/brief" ? pathname.startsWith("/brief") && pathname !== "/brief/architecture" : pathname === href) ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
