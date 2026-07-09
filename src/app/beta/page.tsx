"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { CommandNav } from "@/components/CommandNav";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { SiteFooter } from "@/components/SiteFooter";
import { trackBetaCtaClick, trackBetaOfferVisit, trackDemoCampaign } from "@/lib/analytics";
import { BETA_PRICE_LABEL, BETA_SEATS_LABEL, resolveBetaCta } from "@/lib/beta-config";
import { isProfileStarted } from "@/lib/command-center-store";
import { buildDemoState, isDemoState } from "@/lib/demo-data";
import { useCommandCenter } from "@/lib/use-command-center";

const systemLoop = [
  ["Paste the post", "Drop any job posting in — keywords, requirements, and weak spots extracted in seconds"],
  ["Get your angle", "The engine recommends which resume lane fits and builds a Match Brief: why you fit, what to say, what to prepare for"],
  ["Apply + message", "A ready-to-send outreach message comes with every brief — applications stop going in cold"],
  ["Never drop a thread", "Every application gets a follow-up date automatically; the dashboard surfaces what's due today"],
  ["Walk in prepared", "Interview prep builds gap-defense questions from the actual posting you applied to"]
] as const;

const included = [
  "The full campaign system: Tailor, Match Briefs, resume-lane recommendations, application tracker, outreach templates, interview prep",
  "Weekly plan on your dashboard — the 3–5 moves that matter this week, computed from your real activity",
  "Local-first and private: no login, no account, your data never leaves your browser",
  "Direct line to the builder — beta feedback gets read and shipped fast",
  "Founding-member pricing locked for anything Career Forge becomes next"
];

const notIncluded = [
  "No accounts or cloud sync yet — use the backup file in Data to move between devices",
  "No AI text generation — every output is deterministic, rule-based, and honest",
  "No job board or auto-apply — this is a command center, not a spam cannon"
];

export default function BetaPage() {
  const { state, update, hydrated } = useCommandCenter();
  const cta = useMemo(() => resolveBetaCta(), []);
  const demoActive = hydrated && isDemoState(state);
  const canLoadDemo = hydrated && !demoActive && !isProfileStarted(state.profile) && !state.applications.length;

  useEffect(() => {
    trackBetaOfferVisit();
  }, []);

  function loadDemo() {
    trackDemoCampaign("loaded");
    update(() => buildDemoState(new Date().toISOString()));
  }

  return (
    <main>
      <CommandNav active="/beta" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Paid beta · {BETA_SEATS_LABEL}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold text-paper sm:text-5xl">
          Run your job search as a campaign, not a pile of tabs.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
          Career Forge is a job-search campaign system. The free resume builder is one station — the beta is the whole
          operation: paste a job post, get the resume lane and Match Brief that fit it, send the outreach message,
          track the follow-up, and prep the interview from the same analysis. Nothing invented, nothing forgotten.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-5">
          {systemLoop.map(([title, detail], index) => (
            <div key={title} className="rounded-xl border border-white/12 bg-obsidian/40 p-4">
              <span className="lab-mono block text-xs font-bold text-gold">{String(index + 1).padStart(2, "0")}</span>
              <span className="mt-2 block text-sm font-bold text-paper">{title}</span>
              <span className="mt-1 block text-[0.72rem] leading-5 text-paper/55">{detail}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">What the beta includes</h2>
              <ul className="mt-4 grid gap-2.5">
                {included.map((item) => (
                  <li key={item} className="rounded-lg border border-spruce/25 bg-mint/5 p-3 text-sm leading-6 text-paper/75">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">What it deliberately isn&rsquo;t</h2>
              <ul className="mt-4 grid gap-2.5">
                {notIncluded.map((item) => (
                  <li key={item} className="rounded-lg border border-white/12 bg-obsidian/40 p-3 text-sm leading-6 text-paper/65">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid content-start gap-6">
            <div className="trust-panel border-gold/30 p-5 sm:p-6">
              <p className="trust-kicker text-xs font-bold uppercase">Founding member</p>
              <p className="mt-3 text-3xl font-bold text-paper">{BETA_PRICE_LABEL}</p>
              <p className="mt-2 text-sm leading-6 text-paper/60">
                Beta means beta: rough edges, fast fixes, and your feedback steering the roadmap. If it doesn&rsquo;t
                help your search, say so and get your money back — no forms.
              </p>
              <a
                href={cta.href}
                target={cta.mode === "email" ? undefined : "_blank"}
                rel="noreferrer"
                onClick={() => trackBetaCtaClick(cta.mode)}
                className="lab-pill-button mt-5 inline-block px-6 py-3 text-sm font-black transition"
              >
                {cta.label}
              </a>
              <p className="mt-3 text-xs leading-5 text-paper/50">{cta.hint}</p>
            </div>

            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-base font-bold text-paper">Try it before anything</h2>
              <p className="mt-2 text-sm leading-6 text-paper/65">
                Load a sample campaign — a fictional job seeker mid-search — and click around the real product:
                dashboard, applications, briefs, follow-ups.
              </p>
              {canLoadDemo && (
                <button
                  type="button"
                  onClick={loadDemo}
                  className="mt-4 rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold"
                >
                  Load the sample campaign
                </button>
              )}
              {demoActive && (
                <Link href="/" className="mt-4 inline-block rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink transition hover:bg-gold">
                  Sample campaign loaded — open Today →
                </Link>
              )}
              {hydrated && !canLoadDemo && !demoActive && (
                <p className="mt-4 text-xs leading-5 text-paper/50">
                  You already have real data in Career Forge, so the sample loader is disabled — it would overwrite
                  your campaign.
                </p>
              )}
            </div>

            <FeedbackWidget area="beta_page" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
