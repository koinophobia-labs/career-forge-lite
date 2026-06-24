import Image from "next/image";

type LandingPageProps = {
  onStart: () => void;
};

export function LandingPage({ onStart }: LandingPageProps) {
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
      <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-5 py-14 sm:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="trust-kicker mb-4 text-sm font-bold uppercase">
              Koinophobia Labs - Career Utility
            </p>
            <h1 className="text-4xl font-bold leading-[1.02] text-paper sm:text-6xl">
              Turn real work into recruiter-ready resume language.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-paper/75">
              Career Forge Lite translates everyday experience into an editable,
              ATS-safe resume package and searchable LinkedIn headline for early-career
              tech, business, operations, support, admin, and sales roles.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStart}
                className="min-h-12 rounded-md bg-gold px-6 text-base font-bold text-ink shadow-soft transition hover:bg-cyan"
              >
                Build Resume Package
              </button>
              <a
                href="#proof"
                className="inline-flex min-h-12 items-center rounded-md border border-white/15 bg-white/10 px-6 text-base font-bold text-paper transition hover:border-cyan hover:text-cyan"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em] text-paper/70">
              <span className="rounded-md border border-gold/35 bg-gold/10 px-3 py-2 text-gold">No login</span>
              <span className="rounded-md border border-cyan/30 bg-cyan/10 px-3 py-2 text-cyan">ATS-safe</span>
              <span className="rounded-md border border-ember/35 bg-ember/10 px-3 py-2 text-ember">Editable drafts</span>
            </div>
          </div>

          <div className="trust-panel rounded-md p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <strong className="text-sm uppercase tracking-[0.16em] text-paper">forge://translation</strong>
              <span className="rounded-md bg-cyan/10 px-2 py-1 text-xs font-bold text-cyan">LIVE MVP</span>
            </div>
            <div className="space-y-4">
              <div className="trust-card rounded-md p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-paper/50">Input</span>
                <p className="mt-2 text-lg font-bold text-paper">helped customers</p>
              </div>
              <div className="trust-card rounded-md border-gold/30 bg-gold/10 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Output</span>
                <p className="mt-2 leading-7 text-paper">
                  Supported customer requests, documented issue status, and escalated
                  complex cases to improve response consistency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-4 px-5 pb-14 sm:px-8 md:grid-cols-3" id="proof">
        {[
          ["How it works", "Answer a guided career interview, choose an ATS-safe template, then edit the generated resume and LinkedIn copy."],
          ["Built for", "Early-career professionals, career changers, and job seekers translating support, operations, admin, sales, IT, and project work."],
          ["No fluff", "No fake ATS score, no fake testimonials, no account wall. Just practical draft language you can review and copy."]
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
