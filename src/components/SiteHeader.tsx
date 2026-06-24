"use client";

type SiteHeaderProps = {
  onStart: () => void;
};

const navItems = [
  ["Product Lab", "#landing"],
  ["How It Works", "#proof"],
  ["Receipts", "#ats-checks"],
  ["About", "#ecosystem"]
];

export function SiteHeader({ onStart }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/86 px-5 py-4 backdrop-blur-xl sm:px-8">
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
              className="rounded-md border border-transparent px-3 py-2 transition hover:border-cyan/35 hover:text-cyan"
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={onStart}
            className="rounded-md bg-gold px-4 py-2 font-black text-ink transition hover:bg-cyan"
          >
            Start the Interview
          </button>
        </nav>
      </div>
    </header>
  );
}
