"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Section, Subsection } from "@/lib/brief";
import { REPORT_LINKS } from "@/lib/site-links";

type DrawerSubsection = Pick<Subsection, "id" | "section" | "number" | "title" | "status">;

export function Drawer({ sections, subsections }: { sections: Section[]; subsections: DrawerSubsection[] }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState({ pathname, open: false });
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  const focusContent = useRef(false);
  if (menu.pathname !== pathname) setMenu({ pathname, open: false });
  const open = menu.pathname === pathname && menu.open;
  const close = () => setMenu({ pathname, open: false });
  const dismiss = () => { focusContent.current = false; restoreFocus.current = true; close(); };
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (event.currentTarget.pathname === pathname) { dismiss(); return; }
    focusContent.current = true;
    close();
  };

  useEffect(() => {
    if (!open) return;
    const trigger = button.current;
    restoreFocus.current = false;
    document.body.dataset.drawerOpen = "true";
    const background = document.querySelectorAll("#main-content, footer.site-footer, #site-brand, nav.site-nav");
    background.forEach((element) => element.toggleAttribute("inert", true));
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreFocus.current = true;
        setMenu({ pathname, open: false });
      }
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button, a[href]");
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      delete document.body.dataset.drawerOpen;
      background.forEach((element) => element.toggleAttribute("inert", false));
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocus.current) trigger?.focus();
      restoreFocus.current = false;
    };
  }, [open, pathname]);

  useEffect(() => {
    if (!focusContent.current) return;
    focusContent.current = false;
    document.getElementById("main-content")?.focus();
  }, [pathname]);

  const current = (href: string) => pathname === href ? "page" as const : undefined;
  return <>
    <button ref={button} type="button" className="menu-button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="site-drawer" onClick={() => setMenu({ pathname, open: !open })}><span className="menu-button__bar" /><span className="menu-button__bar" /><span className="menu-button__bar" /></button>
    <div className="drawer" id="site-drawer" role="dialog" aria-modal="true" aria-label="Site menu" data-open={open ? "true" : "false"} hidden={!open}>
      <div className="drawer__backdrop" onClick={dismiss} aria-hidden="true" />
      <nav className="drawer__panel" ref={panel} aria-label="Site menu links">
        <div className="drawer__head"><span>World Bank country indicators</span><button ref={closeButton} type="button" className="drawer__close" aria-label="Close menu" onClick={dismiss}>×</button></div>
        <div className="drawer__group"><h2 className="drawer__group-title">Reports</h2>{REPORT_LINKS.filter(([href]) => href !== "/brief").map(([href, label]) => <Link className="drawer__link" key={href} href={href} aria-current={current(href)} onClick={navigate}>{label}</Link>)}</div>
        <div className="drawer__group"><h2 className="drawer__group-title">Brief walkthrough</h2>
          <Link className="drawer__link drawer__link--section" href="/brief" aria-current={current("/brief")} onClick={navigate}>All requirements</Link>
          {sections.map((section) => <div key={section.number}>
            <h3 className="drawer__section"><span className="drawer__num">{section.number}</span>{section.title}</h3>
            {subsections.filter((item) => item.section === section.number).map((item) => <Link className="drawer__link drawer__link--sub" key={item.id} href={`/brief/${item.id}`} aria-current={current(`/brief/${item.id}`)} onClick={navigate}><span className="drawer__num">{item.number}</span><span className="drawer__label">{item.title}</span><span className="visually-hidden">{item.status === "met" ? ", met" : ", met with a note"}</span>{item.status === "note" ? <span className="status-chip status-chip--note drawer__note" aria-hidden="true">Note</span> : <span className="status-chip status-chip--met status-chip--dot" aria-hidden="true" />}</Link>)}
          </div>)}
        </div>
        <div className="drawer__group"><h2 className="drawer__group-title">Reference</h2>
          <Link className="drawer__link" href="/brief/architecture" aria-current={current("/brief/architecture")} onClick={navigate}>Architecture and diagrams</Link>
          <Link className="drawer__link" href="/brief/decisions" aria-current={current("/brief/decisions")} onClick={navigate}>Decision log</Link>
          <a className="drawer__link" href="https://github.com/alexgrigoretech/lateral" rel="noreferrer" target="_blank" onClick={dismiss}>Repository on GitHub</a>
        </div>
      </nav>
    </div>
  </>;
}
