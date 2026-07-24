"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { CopyButton } from "@/components/CopyButton";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import {
  ROLE_SPRINT_MIN_WORK_CHARS,
  completeRoleSprint,
  sprintProvenanceNoun,
  sprintSupportingEvidence,
  sprintUnprovenStatement
} from "@/lib/role-sprint";
import { useCommandCenter } from "@/lib/use-command-center";
import type { RoleSprintOutputs, RoleSprintRecord } from "@/types/command-center";

const statusChip: Record<RoleSprintRecord["status"], { label: string; className: string }> = {
  draft: { label: "In progress", className: "border-gold/50 bg-gold/10 text-gold" },
  completed: { label: "Completed · evidence pending review", className: "border-cyan/50 bg-cyan/10 text-cyan" },
  "approved-as-evidence": { label: "Approved as evidence", className: "border-spruce/60 bg-mint/10 text-mint" }
};

const sprintTypeLabel: Record<RoleSprintRecord["sprintType"], string> = {
  explain: "Explain",
  evaluate: "Evaluate",
  plan: "Plan",
  simulate: "Simulate",
  build: "Build"
};

const outputFields: Array<{ key: keyof Omit<RoleSprintOutputs, "userEdited">; label: string; hint: string; rows: number }> = [
  { key: "portfolioTitle", label: "Portfolio artifact title", hint: "Use it as the heading wherever you keep practice work.", rows: 2 },
  { key: "portfolioSummary", label: "Portfolio summary", hint: "Keeps the practice label attached when you show the work.", rows: 4 },
  { key: "resumeBullet", label: "Résumé / project bullet", hint: "Belongs under projects or independent work — never under employment.", rows: 3 },
  { key: "starStory", label: "STAR interview story outline", hint: "An honest gap-closing story: analysis → bounded practice → artifact.", rows: 6 },
  { key: "talkingPoint", label: "Application talking point", hint: "For a cover letter or application question about this requirement.", rows: 3 }
];

function RoleSprintWorkspace() {
  const searchParams = useSearchParams();
  const sprintId = searchParams.get("id") ?? "";
  const { state, update, hydrated } = useCommandCenter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sprint = state.roleSprints.find((item) => item.id === sprintId) ?? null;
  const application = sprint?.applicationId
    ? state.applications.find((item) => item.id === sprint.applicationId) ?? null
    : null;
  const evidence = sprint?.evidenceId
    ? state.dossier.evidence.find((item) => item.id === sprint.evidenceId) ?? null
    : null;
  const supporting = sprint ? sprintSupportingEvidence(sprint, state.dossier) : [];

  // The stored status is synced on approval, but the page also derives the
  // live evidence state so a stale record can never display "approved".
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
      roleSprints: current.roleSprints.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      )
    }));
  }

  function patchOutputs(record: RoleSprintRecord, key: keyof Omit<RoleSprintOutputs, "userEdited">, value: string) {
    if (!record.outputs) return;
    patchSprint(record.id, { outputs: { ...record.outputs, [key]: value, userEdited: true } });
  }

  function submitWork(record: RoleSprintRecord) {
    setSubmitError(null);
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

  if (!hydrated) {
    return <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8" aria-busy="true" />;
  }

  if (!sprint) {
    const sprints = [...state.roleSprints].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return (
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Role Sprint · Close one gap before you apply</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Your Role Sprints</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          A Role Sprint turns one honest job-post gap into one bounded practice exercise. Start one from an eligible
          requirement card in a job-post analysis — the completed work becomes labeled practice evidence you review
          before it supports anything.
        </p>
        {sprints.length ? (
          <div className="mt-6 grid gap-2.5">
            {sprints.map((item) => (
              <Link
                key={item.id}
                href={`/role-sprint?id=${item.id}`}
                className="rounded-lg border border-white/12 bg-obsidian/40 p-3.5 transition hover:border-cyan/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="max-w-2xl text-sm font-bold leading-5 text-paper">{item.title || item.requirement}</p>
                  <span className={`lab-mono shrink-0 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase ${statusChip[item.status].className}`}>
                    {statusChip[item.status].label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-paper/55">
                  {[item.roleTitle, item.company].filter(Boolean).join(" at ") || "No target saved"} ·{" "}
                  {sprintTypeLabel[item.sprintType]} sprint
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
            No sprints yet. Analyze a job post and look for <span className="font-bold">Build proof for this gap</span> on
            a requirement the analysis marked <span className="lab-mono uppercase">gap</span> or{" "}
            <span className="lab-mono uppercase">partial</span>.
          </div>
        )}
        <Link href="/tailor" className="lab-pill-button mt-6 inline-flex px-5 py-2.5 text-sm font-black">
          Analyze a job post →
        </Link>
      </section>
    );
  }

  const noun = sprintProvenanceNoun(sprint.sprintType);
  const target = [sprint.roleTitle, sprint.company].filter(Boolean).join(" at ");
  const workLength = sprint.userWork.trim().length;
  const isCompleted = sprint.status !== "draft";

  return (
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <p className="trust-kicker text-sm font-bold uppercase">Role Sprint · Close one gap before you apply</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-2xl text-3xl font-bold text-paper">{sprint.title}</h1>
        <span className={`lab-mono shrink-0 rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase ${statusChip[sprint.status].className}`}>
          {statusChip[sprint.status].label}
        </span>
      </div>
      <p className="mt-2 text-sm text-paper/60">
        {target || "No target saved"} · {sprintTypeLabel[sprint.sprintType]} sprint · 20–60 minutes · one artifact
      </p>

      <div className="trust-panel mt-6 grid gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-bold text-paper">Why this requirement matters here</h2>
          <p className="mt-1.5 text-sm leading-6 text-paper/70">
            The posting{target ? ` for ${target}` : ""} asks for:{" "}
            <span className="font-bold text-paper">“{sprint.requirement}”</span>. Your analysis marked it{" "}
            <span className={`lab-mono uppercase ${sprint.originalStatus === "gap" ? "text-coral" : "text-gold"}`}>
              {sprint.originalStatus}
            </span>
            {" "}against your approved evidence, so an application today leans on adjacent proof for it. One bounded{" "}
            {noun} gives you something real and labeled to point at instead of a hopeful sentence.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-mint/25 bg-mint/5 p-3.5">
            <p className="lab-mono text-xs font-bold uppercase text-mint">What you already have</p>
            {supporting.length ? (
              <ul className="mt-2 grid gap-1.5 text-[0.8rem] leading-5 text-paper/70">
                {supporting.map((item) => (
                  <li key={item.id}>• {item.detail}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.8rem] leading-5 text-paper/60">
                No approved evidence currently supports this requirement — that is exactly why this sprint exists.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-coral/25 bg-coral/5 p-3.5">
            <p className="lab-mono text-xs font-bold uppercase text-coral">What stays unproven</p>
            <p className="mt-2 text-[0.8rem] leading-5 text-paper/70">{sprintUnprovenStatement(sprint)}</p>
          </div>
        </div>
      </div>

      <div className="trust-panel mt-6 p-5 sm:p-6">
        <h2 className="text-base font-bold text-paper">Your sprint</h2>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-paper/75">
          {sprint.instructions.map((step, index) => (
            <li key={step} className="rounded-lg border border-white/10 bg-obsidian/40 p-3">
              <span className="lab-mono mr-2 text-xs font-bold text-cyan">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="lab-mono mt-4 text-xs font-bold uppercase text-paper/55">Done means</p>
        <ul className="mt-2 grid gap-1.5 text-[0.8rem] leading-5 text-paper/70">
          {sprint.completionCriteria.map((criterion) => (
            <li key={criterion}>✓ {criterion}</li>
          ))}
        </ul>
      </div>

      <div className="trust-panel mt-6 p-5 sm:p-6">
        <h2 className="text-base font-bold text-paper">{isCompleted ? "Your submitted work" : "Work area"}</h2>
        <p className="mt-1 text-sm text-paper/55">
          Saved locally as you type. The submission itself becomes the source text of the evidence record — nothing is
          generated from anything you didn’t write here.
        </p>
        <textarea
          aria-label="Sprint work area"
          value={sprint.userWork}
          rows={12}
          placeholder="Do the sprint here (or paste the finished artifact). This exact text is what your proof will cite."
          onChange={(event) => patchSprint(sprint.id, { userWork: event.target.value })}
          disabled={evidenceState === "approved"}
          className="trust-input mt-3 w-full border px-3 py-2.5 text-sm text-ink disabled:opacity-60"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className={`text-xs ${workLength >= ROLE_SPRINT_MIN_WORK_CHARS ? "text-mint" : "text-paper/50"}`}>
            {workLength} characters · {ROLE_SPRINT_MIN_WORK_CHARS}+ needed to submit
          </p>
          {evidenceState !== "approved" && (
            <button
              type="button"
              onClick={() => submitWork(sprint)}
              disabled={workLength < ROLE_SPRINT_MIN_WORK_CHARS}
              className="ml-auto rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCompleted ? "Update submission & regenerate drafts" : "Submit sprint — create pending proof"}
            </button>
          )}
        </div>
        {submitError && (
          <p className="mt-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm leading-6 text-paper/80">
            {submitError}
          </p>
        )}
        {evidenceState === "approved" && (
          <p className="mt-3 rounded-lg border border-mint/35 bg-mint/10 px-3 py-2 text-xs leading-5 text-paper/75">
            This submission is approved evidence now, so it’s locked here. To change it, reject the evidence in your{" "}
            <Link href="/profile" className="font-bold text-gold underline-offset-2 hover:underline">Work History</Link>{" "}
            first — the sprint will reopen automatically.
          </p>
        )}
      </div>

      {isCompleted && sprint.outputs && (
        <>
          <div className="mt-6 rounded-xl border border-cyan/30 bg-cyan/10 p-4 text-sm leading-6 text-paper/78">
            {evidenceState === "approved" ? (
              <>
                <span className="font-bold text-mint">Approved.</span> This {noun} is now approved dossier evidence with
                its practice label attached. Job-post analyses can cite it as labeled practice support — it will never
                read as employment experience or flip a requirement to “covered.”
              </>
            ) : evidenceState === "rejected" ? (
              <>
                <span className="font-bold text-coral">Evidence rejected.</span> You rejected this sprint’s evidence in
                review, so nothing cites it. Rework the submission above and submit again to propose a new version.
              </>
            ) : evidenceState === "missing" ? (
              <>
                <span className="font-bold text-coral">Evidence removed.</span> The linked evidence record no longer
                exists in your dossier. Submit again to recreate pending proof from your work.
              </>
            ) : (
              <>
                <span className="font-bold text-gold">Pending your review.</span> Completing the sprint did NOT change
                the job requirement’s status — it created a proposed evidence record labeled as a {noun}. Approve or
                reject it under{" "}
                <Link href="/profile#evidence-review" className="font-bold text-gold underline-offset-2 hover:underline">
                  Review proposed or migrated evidence
                </Link>{" "}
                in Work History. Until you approve it, nothing cites it.
              </>
            )}
          </div>

          <div className="trust-panel mt-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-paper">Use this work — editable drafts</h2>
                <p className="mt-1 text-sm text-paper/55">
                  Generated only from your submission, the requirement, and your approved evidence. Every draft keeps
                  the {noun} label — keep it when you edit.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {outputFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-paper">{field.label}</span>
                    <CopyButton getText={() => sprint.outputs?.[field.key] ?? ""} />
                  </span>
                  <span className="mt-0.5 block text-xs text-paper/50">{field.hint}</span>
                  <textarea
                    aria-label={field.label}
                    value={sprint.outputs?.[field.key] ?? ""}
                    rows={field.rows}
                    onChange={(event) => patchOutputs(sprint, field.key, event.target.value)}
                    className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
                  />
                </label>
              ))}
              {sprint.outputs.userEdited && (
                <p className="text-xs text-paper/45">
                  Edited by you — resubmitting the sprint regenerates all drafts and discards these edits.
                </p>
              )}
            </div>
          </div>

          <div className="trust-panel mt-6 p-5 sm:p-6">
            <h2 className="text-base font-bold text-paper">Provenance — kept connected</h2>
            <ol className="mt-3 grid gap-1.5 text-[0.8rem] leading-6 text-paper/70">
              <li>
                <span className="lab-mono font-bold uppercase text-paper/50">Requirement</span> “{sprint.requirement}”
                — marked <span className="lab-mono uppercase">{sprint.originalStatus}</span> at sprint creation.
              </li>
              <li>
                <span className="lab-mono font-bold uppercase text-paper/50">Sprint</span>{" "}
                {sprintTypeLabel[sprint.sprintType]} · “{sprint.title}”
              </li>
              <li>
                <span className="lab-mono font-bold uppercase text-paper/50">Your submission</span>{" "}
                {sprint.userWork.trim().length} characters, saved {sprint.updatedAt.slice(0, 10)}
              </li>
              <li>
                <span className="lab-mono font-bold uppercase text-paper/50">Evidence</span>{" "}
                {evidence ? `“${evidence.label}” · ${evidenceState}` : "record missing"}
              </li>
              <li>
                <span className="lab-mono font-bold uppercase text-paper/50">Application</span>{" "}
                {application
                  ? `${application.roleTitle || "Untitled role"}${application.company ? ` at ${application.company}` : ""} (${application.status})`
                  : target
                    ? `${target} (not tracked yet)`
                    : "not linked"}
              </li>
            </ol>
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {application && (
          <Link href="/applications" className="lab-pill-button px-4 py-2 text-sm font-black">
            Back to this application →
          </Link>
        )}
        <Link
          href="/tailor"
          className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
        >
          Back to tailoring
        </Link>
        <Link
          href="/role-sprint"
          className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
        >
          All sprints
        </Link>
      </div>
    </section>
  );
}

export default function RoleSprintPage() {
  return (
    <main>
      <CommandNav active="/tailor" />
      <Suspense fallback={<section className="mx-auto max-w-4xl px-5 py-10 sm:px-8" aria-busy="true" />}>
        <RoleSprintWorkspace />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
