"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getLastBackupAt, shouldNudgeBackup } from "@/lib/backup";
import { isMomentumLow } from "@/lib/weekly-review";
import {
  applicationFollowUpsDue,
  applicationsMissingTailoredResume,
  computeDashboardStats,
  getNextBestAction,
  outreachFollowUpsDue,
  WEEKLY_APPLICATION_TARGET
} from "@/lib/command-center-insights";
import { isProfileStarted } from "@/lib/command-center-store";
import { useCommandCenter } from "@/lib/use-command-center";

const loop = [
  ["01", "Dossier", "Capture and approve career evidence once", "/profile"],
  ["02", "Career Lanes", "Choose up to three credible directions", "/targets"],
  ["03", "Résumé Pack", "Forge two distinct baselines per lane", "/versions"],
  ["04", "Tailor", "Start from a lane baseline for each posting", "/tailor"],
  ["05", "Track", "Link applications, outreach, and follow-ups", "/applications"],
  ["06", "Interview", "Prepare from real evidence and gaps", "/interview"],
  ["07", "Weekly", "Review momentum and the next best moves", "/weekly"]
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

  const isFirstRun = hydrated && !isProfileStarted(state.profile) && !state.lanes.length && !state.applications.length;
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

      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8" id="landing">
        <div className="trust-panel overflow-hidden">
          <div className="border-b border-white/10 p-5 sm:p-7">
            <p className="trust-kicker text-sm font-bold uppercase">Career transition command center</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <h1 className="text-3xl font-bold text-paper sm:text-4xl">
                  Build your career profile once. Get a complete résumé pack for your strongest lanes.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
                  Approve reusable career evidence, forge ATS and networking résumés for up to three lanes in one operation,
                  then tailor individual applications from that foundation. No login. Everything stays on this device.
                </p>
                <p className="mt-3 max-w-2xl text-sm font-semibold text-paper/78">
                  A <span className="text-coral">Koinophobia Labs</span> system for turning job-search chaos into repeatable action.
                </p>
              </div>
              <div className="rounded-xl border border-gold/25 bg-gold/10 p-4">
                <p className="trust-kicker text-xs font-bold uppercase">Next best action</p>
                <h2 className="mt-2 text-lg font-bold text-paper">{hydrated ? nextAction.title : "Loading your search…"}</h2>
                <p className="mt-2 text-sm leading-6 text-paper/68">{hydrated ? nextAction.detail : ""}</p>
                {hydrated && (
                  <Link
                    href={nextAction.href}
                    className="lab-pill-button mt-4 inline-block px-4 py-2 text-sm font-black transition"
                  >
                    {nextAction.actionLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:p-7 md:grid-cols-3 lg:grid-cols-7">
            {loop.map(([num, label, detail, href]) => (
              <Link
                key={num}
                href={href}
                className="group rounded-xl border border-white/12 bg-obsidian/40 p-4 transition hover:-translate-y-0.5 hover:border-cyan/50"
              >
                <span className="lab-mono block text-xs font-bold text-gold">{num}</span>
                <span className="mt-2 block text-sm font-bold text-paper group-hover:text-cyan">{label}</span>
                <span className="mt-1 block text-[0.72rem] leading-5 text-paper/55">{detail}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {isFirstRun && (
        <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
          <div className="rounded-xl border border-cyan/25 bg-cyan/10 p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">First run</p>
            <h2 className="mt-2 text-xl font-bold text-paper">Here’s how this works.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-paper/72">
              Start with your <strong className="text-cyan">Career Dossier</strong>: structured roles, projects, skills,
              proof, and metrics you explicitly approve. Choose up to three lanes, forge the complete pack, then tailor a
              canonical lane baseline to each real posting without re-entering your history.
            </p>
            <Link href="/profile" className="lab-pill-button mt-4 inline-block px-5 py-2.5 text-sm font-black transition">
              Build your Career Dossier
            </Link>
          </div>
        </section>
      )}

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
