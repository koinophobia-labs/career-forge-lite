"use client";

import Link from "next/link";
import { primaryStations, secondaryStations } from "@/lib/nav-stations";

type CommandNavProps = {
  active: string;
};

export function CommandNav({ active }: CommandNavProps) {
  return (
    <header className="relative z-40 border-b border-white/10 bg-obsidian/84 px-5 py-4 backdrop-blur-xl sm:px-8 md:sticky md:top-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="group inline-flex items-center gap-3" aria-label="Career Forge dashboard">
          <span className="logo-mark" aria-hidden="true">
            CF
          </span>
          <span className="leading-none">
            <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Career Forge</span>
            <span className="block text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/56">
              Koinophobia Labs
            </span>
          </span>
        </Link>

        <div className="flex flex-col gap-1.5 md:items-end">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-paper/70 md:justify-end" aria-label="Primary">
            {primaryStations.map(([label, href]) => (
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
          <nav
            className="flex flex-wrap items-center gap-1 text-[0.68rem] font-bold text-paper/40 md:justify-end"
            aria-label="More"
          >
            {secondaryStations.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-2.5 py-1 transition ${
                  active === href ? "bg-white/10 text-gold" : "hover:bg-white/5 hover:text-cyan"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
