import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PACKAGES } from "@/lib/packages";

export const metadata = {
  title: "Founding Career Reset Cohort — Career Forge",
  description: "Join one of five founding Career Reset purchases: a one-time, one-lane Career Forge pack with guided onboarding and priority support."
};

const reset = PACKAGES.reset;

const fitSignals = [
  "You are actively restarting, cleaning up, or refocusing a real job search.",
  "You can complete the work-history-to-export workflow within seven days of purchase.",
  "You will review every claim and use at least one résumé or job-search artifact in a real application.",
  "You are willing to share honest feedback and the optional content-free pilot summary."
];

const foundingExtras = [
  "Guided onboarding through work-history import and fact review",
  "Priority support while you build your first one-lane résumé pack",
  "A direct channel for reporting friction and shaping the paid product",
  "Founding-cohort recognition, with no public attribution unless you approve it"
];

export default function FoundingBetaPage() {
  return (
    <main>
      <CommandNav active="/founding-beta" />

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="trust-panel overflow-hidden">
          <div className="p-6 sm:p-9">
            <p className="trust-kicker text-sm font-bold uppercase">Founding paid beta · Five purchases</p>
            <div className="mt-3 grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div>
                <h1 className="max-w-3xl text-4xl font-bold leading-tight text-paper sm:text-6xl">
                  Reset one job-search direction without rebuilding your career from scratch.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-paper/72">
                  Career Reset is for people who need one credible role direction and a reusable, evidence-backed foundation.
                  You review the facts. Career Forge turns those approved facts into ATS and recruiter résumé drafts, LinkedIn
                  positioning, and exportable files.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/pricing" className="lab-pill-button inline-flex min-h-11 items-center px-6 py-3 text-sm font-black">
                    Start Career Reset →
                  </Link>
                  <Link href="/" className="inline-flex min-h-11 items-center rounded-md border border-cyan/40 bg-cyan/10 px-6 py-3 text-sm font-bold text-cyan">
                    Build and review free first
                  </Link>
                </div>
                <p className="mt-3 text-xs leading-5 text-paper/55">
                  Secure checkout charges ${reset.priceUsd} once. Career Reset is the only paid tier in the founding beta, and checkout closes after five completed purchases.
                </p>
              </div>

              <aside className="rounded-xl border border-gold/35 bg-gold/10 p-5 sm:p-6">
                <p className="lab-mono text-xs font-black uppercase tracking-[0.14em] text-gold">Founding price</p>
                <p className="mt-2 text-5xl font-black text-paper">${reset.priceUsd}</p>
                <p className="mt-1 text-sm font-bold text-paper/65">one time · no subscription</p>
                <p className="mt-4 text-sm leading-6 text-paper/72">
                  One active role direction, the complete Career Reset deliverables, and founding-cohort support. Higher tiers remain closed until their own outcomes are validated.
                </p>
                <div className="mt-5 rounded-lg border border-cyan/25 bg-cyan/5 p-3 text-xs leading-5 text-paper/65">
                  Secure checkout is live. After payment, your license appears on the confirmation page and unlocks Career Reset on this device.
                </div>
              </aside>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-labelledby="included-title">
          <div className="trust-panel p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">The product scope</p>
            <h2 id="included-title" className="mt-2 text-2xl font-bold text-paper">What the Career Reset Pack includes</h2>
            <ul className="mt-4 grid gap-2">
              {reset.deliverables.map((item) => (
                <li key={item} className="rounded-lg border border-white/10 bg-obsidian/35 px-3 py-2.5 text-sm leading-6 text-paper/75">
                  <span aria-hidden="true" className="mr-2 text-mint">✓</span>{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="trust-panel p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">The founding layer</p>
            <h2 className="mt-2 text-2xl font-bold text-paper">What is added for this cohort</h2>
            <ul className="mt-4 grid gap-2">
              {foundingExtras.map((item) => (
                <li key={item} className="rounded-lg border border-white/10 bg-obsidian/35 px-3 py-2.5 text-sm leading-6 text-paper/75">
                  <span aria-hidden="true" className="mr-2 text-cyan">+</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="trust-panel mt-8 p-5 sm:p-7" aria-labelledby="fit-title">
          <p className="trust-kicker text-xs font-bold uppercase">Cohort fit</p>
          <h2 id="fit-title" className="mt-2 text-2xl font-bold text-paper">This works only with real job-search behavior.</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {fitSignals.map((item) => (
              <p key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-paper/72">{item}</p>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-paper/62">
            Career Forge creates reviewable drafts, not guaranteed interviews or offers. You remain responsible for checking every date, claim, company, and final file before sending it.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-cyan/25 bg-cyan/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-paper">Want the work done for you instead?</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-paper/65">
                The separate $149 Career Forge Résumé Rebuild includes human review, rebuilt files, target-role directions, and a walkthrough. It is not the self-serve SaaS cohort.
              </p>
            </div>
            <Link href="/reviewed-service" className="inline-flex min-h-11 items-center rounded-md border border-gold/45 px-5 py-2.5 text-sm font-bold text-gold">
              See the human service →
            </Link>
          </div>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
