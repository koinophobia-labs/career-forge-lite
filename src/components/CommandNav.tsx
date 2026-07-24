"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackCareerEvent } from "@/lib/analytics";
import { SaveStatusPill } from "@/components/SaveStatusPill";

type Station = readonly [label: string, href: string];

const primaryStations: Station[] = [
  ["Today", "/"],
  ["Résumé", "/versions"],
  ["Jobs", "/tailor"],
  ["Applications", "/applications"]
];

const workspaceStations: Station[] = [
  ["Work History", "/profile"],
  ["Target Roles", "/targets"],
  ["Interview Practice", "/interview"],
  ["Role Sprints", "/role-sprint"],
  ["Outreach", "/outreach"],
  ["Data & Backup", "/settings"]
];

type CommandNavProps = { active: string };

export function CommandNav({ active }: CommandNavProps) {
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const workspaceMenuRef = useRef<HTMLDetailsElement>(null);
  const workspaceIsActive = workspaceStations.some(([, href]) => href === active);

  useEffect(() => {
    function closeIfOutside(event: MouseEvent) {
      for (const menu of [mobileMenuRef.current, workspaceMenuRef.current]) {
        if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileMenuRef.current?.open) mobileMenuRef.current.open = false;
      if (workspaceMenuRef.current?.open) workspaceMenuRef.current.open = false;
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

  function handleStationClick(href: string) {
    if (href === "/truth-map") trackCareerEvent("truth_map_opened");
    if (mobileMenuRef.current?.open) mobileMenuRef.current.open = false;
    if (workspaceMenuRef.current?.open) workspaceMenuRef.current.open = false;
  }

  function menuLinkClass(href: string) {
    return `flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold ${
      active === href ? "bg-gold/10 text-gold" : "text-paper/70 hover:bg-white/5 hover:text-cyan"
    }`;
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
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="group inline-flex min-w-0 items-center gap-3" aria-label="Career Forge home">
            <span className="logo-mark shrink-0" aria-hidden="true">CF</span>
            <span className="min-w-0 leading-none">
              <span className="block truncate text-xs font-black uppercase tracking-[0.18em] text-gold">Career Forge</span>
              <span className="hidden text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper/56 sm:block">
                One clear next step
              </span>
            </span>
          </Link>
          <SaveStatusPill />
        </div>

        <details ref={mobileMenuRef} className="relative md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-paper/75">Menu</summary>
          <nav aria-label="Career Forge mobile navigation" className="absolute right-0 top-12 z-50 grid max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-white/15 bg-obsidian p-2 shadow-2xl">
            {primaryStations.map(([label, href]) => (
              <Link key={href} href={href} onClick={() => handleStationClick(href)} className={menuLinkClass(href)}>{label}</Link>
            ))}
            <p className="px-3 pb-1 pt-3 text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/35">Workspace</p>
            {workspaceStations.map(([label, href]) => (
              <Link key={href} href={href} onClick={() => handleStationClick(href)} className={menuLinkClass(href)}>{label}</Link>
            ))}
          </nav>
        </details>

        <nav aria-label="Career Forge navigation" className="hidden items-center justify-end gap-1.5 text-xs font-bold text-paper/70 md:flex">
          {primaryStations.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              onClick={() => handleStationClick(href)}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-2 transition ${
                active === href
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-transparent hover:border-cyan/35 hover:bg-white/5 hover:text-cyan"
              }`}
            >
              {label}
            </Link>
          ))}
          <details ref={workspaceMenuRef} className="relative">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center rounded-full border px-3 py-2 transition ${
              workspaceIsActive
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-transparent text-paper/70 hover:border-cyan/35 hover:bg-white/5 hover:text-cyan"
            }`}>
              Workspace
            </summary>
            <div className="absolute right-0 top-12 z-50 grid w-60 rounded-xl border border-white/15 bg-obsidian p-2 shadow-2xl">
              {workspaceStations.map(([label, href]) => (
                <Link key={href} href={href} onClick={() => handleStationClick(href)} className={menuLinkClass(href)}>{label}</Link>
              ))}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
