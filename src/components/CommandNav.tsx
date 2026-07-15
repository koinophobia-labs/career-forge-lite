"use client";

import Link from "next/link";

const stations: Array<[string, string]> = [
  ["Dashboard", "/"],
  ["Career Dossier", "/profile"],
  ["Career Lanes", "/targets"],
  ["Résumé Pack", "/versions"],
  ["Tailor", "/tailor"],
  ["Applications", "/applications"],
  ["Outreach", "/outreach"],
  ["Guided Setup", "/resume-builder"],
  ["Interview Prep", "/interview"],
  ["Weekly", "/weekly"],
  ["Data", "/settings"]
];

type CommandNavProps = { active: string };

export function CommandNav({ active }: CommandNavProps) {
  return (
    <header className="relative z-40 border-b border-white/10 bg-obsidian/84 px-5 py-4 backdrop-blur-xl sm:px-8 md:sticky md:top-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
            className="lab-mono rounded-full border border-coral/30 bg-coral/10 px-3 py-2 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-coral transition hover:border-coral hover:bg-coral/15"
          >
            A Koinophobia Labs system ↗
          </a>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-paper/70 md:justify-end">
          {stations.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full border px-3 py-2 transition ${
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
