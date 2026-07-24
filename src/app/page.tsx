"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CommandNav } from "@/components/CommandNav";
import { IntentRouter } from "@/components/IntentRouter";
import { SampleExperience } from "@/components/SampleExperience";
import { SiteFooter } from "@/components/SiteFooter";
import {
  applicationFollowUpsDue,
  outreachFollowUpsDue
} from "@/lib/command-center-insights";
import { isIntentFirstRun } from "@/lib/intent-router";
import { useCommandCenter } from "@/lib/use-command-center";

export default function Dashboard() {
  const { state, hydrated } = useCommandCenter();
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const isFirstRun = hydrated && isIntentFirstRun(state);
  const applicationFollowUps = useMemo(() => applicationFollowUpsDue(state, nowIso), [state, nowIso]);
  const outreachFollowUps = useMemo(() => outreachFollowUpsDue(state, nowIso), [state, nowIso]);
  const hasDueWork = applicationFollowUps.length > 0 || outreachFollowUps.length > 0;

  return (
    <main id="main">
      <CommandNav active="/" />
      <IntentRouter />

      {hydrated && isFirstRun && (
        <section className="mx-auto max-w-4xl px-5 pb-10 sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs leading-5 text-paper/48">
            <span>No account required</span>
            <span aria-hidden="true">•</span>
            <span>Files stay on this device</span>
            <span aria-hidden="true">•</span>
            <span>You approve every career claim</span>
          </div>
          <details className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer text-center text-sm font-bold text-cyan">See a finished sample first</summary>
            <div className="mt-5" tabIndex={0} role="region" aria-label="Finished Career Forge sample">
              <SampleExperience />
            </div>
          </details>
        </section>
      )}

      {hydrated && !isFirstRun && hasDueWork && (
        <section className="mx-auto max-w-6xl px-5 pb-8 pt-6 sm:px-8">
          <div className="trust-panel p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">Needs attention</p>
            <h2 className="mt-2 text-xl font-bold text-paper">Follow-ups due today</h2>
            <div className="mt-4 grid gap-2">
              {applicationFollowUps.map((app) => (
                <Link
                  key={app.id}
                  href="/applications"
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/12 bg-obsidian/40 px-4 py-3 text-sm transition hover:border-gold/50"
                >
                  <span className="font-bold text-paper">{app.roleTitle} · {app.company}</span>
                  <span className="text-xs font-bold text-gold">Follow up →</span>
                </Link>
              ))}
              {outreachFollowUps.map((contact) => (
                <Link
                  key={contact.id}
                  href="/outreach"
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/12 bg-obsidian/40 px-4 py-3 text-sm transition hover:border-cyan/50"
                >
                  <span className="font-bold text-paper">{contact.name || "Contact"}{contact.company ? ` · ${contact.company}` : ""}</span>
                  <span className="text-xs font-bold text-cyan">Follow up →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {hydrated && !isFirstRun && (
        <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
          <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer text-sm font-bold text-paper/60">Open full workspace</summary>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Work History", "/profile", `${state.dossier.evidence.length} evidence items`],
                ["Target Roles", "/targets", `${state.lanes.length} saved roles`],
                ["Applications", "/applications", `${state.applications.length} tracked`],
                ["Role Sprints", "/role-sprint", `${state.roleSprints.length} sprints`]
              ].map(([label, href, detail]) => (
                <Link key={href} href={href} className="rounded-lg border border-white/10 bg-obsidian/35 p-3 transition hover:border-cyan/40">
                  <span className="block text-sm font-bold text-paper">{label}</span>
                  <span className="mt-1 block text-xs text-paper/45">{detail}</span>
                </Link>
              ))}
            </div>
          </details>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
