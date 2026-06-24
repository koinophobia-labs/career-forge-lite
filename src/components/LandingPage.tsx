import Image from "next/image";

type LandingPageProps = {
  onStart: () => void;
};

export function LandingPage({ onStart }: LandingPageProps) {
  const proofItems = [
    ["LOCAL", "No login or saved account"],
    ["ATS", "Single-column resume output"],
    ["EDITABLE", "Copy, revise, export"]
  ];

  return (
    <section className="relative overflow-hidden border-b border-white/10" id="landing">
      <div className="absolute inset-0 opacity-35">
        <Image
          src="/career-forge-hero.png"
          alt=""
          priority
          fill
          sizes="100vw"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/92 to-obsidian/40" />
      <div className="relative mx-auto flex min-h-[82vh] max-w-6xl flex-col justify-center px-5 py-14 sm:px-8">
        <div className="mb-12 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 text-xs font-bold uppercase tracking-[0.16em] text-paper/60">
          <span>koinophobia://product-lab</span>
          <span className="text-gold">Career utility - Live MVP</span>
        </div>
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="trust-kicker mb-4 text-sm font-bold uppercase">
              Built by Koinophobia Labs - Career Forge Lite
            </p>
            <h1 className="text-4xl font-bold leading-[1.02] text-paper sm:text-6xl">
              Turn real work into <span className="text-cyan">recruiter-ready</span> resume language.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-paper/75">
              A practical Product Lab tool for early-career candidates who need clear
              resume proof, not inflated AI filler. Answer the interview, review the
              draft, and ship a cleaner resume package.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStart}
                className="min-h-12 rounded-md bg-gold px-6 text-base font-bold text-ink shadow-soft transition hover:bg-cyan"
              >
                Start the Interview
              </button>
              <a
                href="#proof"
                className="inline-flex min-h-12 items-center rounded-md border border-white/15 bg-white/10 px-6 text-base font-bold text-paper transition hover:border-cyan hover:text-cyan"
              >
                View the Receipts
              </a>
            </div>
            <div className="mt-7 grid max-w-xl gap-2 text-xs font-bold uppercase tracking-[0.12em] text-paper/70 sm:grid-cols-3">
              {proofItems.map(([label, detail]) => (
                <span key={label} className="rounded-md border border-white/12 bg-white/5 px-3 py-3">
                  <span className="block text-gold">{label}</span>
                  <span className="mt-1 block text-[0.68rem] leading-4 text-paper/60">{detail}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="trust-panel rounded-md p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <strong className="text-sm uppercase tracking-[0.16em] text-paper">career://dossier</strong>
              <span className="rounded-md bg-cyan/10 px-2 py-1 text-xs font-bold text-cyan">LIVE MVP</span>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2 border-b border-white/10 pb-4 text-[0.64rem] font-black uppercase tracking-[0.12em] text-paper/48">
              <span>
                Status
                <strong className="mt-1 block text-cyan">Shipping</strong>
              </span>
              <span>
                Stack
                <strong className="mt-1 block text-paper">Web</strong>
              </span>
              <span>
                Mode
                <strong className="mt-1 block text-gold">Build in public</strong>
              </span>
            </div>
            <div className="space-y-4">
              <div className="trust-card rounded-md p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-paper/50">Raw experience</span>
                <p className="mt-2 text-lg font-bold text-paper">helped customers</p>
              </div>
              <div className="trust-card rounded-md border-gold/30 bg-gold/10 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Resume language</span>
                <p className="mt-2 leading-7 text-paper">
                  Supported customer requests, documented issue status, and escalated
                  complex cases to improve response consistency.
                </p>
              </div>
            </div>
            <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-paper/60">
              Created alongside the Koinophobia Labs Product Lab: You Know Ball,
              Creator Command Center, and KOI Cave. Link only, no account wall.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-4 px-5 pb-14 sm:px-8 md:grid-cols-3" id="proof">
        {[
          ["01 / Interview", "Guided prompts pull out role, tools, scope, responsibilities, and outcomes without making you write perfect resume copy first."],
          ["02 / Translation", "The generator turns plain work into editable bullets, skills, a summary, and a concise LinkedIn headline."],
          ["03 / Receipts", "ATS checks stay practical: standard headings, single column, skills, action verbs, and quantified context. No fake score."]
        ].map(([title, body]) => (
          <article key={title} className="trust-card rounded-md p-5">
            <h2 className="text-lg font-bold text-paper">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-paper/70">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
