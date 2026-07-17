"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActivationPath } from "@/components/ActivationPath";
import { CommandNav } from "@/components/CommandNav";
import { IntentRouter } from "@/components/IntentRouter";
import { SampleExperience } from "@/components/SampleExperience";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { getLastBackupAt, shouldNudgeBackup } from "@/lib/backup";
import { getCommerceMode } from "@/lib/entitlement";
import { isMomentumLow } from "@/lib/weekly-review";
import {
  applicationFollowUpsDue,
  applicationsMissingTailoredResume,
  computeDashboardStats,
  getNextBestAction,
  outreachFollowUpsDue,
  WEEKLY_APPLICATION_TARGET
} from "@/lib/command-center-insights";
import { isIntentFirstRun } from "@/lib/intent-router";
import { useCommandCenter } from "@/lib/use-command-center";

const loop = [
  ["01", "Dossier", "Capture and approve career evidence once", "/profile"],
  ["02", "Truth Map", "Trace facts into every claim and answer", "/truth-map"],
  ["03", "Career Lanes", "Choose up to three credible directions", "/targets"],
  ["04", "Résumé Pack", "Forge two distinct baselines per lane", "/versions"],
  ["05", "Tailor", "Start from a lane baseline for each posting", "/tailor"],
  ["06", "Track", "Link applications, outreach, and follow-ups", "/applications"],
  ["07", "Interview", "Prepare from real evidence and gaps", "/interview"]
] as const;

export default function Dashboard() {
  const { state, hydrated } = useCommandCenter();
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const stats = useMemo(() => computeDashboardStats(state, nowIso), [state, nowIso]);
  const nextAction = useMemo(() => getNextBestAction(state, nowIso), [state, nowIso]);
  const followUps = useMemo(
    () => ({
      applications: applicationFollowUpsDue(state, nowIso),
      outreach: outreachFollowUpsDue(state, nowIso)
    }),
    [state, nowIso]
  );

  const isFirstRun = hydrated && isIntentFirstRun(state);
  const untailoredApplications = useMemo(() => applicationsMissingTailoredResume(state), [state]);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [backupChecked, setBackupChecked] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage, unavailable during prerender
    setLastBackupAt(getLastBackupAt());
    setBackupChecked(true);
  }, []);
  const showBackupNudge = hydrated && backupChecked && shouldNudgeBackup(state, lastBackupAt, nowIso);
  const showMomentumNudge = hydrated && isMomentumLow(state, nowIso);
  const currentPack = [...state.resumePacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  const statCards: Array<[string, number | string, string, string]> = [
    ["Target lanes", stats.activeLanes, "active role lanes", "/targets"],
    ["Applications sent", stats.applicationsSent, `${stats.applicationsThisWeek} of ${WEEKLY_APPLICATION_TARGET} this week`, "/applications"],
    ["Follow-ups due", stats.followUpsDue, "waiting on you today", "/applications"],
    ["Interviews", stats.interviews, "in play right now", "/interview"],
    ["Résumé pack", currentPack ? currentPack.variants.length : 0, currentPack ? `${currentPack.status.replace("-", " ")} documents` : "not forged yet", "/versions"],
    ["Outreach in flight", stats.outreachInFlight, "conversations open", "/outreach"]
  ];

  return (
    <main>
      <CommandNav active="/" />
      <IntentRouter />

      {(!hydrated || isFirstRun) && <>
      <section className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10" id="landing">
        <div className="trust-panel overflow-hidden">
          <div className="p-5 sm:p-7">
            <p className="trust-kicker text-xs font-bold uppercase sm:text-sm">Local-first career evidence compiler</p>
            <div className="mt-3 grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <div>
                <h2 className="text-3xl font-bold leading-tight text-paper sm:text-5xl">
                  Your career is bigger than your last résumé.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/72 sm:text-base">
                  Career Forge turns scattered jobs, projects, and old résumés into an approved evidence system, then
                  compiles truthful application packs for every credible direction.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/profile#import" onClick={() => trackCareerEvent("landing_primary_cta_clicked")} className="lab-pill-button inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-black transition">
                    Import my résumés
                  </Link>
                  <a href="#pack-preview" className="inline-flex min-h-11 items-center rounded-md border border-cyan/40 bg-cyan/10 px-5 py-2.5 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold">
                    See what the pack includes
                  </a>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-paper/62">No account · Files processed locally · Raw files never stored · Nothing trusted until you approve it</p>
              </div>
              <div id="pack-preview" className="rounded-xl border border-gold/30 bg-gold/10 p-4 sm:p-5">
                <p className="trust-kicker text-xs font-bold uppercase">What you get</p>
                <h2 className="mt-2 text-lg font-bold text-paper">A reusable dossier, not one generic document</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-xs leading-5 text-paper/72">
                  {["Career Dossier", "Up to 3 role lanes", "ATS résumé per lane", "Recruiter résumé per lane", "LinkedIn positioning", "Evidence receipt", "Job-specific tailoring", "PDF + DOCX bundle"].map((item) => <li key={item} className="rounded-md border border-white/10 bg-obsidian/25 px-2.5 py-2">✓ {item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      </>}

      {hydrated && !isFirstRun && (
        <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
          <ActivationPath state={state} compact={isFirstRun} />
        </section>
      )}

      {(!hydrated || isFirstRun) && <><section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8" aria-labelledby="how-title">
        <div className="trust-panel p-5 sm:p-6">
          <p className="trust-kicker text-xs font-bold uppercase">How it works</p>
          <h2 id="how-title" className="mt-2 text-2xl font-bold text-paper">From scattered history to application-ready baselines</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[["1", "Bring your history — files or your own words", "Import old résumés (PDF, DOCX, text — parsed in this browser) or simply describe your work. Multiple versions help surface repeated facts and conflicts."], ["2", "Approve facts and choose lanes", "You decide what is true. A lane is a family of related roles that can share one positioning strategy and baseline résumé."], ["3", "Receive your résumé pack", "Every lane you activate gets an ATS version and a recruiter version, plus LinkedIn materials, a bundle, and a direct bridge to job-specific tailoring."]].map(([number, title, detail]) => <article key={number} className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><span className="lab-mono text-xs font-bold text-gold">{number}</span><h3 className="mt-2 font-bold text-paper">{title}</h3><p className="mt-1 text-sm leading-6 text-paper/58">{detail}</p></article>)}
          </div>
          <p className="mt-5 text-sm leading-6 text-paper/65"><strong className="text-cyan">Why multiple résumés?</strong> One generic résumé forces unrelated roles to compete for space. Career Forge creates a truthful baseline for each credible direction, then tailors from the right foundation.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8"><SampleExperience /></section>

      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8" aria-labelledby="pricing-strip-title">
        <div className="rounded-xl border border-gold/25 bg-gold/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="trust-kicker text-xs font-bold uppercase">Simple to buy</p>
              <h2 id="pricing-strip-title" className="mt-2 text-xl font-bold text-paper">
                Build and review everything free. Pay once when you&apos;re ready to use it.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/65">
                One-time packs from $49 — no subscription, no account, and your career data never leaves this device.
                {getCommerceMode() === "off" ? " Everything is free while Career Forge is in beta." : ""}
              </p>
            </div>
            <Link href="/pricing" className="lab-pill-button inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-black">
              See the packs →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8" aria-labelledby="trust-title">
        <div className="rounded-xl border border-white/12 bg-white/5 p-5 sm:p-6"><h2 id="trust-title" className="text-xl font-bold text-paper">What Career Forge trusts—and what it refuses to invent</h2><div className="mt-4 grid gap-3 text-sm leading-6 text-paper/65 md:grid-cols-3"><p><strong className="text-mint">Local by default.</strong> No account is required. Files are processed in your browser, and raw résumé files are not retained.</p><p><strong className="text-mint">Approval-gated.</strong> Imported facts remain proposals until you approve them; source excerpts stay attached for review.</p><p><strong className="text-mint">Honest outputs.</strong> Missing credentials, duration, and experience stay gaps. Review every exported application document before sending.</p></div></div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8" aria-labelledby="different-title" id="different">
        <div className="trust-panel p-5 sm:p-6"><p className="trust-kicker text-xs font-bold uppercase">The category difference</p><h2 id="different-title" className="mt-2 text-3xl font-bold text-paper">Not another AI résumé writer.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-paper/65">Writing is the output. Career Forge’s job is to compile approved proof, keep transfer claims honest, and show why every claim appeared.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[38rem] border-collapse text-left text-sm"><thead><tr className="border-b border-white/15 text-paper/45"><th className="px-3 py-3">Typical tool</th><th className="px-3 py-3 text-cyan">Career Forge</th></tr></thead><tbody>{[["Starts from one résumé", "Builds a longitudinal Career Dossier"], ["Generates plausible copy", "Uses evidence you explicitly approved"], ["Gives a match score", "Shows direct, transferred, and missing proof"], ["Makes one tailored document", "Builds an ATS and recruiter baseline for every credible lane"], ["Stores files in an account", "Works locally without an account"], ["Hides why a claim appeared", "Links each generated claim to its source"]].map(([typical, forge]) => <tr key={typical} className="border-b border-white/10"><td className="px-3 py-3 text-paper/55">{typical}</td><td className="px-3 py-3 font-bold text-paper">{forge}</td></tr>)}</tbody></table></div><div className="mt-5 flex flex-wrap gap-3"><Link href="/profile#import" onClick={() => trackCareerEvent("differentiation_section_cta_clicked")} className="lab-pill-button inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-black">Build my approved dossier →</Link><Link href="/truth-map" onClick={() => trackCareerEvent("truth_map_opened")} className="inline-flex min-h-11 items-center rounded border border-cyan/40 px-5 py-2.5 text-sm font-bold text-cyan">See the Truth Map</Link></div></div>
      </section>
      </>}

      {hydrated && !isFirstRun && <><section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8" aria-labelledby="advanced-title">
        <div className="flex items-end justify-between gap-3"><div><p className="trust-kicker text-xs font-bold uppercase">Advanced workspace</p><h2 id="advanced-title" className="mt-2 text-xl font-bold text-paper">Your complete job-search system</h2></div>{hydrated && !isFirstRun && <Link href={nextAction.href} className="text-sm font-bold text-cyan">{nextAction.actionLabel} →</Link>}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-7">
          {loop.map(([num, label, detail, href]) => <Link key={num} href={href} className="group rounded-xl border border-white/12 bg-obsidian/40 p-4 transition hover:-translate-y-0.5 hover:border-cyan/50"><span className="lab-mono block text-xs font-bold text-gold">{num}</span><span className="mt-2 block text-sm font-bold text-paper group-hover:text-cyan">{label}</span><span className="mt-1 block text-[0.72rem] leading-5 text-paper/55">{detail}</span></Link>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map(([label, value, detail, href]) => (
            <Link key={label} href={href} className="trust-card p-4 transition hover:border-cyan/40">
              <span className="lab-mono block text-[0.68rem] font-bold uppercase text-paper/55">{label}</span>
              <span className="mt-2 block text-3xl font-bold text-paper">{hydrated ? value : "–"}</span>
              <span className="mt-1 block text-[0.72rem] text-paper/50">{detail}</span>
            </Link>
          ))}
        </div>
      </section>
      </>}

      {hydrated && (followUps.applications.length > 0 || followUps.outreach.length > 0) && (
        <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <div className="trust-panel p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">Due now</p>
            <h2 className="mt-2 text-xl font-bold text-paper">Follow-ups waiting on you</h2>
            <ul className="mt-4 grid gap-2">
              {followUps.applications.map((app) => (
                <li key={app.id}>
                  <Link
                    href="/applications"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/12 bg-obsidian/40 px-4 py-3 text-sm transition hover:border-gold/50"
                  >
                    <span className="font-bold text-paper">
                      {app.roleTitle} · {app.company}
                    </span>
                    <span className="lab-mono text-xs text-gold">Application follow-up due</span>
                  </Link>
                </li>
              ))}
              {followUps.outreach.map((contact) => (
                <li key={contact.id}>
                  <Link
                    href="/outreach"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/12 bg-obsidian/40 px-4 py-3 text-sm transition hover:border-cyan/50"
                  >
                    <span className="font-bold text-paper">
                      {contact.name || "Contact"}
                      {contact.company ? ` · ${contact.company}` : ""}
                    </span>
                    <span className="lab-mono text-xs text-cyan">Outreach follow-up {contact.followUpCount + 1} of 2</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {showMomentumNudge && (
        <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <Link
            href="/weekly"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coral/30 bg-coral/10 px-5 py-4 transition hover:border-coral"
          >
            <span>
              <span className="block text-sm font-bold text-paper">Quiet week — almost no activity in the last 7 days.</span>
              <span className="mt-0.5 block text-[0.78rem] leading-5 text-paper/60">
                Searches die from stalls, not rejections. The weekly review has three small moves to restart the rhythm.
              </span>
            </span>
            <span className="lab-mono text-xs font-bold text-coral">Open weekly review →</span>
          </Link>
        </section>
      )}

      {showBackupNudge && (
        <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <Link
            href="/settings"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/10 px-5 py-4 transition hover:border-gold"
          >
            <span>
              <span className="block text-sm font-bold text-paper">Your career data has no recent backup.</span>
              <span className="mt-0.5 block text-[0.78rem] leading-5 text-paper/60">
                Everything lives on this device — one cleared browser erases it. Download a backup file; it takes ten
                seconds.
              </span>
            </span>
            <span className="lab-mono text-xs font-bold text-gold">Create backup →</span>
          </Link>
        </section>
      )}

      {hydrated && untailoredApplications.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <div className="trust-panel p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">Resume coverage</p>
            <h2 className="mt-2 text-xl font-bold text-paper">
              {untailoredApplications.length} active application{untailoredApplications.length === 1 ? "" : "s"} without a
              tailored resume
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-paper/60">
              A resume built for the specific posting beats a generic one. Run each through the tailoring engine and
              generate its version.
            </p>
            <ul className="mt-4 grid gap-2">
              {untailoredApplications.slice(0, 4).map((app) => (
                <li key={app.id}>
                  <Link
                    href="/tailor"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/12 bg-obsidian/40 px-4 py-3 text-sm transition hover:border-cyan/50"
                  >
                    <span className="font-bold text-paper">
                      {app.roleTitle} · {app.company}
                    </span>
                    <span className="lab-mono text-xs text-cyan">Tailor a resume for this →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {hydrated && state.lanes.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
          <div className="trust-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="trust-kicker text-xs font-bold uppercase">Positioning</p>
                <h2 className="mt-2 text-xl font-bold text-paper">Your target lanes</h2>
              </div>
              <Link href="/targets" className="text-sm font-bold text-cyan transition hover:text-gold">
                Manage lanes →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {state.lanes.slice(0, 6).map((lane) => (
                <Link
                  key={lane.id}
                  href="/targets"
                  className="rounded-xl border border-white/12 bg-obsidian/40 p-4 transition hover:border-gold/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-paper">{lane.title}</span>
                    <span
                      className={`lab-mono rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase ${
                        lane.status === "active"
                          ? "border-gold/40 text-gold"
                          : lane.status === "exploring"
                            ? "border-cyan/40 text-cyan"
                            : "border-white/20 text-paper/50"
                      }`}
                    >
                      {lane.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-[0.78rem] leading-5 text-paper/60">{lane.whyFit}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
