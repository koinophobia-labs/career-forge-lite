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
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Private by default", "No account required. Your files stay on this device."],
              ["Grounded in your work", "Imported facts wait for your approval before Career Forge uses them."],
              ["Built to leave the app", "Create résumé, interview, and job-search material you can actually use."]
            ].map(([title, detail]) => (
              <div key={title} className="career-paper-card p-4">
                <p className="text-sm font-bold text-paper">{title}</p>
                <p className="mt-1 text-xs leading-5 text-paper/48">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <details className="career-paper-card p-5">
              <summary className="cursor-pointer text-sm font-bold text-cyan">See a finished sample first</summary>
              <div className="mt-5" tabIndex={0} role="region" aria-label="Finished Career Forge sample">
                <SampleExperience />
              </div>
            </details>

            <details className="career-paper-card p-5">
              <summary className="cursor-pointer text-sm font-bold text-paper/72">How Career Forge stays honest</summary>
              <div className="mt-4 grid gap-4 text-sm leading-6 text-paper/62">
                <p><strong className="text-paper">Local-first career evidence compiler.</strong> Works locally without an account. It is a reviewable evidence system. Imported facts stay proposals until you approve them.</p>
                <p><strong className="text-paper">Not another AI résumé writer.</strong> Career Forge shows what it keeps out of professional drafts, including unsupported context and missing proof. It builds a distinct résumé for each active lane. Links generated claims to their reviewed sources.</p>
              </div>
            </details>
          </div>
        </section>
      )}

      {hydrated && !isFirstRun && hasDueWork && (
        <section className="mx-auto max-w-6xl px-5 pb-8 pt-6 sm:px-8">
          <div className="career-paper-card p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="trust-kicker text-xs font-bold uppercase">Needs attention</p>
                <h2 className="mt-2 text-xl font-bold text-paper">Follow-ups due today</h2>
              </div>
              <span className="career-proof-chip">{applicationFollowUps.length + outreachFollowUps.length} waiting</span>
            </div>
            <div className="mt-5 grid gap-2">
              {applicationFollowUps.map((app) => (
                <Link
                  key={app.id}
                  href="/applications"
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:border-gold/50 hover:bg-gold/5"
                >
                  <span className="font-bold text-paper">{app.roleTitle} · {app.company}</span>
                  <span className="text-xs font-bold text-gold">Follow up →</span>
                </Link>
              ))}
              {outreachFollowUps.map((contact) => (
                <Link
                  key={contact.id}
                  href="/outreach"
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:border-cyan/50 hover:bg-cyan/5"
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
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
          <details aria-label="Advanced workspace" className="career-paper-card p-5">
            <summary className="cursor-pointer text-sm font-bold text-paper/60">Open full workspace</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Work History", "/profile", `${state.dossier.evidence.length} evidence items`],
                ["Target Roles", "/targets", `${state.lanes.length} saved roles`],
                ["Applications", "/applications", `${state.applications.length} tracked`],
                ["Role Sprints", "/role-sprint", `${state.roleSprints.length} sprints`]
              ].map(([label, href, detail]) => (
                <Link key={href} href={href} className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan/40 hover:bg-cyan/5">
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
