export function BetaSafetyBanner() {
  return (
    <aside
      role="note"
      aria-label="Career Forge public beta notice"
      className="border-b border-gold/35 bg-gold/10 px-4 py-2.5 text-center text-xs font-semibold leading-5 text-paper/78"
    >
      <strong className="text-gold">PUBLIC BETA</strong>
      <span aria-hidden="true"> · </span>
      Generated résumés and career materials are drafts. Review every claim, date, heading, and export before use.
    </aside>
  );
}
