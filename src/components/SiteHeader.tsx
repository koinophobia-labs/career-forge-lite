"use client";

import { trackCtaClick } from "@/lib/analytics";

type SiteHeaderProps = {
  onStart: () => void;
};

const navItems = [
  ["Dashboard", "/"],
  ["Overview", "#landing"],
  ["Choose Path", "#paths"],
  ["Why Trust It", "#trust"],
  ["Builder", "#demo"],
  ["About", "#ecosystem"]
];

export function SiteHeader({ onStart }: SiteHeaderProps) {
  return (
    <header className="relative z-40 border-b border-white/10 bg-obsidian/84 px-5 py-4 backdrop-blur-xl sm:px-8 md:sticky md:top-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <a href="#landing" className="group inline-flex items-center gap-3" aria-label="Career Forge Lite home">
          <span className="logo-mark" aria-hidden="true">
            CF
          </span>
          <span className="leading-none">
            <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Koinophobia</span>
            <span className="block text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/56">
              Labs / Module 05
            </span>
          </span>
        </a>

        <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-paper/70 md:justify-end">
          {navItems.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-full border border-transparent px-3 py-2 transition hover:border-cyan/35 hover:bg-white/5 hover:text-cyan"
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              trackCtaClick("nav_build_resume", "#demo");
              onStart();
            }}
            className="lab-pill-button px-4 py-2 font-black transition"
          >
            Build Resume
          </button>
        </nav>
      </div>
    </header>
  );
}
