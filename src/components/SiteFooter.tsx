const productLinks = [
  ["You Know Ball", "LIVE", "gold"],
  ["Creator Command Center", "BUILD", "cyan"],
  ["KOI Cave", "LOCAL", "ember"],
  ["Career Forge Lite", "LIVE", "cyan"]
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-10 text-sm text-paper/64 sm:px-8" id="ecosystem">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.1fr_1fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-3">
            <span className="logo-mark" aria-hidden="true">
              CF
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Koinophobia Labs</span>
              <span className="block text-[0.7rem] font-bold uppercase tracking-[0.2em] text-paper/50">
                Product Lab utility
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-sm leading-6">
            Built by Koinophobia Labs. Part of the Product Lab. Career Forge stays local,
            editable, ATS-safe, and unbranded in exported resume content.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-paper">Product Lab</h2>
          <div className="mt-4 space-y-3">
            {productLinks.map(([name, status, accent]) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-paper/78">
                  <span className={`ecosystem-dot ecosystem-dot-${accent}`} aria-hidden="true" />
                  {name}
                </span>
                <span className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/45">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-paper">Utility</h2>
          <div className="mt-4 grid gap-2 text-paper/66">
            <span>No login</span>
            <span>No database</span>
            <span>No fake ATS score</span>
            <span>Single-column resume output</span>
            <span>Browser print/export path</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
