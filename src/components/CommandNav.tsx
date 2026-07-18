"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackCareerEvent } from "@/lib/analytics";
import { SaveStatusPill } from "@/components/SaveStatusPill";

const stations: Array<[string, string]> = [
  ["Dashboard", "/"],
  ["Career Dossier", "/profile"],
  ["Truth Map", "/truth-map"],
  ["Career Lanes", "/targets"],
  ["Résumé Pack", "/versions"],
  ["Tailor", "/tailor"],
  ["Applications", "/applications"],
  ["Outreach", "/outreach"],
  ["Guided Setup", "/resume-builder"],
  ["Interview Prep", "/interview"],
  ["Weekly", "/weekly"],
  ["Pricing", "/pricing"],
  ["Data", "/settings"]
];

type CommandNavProps = { active: string };

export function CommandNav({ active }: CommandNavProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  // The mobile menu is a native details/summary; give it the dismissal
  // behavior users expect from a menu: Escape and outside-tap both close it.
  useEffect(() => {
    function closeIfOutside(event: MouseEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) menuRef.current.open = false;
    }
    document.addEventListener("click", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function skipToContent(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const main = document.querySelector("main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus();
    }
  }

  return (
    <header className="relative z-40 border-b border-white/10 bg-obsidian/84 px-5 py-4 backdrop-blur-xl sm:px-8 md:sticky md:top-0">
      <a
        href="#main"
        onClick={skipToContent}
        className="sr-only rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="group inline-flex items-center gap-3" aria-label="Career Forge dashboard">
            <span className="logo-mark" aria-hidden="true">CF</span>
            <span className="leading-none">
              <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Career Forge</span>
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper/56">
                Leverage for your job search
              </span>
            </span>
          </Link>
          <a
            href="https://koinophobialabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="lab-mono hidden rounded-full border border-coral/30 bg-coral/10 px-3 py-2 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-coral transition hover:border-coral hover:bg-coral/15 sm:inline-flex"
          >
            A Koinophobia Labs system ↗
          </a>
          <SaveStatusPill />
        </div>

        <details ref={menuRef} className="relative md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-paper/75">Menu</summary>
          <nav aria-label="Career Forge mobile stations" className="absolute right-0 top-12 z-50 grid max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-white/15 bg-obsidian p-2 shadow-2xl">
            {stations.map(([label, href]) => <Link key={href} href={href} onClick={() => { if (href === "/truth-map") trackCareerEvent("truth_map_opened"); }} className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold ${active === href ? "bg-gold/10 text-gold" : "text-paper/70 hover:bg-white/5 hover:text-cyan"}`}>{label}</Link>)}
          </nav>
        </details>

        <nav aria-label="Career Forge stations" className="hidden flex-wrap items-center justify-end gap-1.5 text-xs font-bold text-paper/70 md:flex">
          {stations.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              onClick={() => { if (href === "/truth-map") trackCareerEvent("truth_map_opened"); }}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-2 transition ${
                active === href
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-transparent hover:border-cyan/35 hover:bg-white/5 hover:text-cyan"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
