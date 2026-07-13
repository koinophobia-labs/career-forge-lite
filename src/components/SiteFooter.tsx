const productLinks: Array<[string, string, string, boolean]> = [
  ["You Know Ball", "LIVE", "gold", false],
  ["Creator Command Center", "BUILD", "cyan", false],
  ["KOI Cave", "LOCAL", "ember", false],
  ["Career Forge Lite", "MODULE 05", "cyan", true]
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
                Product Lab Module 05
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-sm leading-6">
            Product Lab Module 05. Built and shipped by Koinophobia Labs.
            Created to translate real work into recruiter-ready language.
            Career Forge stays local, editable, ATS-safe, and unbranded in exported resume content.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
            <a
              href="https://koinophobialabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-coral transition hover:text-coral/80"
            >
              Built by Koinophobia Labs ↗
            </a>
            <a
              href="https://koinophobia.dev/connect"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper/70 transition hover:text-cyan"
            >
              Meet the founder ↗
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-paper">Product Lab</h2>
          <div className="mt-4 space-y-3">
            {productLinks.map(([name, status, accent, active]) => (
              <div
                key={name}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                  active ? "border-cyan/35 bg-cyan/10" : "border-white/10 bg-white/5"
                }`}
              >
                <span className="inline-flex items-center gap-2 text-paper/78">
                  <span className={`ecosystem-dot ecosystem-dot-${accent}`} aria-hidden="true" />
                  {name}
                </span>
                <span className={`text-[0.65rem] font-black uppercase tracking-[0.14em] ${
                  active ? "text-cyan" : "text-paper/45"
                }`}>
                  {status}
                </span>
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
