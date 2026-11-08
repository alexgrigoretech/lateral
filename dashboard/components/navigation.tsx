"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "Overview"],
  ["/missing", "Missing data"],
  ["/yoy", "Year over year"],
  ["/latest", "Latest year"],
  ["/income-groups", "Income groups"],
  ["/about", "About"],
] as const;

export function Navigation() {
  const pathname = usePathname();
  return <nav className="site-nav" aria-label="Main navigation">
    {links.map(([href, label]) => <Link className="site-nav__link" key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
