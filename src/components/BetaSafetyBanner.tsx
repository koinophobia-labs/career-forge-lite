export function BetaSafetyBanner() {
  return (
    <aside
      role="note"
      aria-label="Career Forge public beta notice"
      className="border-b border-white/10 bg-obsidian/70 px-4 py-2 text-center text-[0.7rem] font-semibold leading-5 text-paper/62 backdrop-blur-xl"
    >
      <strong className="mr-2 inline-flex rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 font-black uppercase tracking-[0.12em] text-cyan">
        Beta
      </strong>
      Generated résumés and career materials are drafts. Review every claim, date, heading, and export before use.
    </aside>
  );
}
