"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { CopyButton } from "@/components/CopyButton";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { withUpdatedDossier } from "@/lib/dossier";
import {
  ROLE_SPRINT_MIN_WORK_CHARS,
  completeRoleSprint,
  sprintProvenanceNoun,
  sprintSupportingEvidence,
  sprintUnprovenStatement,
  syncRoleSprintsWithEvidence
} from "@/lib/role-sprint";
import { primarySprintOutput } from "@/lib/role-sprint-ux";
import { useCommandCenter } from "@/lib/use-command-center";
import type { RoleSprintOutputs, RoleSprintRecord } from "@/types/command-center";

const statusChip: Record<RoleSprintRecord["status"], { label: string; className: string }> = {
  draft: { label: "In progress", className: "border-gold/50 bg-gold/10 text-gold" },
  completed: { label: "Ready for review", className: "border-cyan/50 bg-cyan/10 text-cyan" },
  "approved-as-evidence": { label: "Approved practice", className: "border-spruce/60 bg-mint/10 text-mint" }
};

const sprintTypeLabel: Record<RoleSprintRecord["sprintType"], string> = {
  explain: "Explain",
  evaluate: "Evaluate",
  plan: "Plan",
  simulate: "Simulate",
  build: "Build"
};

const allOutputFields: Array<{ key: keyof Omit<RoleSprintOutputs, "userEdited">; label: string; hint: string; rows: number }> = [
  { key: "portfolioTitle", label: "Portfolio title", hint: "A heading for this practice artifact.", rows: 2 },
  { key: "portfolioSummary", label: "Portfolio summary", hint: "A short explanation of what you practiced and produced.", rows: 5 },
  { key: "resumeBullet", label: "Résumé / project bullet", hint: "Use under projects or independent practice, never employment.", rows: 4 },
  { key: "starStory", label: "Interview story outline", hint: "Use this to explain how you addressed the gap.", rows: 6 },
  { key: "talkingPoint", label: "Application talking point", hint: "For a cover letter or application question.", rows: 3 }
];

function RoleSprintWorkspace() {
  const searchParams = useSearchParams();
  const sprintId = searchParams.get("id") ?? "";
  const { state, update, hydrated } = useCommandCenter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sprint = state.roleSprints.find((item) => item.id === sprintId) ?? null;
  const application = sprint?.applicationId ? state.applications.find((item) => item.id === sprint.applicationId) ?? null : null;
  const evidence = sprint?.evidenceId ? state.dossier.evidence.find((item) => item.id === sprint.evidenceId) ?? null : null;
  const supporting = sprint ? sprintSupportingEvidence(sprint, state.dossier) : [];

  const evidenceState = !sprint || !sprint.evidenceId
    ? "none"
    : !evidence
      ? "missing"
      : evidence.approved && !evidence.rejected
        ? "approved"
        : evidence.rejected
          ? "rejected"
          : "pending";

  function patchSprint(id: string, patch: Partial<RoleSprintRecord>) {
    update((current) => ({
      ...current,
      roleSprints: current.roleSprints.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)
    }));
  }

  function patchOutputs(record: RoleSprintRecord, key: keyof Omit<RoleSprintOutputs, "userEdited">, value: string) {
    if (!record.outputs) return;
    patchSprint(record.id, { outputs: { ...record.outputs, [key]: value, userEdited: true } });
  }

  function submitWork(record: RoleSprintRecord) {
    setSubmitError(null);
    if (record.status !== "draft" && record.outputs?.userEdited) {
      const replace = window.confirm("Regenerate drafts from your updated work? This replaces the output edits you already made.");
      if (!replace) return;
    }
    let error: string | null = null;
    update((current) => {
      const result = completeRoleSprint(current, record.id, record.userWork, new Date().toISOString());
      if (!result.ok) {
        error = result.error;
        return current;
      }
      return result.state;
    });
    if (error) {
      setSubmitError(error);
      return;
    }
    trackCareerEvent("role_sprint_completed");
  }

  function reviewPractice(approved: boolean) {
    if (!sprint?.evidenceId) return;
    const nowIso = new Date().toISOString();
    update((current) => {
      const evidenceList = current.dossier.evidence.map((item) => item.id === sprint.evidenceId
        ? { ...item, approved, rejected: !approved, updatedAt: nowIso }
        : item);
      const dossier = {
        ...current.dossier,
        evidence: evidenceList,
        approvedClaims: [...new Set(evidenceList.filter((item) => item.approved && !item.rejected).map((item) => item.detail))],
        updatedAt: nowIso
      };
      const withDossier = withUpdatedDossier(current, dossier);
      return {
        ...withDossier,
        roleSprints: syncRoleSprintsWithEvidence(withDossier.roleSprints, withDossier.dossier.evidence, nowIso)
      };
    });
  }

  if (!hydrated) return <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8" aria-busy="true" />;

  if (!sprint) {
    const sprints = [...state.roleSprints].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return (
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Role Sprints</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Practice one gap at a time.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">Each sprint creates labeled practice, not fake work experience.</p>
        {sprints.length ? (
          <div className="mt-6 grid gap-2.5">
            {sprints.map((item) => (
              <Link key={item.id} href={`/role-sprint?id=${item.id}`} className="rounded-lg border border-white/12 bg-obsidian/40 p-4 transition hover:border-cyan/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="max-w-2xl text-sm font-bold leading-5 text-paper">{item.title || item.requirement}</p>
                  <span className={`lab-mono shrink-0 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase ${statusChip[item.status].className}`}>{statusChip[item.status].label}</span>
                </div>
                <p className="mt-1.5 text-xs text-paper/55">{[item.roleTitle, item.company].filter(Boolean).join(" at ") || "No job saved"}</p>
              </Link>
            ))}
          </div>
        ) : <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">No sprints yet. Start by analyzing one job posting.</div>}
        <Link href="/tailor" className="lab-pill-button mt-6 inline-flex px-5 py-2.5 text-sm font-black">Analyze a job →</Link>
      </section>
    );
  }

  const noun = sprintProvenanceNoun(sprint.sprintType);
  const target = [sprint.roleTitle, sprint.company].filter(Boolean).join(" at ");
  const workLength = sprint.userWork.trim().length;
  const isCompleted = sprint.status !== "draft";
  const primaryOutput = sprint.outputs ? primarySprintOutput(sprint.sprintType) : null;
  const secondaryOutputFields = primaryOutput ? allOutputFields.filter((field) => field.key !== primaryOutput.key) : allOutputFields;

  return (
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <p className="trust-kicker text-sm font-bold uppercase">Role Sprint</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="max-w-2xl text-3xl font-bold text-paper">Close this gap</h1>
          <p className="mt-2 max-w-2xl text-base font-bold leading-7 text-paper">{sprint.requirement}</p>
          <p className="mt-1 text-sm text-paper/55">{target || "Target job"} · 20–60 minutes</p>
        </div>
        <span className={`lab-mono shrink-0 rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase ${statusChip[sprint.status].className}`}>{statusChip[sprint.status].label}</span>
      </div>

      {!isCompleted && (
        <>
          <div className="trust-panel mt-6 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-paper">Do this</h2>
            <ol className="mt-4 grid gap-2 text-sm leading-6 text-paper/75">
              {sprint.instructions.map((step, index) => <li key={step} className="rounded-lg border border-white/10 bg-obsidian/40 p-3"><span className="lab-mono mr-2 text-xs font-bold text-cyan">{index + 1}.</span>{step}</li>)}
            </ol>
            <p className="mt-5 text-xs font-black uppercase tracking-wide text-paper/50">Done means</p>
            <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-paper/70">{sprint.completionCriteria.map((criterion) => <li key={criterion}>✓ {criterion}</li>)}</ul>
          </div>

          <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer text-sm font-bold text-cyan">Why this task?</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-black uppercase text-mint">What you already have</p>{supporting.length ? <ul className="mt-2 grid gap-1 text-sm leading-6 text-paper/65">{supporting.map((item) => <li key={item.id}>• {item.detail}</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-paper/60">No approved evidence currently supports this requirement.</p>}</div>
              <div><p className="text-xs font-black uppercase text-coral">What stays unproven</p><p className="mt-2 text-sm leading-6 text-paper/65">{sprintUnprovenStatement(sprint)}</p></div>
            </div>
          </details>
        </>
      )}

      <div id="sprint-work-area" className="trust-panel mt-6 scroll-mt-24 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-paper">{isCompleted ? "Your work" : "Do the work here"}</h2>
        <p className="mt-1 text-sm text-paper/55">Saved automatically. This exact work becomes the source for your practice evidence.</p>
        <textarea aria-label="Sprint work area" value={sprint.userWork} rows={12} placeholder="Write or paste your completed task here…" onChange={(event) => patchSprint(sprint.id, { userWork: event.target.value })} disabled={evidenceState === "approved"} className="trust-input mt-3 w-full border px-3 py-2.5 text-sm text-ink disabled:opacity-60" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className={`text-xs ${workLength >= ROLE_SPRINT_MIN_WORK_CHARS ? "text-mint" : "text-paper/50"}`}>{workLength} / {ROLE_SPRINT_MIN_WORK_CHARS} minimum characters</p>
          {evidenceState !== "approved" && <button type="button" onClick={() => submitWork(sprint)} disabled={workLength < ROLE_SPRINT_MIN_WORK_CHARS} className="lab-pill-button ml-auto px-5 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40">{isCompleted ? "Update my proof" : "Finish sprint →"}</button>}
        </div>
        {sprint.outputs?.userEdited && evidenceState !== "approved" && <p className="mt-2 text-xs text-gold">You edited the generated drafts. Updating the proof will ask before replacing those edits.</p>}
        {submitError && <p className="mt-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm leading-6 text-paper/80">{submitError}</p>}
      </div>

      {isCompleted && sprint.outputs && (
        <>
          <div className={`mt-6 rounded-xl border p-4 text-sm leading-6 ${evidenceState === "approved" ? "border-mint/35 bg-mint/10 text-paper/78" : evidenceState === "rejected" || evidenceState === "missing" ? "border-coral/35 bg-coral/10 text-paper/78" : "border-gold/35 bg-gold/10 text-paper/78"}`}>
            {evidenceState === "approved" ? <><span className="font-bold text-mint">Approved.</span> This is labeled practice evidence, not employment experience.</> : evidenceState === "rejected" ? <><span className="font-bold text-coral">Rejected.</span> Update the work and submit a new version when ready.</> : evidenceState === "missing" ? <><span className="font-bold text-coral">Evidence missing.</span> Submit again to recreate it.</> : <><span className="font-bold text-gold">Sprint complete.</span> Decide whether this finished work should become labeled practice evidence.</>}
          </div>

          {evidenceState === "pending" && (
            <div className="trust-panel mt-6 p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-wide text-gold">Review your practice proof</p>
              <h2 className="mt-2 text-xl font-bold text-paper">Use this as labeled practice?</h2>
              <p className="mt-2 text-sm leading-6 text-paper/60">Approval lets Career Forge cite the work as practice. It still cannot count as employment experience or satisfy years of experience.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => reviewPractice(true)} className="lab-pill-button px-5 py-2.5 text-sm font-black">Approve as practice →</button>
                <a href="#sprint-work-area" className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-bold text-paper/70">Keep editing</a>
                <button type="button" onClick={() => reviewPractice(false)} className="rounded-md border border-coral/45 px-4 py-2.5 text-sm font-bold text-coral">Reject this proof</button>
              </div>
            </div>
          )}

          {primaryOutput && (
            <div className="trust-panel mt-6 p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-wide text-cyan">Best way to use this</p>
              <label className="mt-3 block">
                <span className="flex flex-wrap items-center gap-2"><span className="text-lg font-bold text-paper">{primaryOutput.label}</span><CopyButton getText={() => sprint.outputs?.[primaryOutput.key] ?? ""} /></span>
                <span className="mt-1 block text-xs text-paper/50">{primaryOutput.hint}</span>
                <textarea aria-label={primaryOutput.label} value={sprint.outputs[primaryOutput.key]} rows={primaryOutput.rows} onChange={(event) => patchOutputs(sprint, primaryOutput.key, event.target.value)} className="trust-input mt-3 w-full border px-3 py-2.5 text-sm text-ink" />
              </label>
            </div>
          )}

          <details className="trust-panel mt-6 p-5 sm:p-6">
            <summary className="cursor-pointer text-base font-bold text-cyan">Other ways to use this work</summary>
            <div className="mt-5 grid gap-4">
              {secondaryOutputFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-paper">{field.label}</span><CopyButton getText={() => sprint.outputs?.[field.key] ?? ""} /></span>
                  <span className="mt-0.5 block text-xs text-paper/50">{field.hint}</span>
                  <textarea aria-label={field.label} value={sprint.outputs?.[field.key] ?? ""} rows={field.rows} onChange={(event) => patchOutputs(sprint, field.key, event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" />
                </label>
              ))}
            </div>
          </details>

          <details className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer text-sm font-bold text-paper/60">Proof details</summary>
            <div className="mt-4 text-sm leading-6 text-paper/65">
              <p>This {noun} stays labeled as practice and can never count as employment experience or satisfy years-of-experience requirements.</p>
              <ol className="mt-3 grid gap-1.5 text-xs">
                <li><strong>Requirement:</strong> {sprint.requirement}</li>
                <li><strong>Task:</strong> {sprintTypeLabel[sprint.sprintType]} · {sprint.title}</li>
                <li><strong>Submission:</strong> {sprint.userWork.trim().length} characters</li>
                <li><strong>Evidence:</strong> {evidence ? `${evidence.label} · ${evidenceState}` : "not found"}</li>
                <li><strong>Application:</strong> {application ? `${application.roleTitle} at ${application.company}` : target || "not linked"}</li>
              </ol>
            </div>
          </details>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {application ? <Link href={`/tailor?applicationId=${application.id}`} className="lab-pill-button px-5 py-2.5 text-sm font-black">Return to this job →</Link> : <Link href="/tailor" className="lab-pill-button px-5 py-2.5 text-sm font-black">Analyze another job →</Link>}
            {application && <Link href="/applications" className="text-sm font-bold text-paper/55 hover:text-cyan">Application tracker</Link>}
            <Link href="/role-sprint" className="text-sm font-bold text-paper/55 hover:text-cyan">All sprints</Link>
          </div>
        </>
      )}

      {!isCompleted && <Link href={application ? `/tailor?applicationId=${application.id}` : "/tailor"} className="mt-6 inline-block text-sm font-bold text-paper/55 hover:text-cyan">← Back to job analysis</Link>}
    </section>
  );
}

export default function RoleSprintPage() {
  return (
    <main id="main">
      <CommandNav active="/role-sprint" />
      <Suspense fallback={<section className="mx-auto max-w-4xl px-5 py-10 sm:px-8" aria-busy="true" />}>
        <RoleSprintWorkspace />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
