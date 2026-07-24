"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  applicationPriority,
  applicationStatusPatch,
  linkedRoleSprintCount,
  removeApplicationWorkspace,
  type ApplicationRemovalMode
} from "@/lib/application-workflow";
import { APPLICATION_FOLLOW_UP_DAYS, isDue, logApplicationFollowUp } from "@/lib/command-center-insights";
import { createId } from "@/lib/command-center-store";
import { assessApplication, validateApplicationInput } from "@/lib/input-guidance";
import { hasSavedJobWorkspace } from "@/lib/job-workspace";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationRecord, ApplicationStatus, CommandCenterState, RoleSprintRecord } from "@/types/command-center";

const statusLabels: Record<ApplicationStatus, string> = {
  drafting: "Drafting",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  closed: "Closed"
};

const statusStyles: Record<ApplicationStatus, string> = {
  drafting: "border-white/25 text-paper/60",
  applied: "border-cyan/50 bg-cyan/10 text-cyan",
  interviewing: "border-gold/50 bg-gold/10 text-gold",
  offer: "border-spruce/60 bg-mint/10 text-mint",
  rejected: "border-coral/50 bg-coral/10 text-coral",
  closed: "border-white/20 text-paper/40"
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sprintTrackerLabel(state: CommandCenterState, sprint: RoleSprintRecord): string {
  if (sprint.status === "draft") return "in progress";
  const evidence = sprint.evidenceId ? state.dossier.evidence.find((item) => item.id === sprint.evidenceId) : null;
  if (!evidence) return "evidence missing";
  if (evidence.rejected) return "proof rejected · revise";
  if (evidence.approved) return "approved practice";
  return "proof pending review";
}

export function ApplicationsWorkspace() {
  const { state, update, hydrated } = useCommandCenter();
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [laneId, setLaneId] = useState("");
  const [inputIssues, setInputIssues] = useState<string[]>([]);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const sorted = useMemo(
    () => [...state.applications].sort((a, b) => applicationPriority(a) - applicationPriority(b) || b.createdAt.localeCompare(a.createdAt)),
    [state.applications]
  );

  function addApplication() {
    const issues = validateApplicationInput({ company, roleTitle });
    setInputIssues(issues);
    if (!company.trim() && !roleTitle.trim()) return;
    update((current) => ({
      ...current,
      applications: [...current.applications, {
        id: createId("app"),
        company: company.trim() || "Unknown company",
        roleTitle: roleTitle.trim() || "Untitled role",
        laneId: laneId || null,
        status: "drafting",
        jobPostUrl: "",
        source: "other",
        discoveryUrl: "",
        applicationUrl: "",
        postingDate: null,
        deadline: null,
        contactName: "",
        contactUrl: "",
        resumeVariantId: null,
        applicationQuestions: [],
        resumeVersionId: null,
        appliedAt: null,
        nextFollowUpAt: null,
        followUpsSent: [],
        interviewAt: null,
        notes: "",
        analysisKeywords: [],
        analysisGaps: [],
        analysisWeakSpots: [],
        createdAt: new Date().toISOString()
      }]
    }));
    setCompany("");
    setRoleTitle("");
    setLaneId("");
  }

  function patchApplication(id: string, patch: Partial<ApplicationRecord>) {
    update((current) => ({
      ...current,
      applications: current.applications.map((application) => application.id === id ? { ...application, ...patch } : application)
    }));
  }

  function setStatus(application: ApplicationRecord, status: ApplicationStatus) {
    patchApplication(application.id, applicationStatusPatch(application, status, new Date().toISOString()));
  }

  function logFollowUp(application: ApplicationRecord) {
    const logged = logApplicationFollowUp(application, new Date().toISOString());
    patchApplication(application.id, { followUpsSent: logged.followUpsSent, nextFollowUpAt: logged.nextFollowUpAt });
  }

  function confirmRemoval(applicationId: string, mode: ApplicationRemovalMode) {
    update((current) => removeApplicationWorkspace(current, applicationId, mode));
    setPendingRemovalId(null);
  }

  const laneTitle = (id: string | null) => state.lanes.find((lane) => lane.id === id)?.title ?? "—";
  const resumeVersionLabel = (id: string | null) => id ? state.resumeVersions.find((version) => version.id === id)?.label ?? null : null;

  return (
    <main>
      <CommandNav active="/applications" />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Applications</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Applications tracker</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">Offers and interviews stay at the top. Marking a job as applied schedules a follow-up in {APPLICATION_FOLLOW_UP_DAYS} days.</p>

        <div className="trust-panel mt-8 flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-40 flex-1"><span className="text-sm font-bold text-paper">Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
          <label className="min-w-40 flex-1"><span className="text-sm font-bold text-paper">Role</span><input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="Role title" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
          <label className="min-w-40 flex-1"><span className="text-sm font-bold text-paper">Target role</span><select value={laneId} onChange={(event) => setLaneId(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No saved target</option>{state.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label>
          <button type="button" onClick={addApplication} className="rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink transition hover:bg-cyan">Add application</button>
          {inputIssues.length > 0 && <div className="w-full">{inputIssues.map((issue) => <p key={issue} className="mt-1 text-xs leading-5 text-gold">{issue}</p>)}</div>}
        </div>

        {hydrated && !sorted.length && (
          <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/10 p-5 text-sm leading-6 text-paper/72">
            No applications tracked yet. The fastest path is to <Link href="/tailor" className="font-bold text-cyan underline-offset-2 hover:underline">paste a real job posting</Link>, analyze it, and save the workspace.
          </div>
        )}

        {hydrated && sorted.length > 0 && (
          <div className="mt-8 grid gap-3">
            {sorted.map((application) => {
              const followUpDue = application.status === "applied" && isDue(application.nextFollowUpAt, nowIso);
              const dataFlags = assessApplication(application);
              const linkedSprints = state.roleSprints.filter((sprint) => sprint.applicationId === application.id);
              const removalOpen = pendingRemovalId === application.id;
              return (
                <article key={application.id} className={`trust-panel p-4 sm:p-5 ${followUpDue ? "border-gold/40" : application.status === "offer" ? "border-mint/45" : ""}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="mr-auto min-w-0">
                      <h2 className="text-base font-bold text-paper">
                        {application.roleTitle} <span className="font-normal text-paper/55">· {application.company}</span>
                        {dataFlags.map((flag) => <span key={flag} className="lab-mono ml-2 rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-gold">{flag}</span>)}
                      </h2>
                      <p className="lab-mono mt-1 text-[0.65rem] font-bold uppercase text-paper/45">
                        Target: {laneTitle(application.laneId)} · Applied: {formatDate(application.appliedAt)} · Next follow-up: <span className={followUpDue ? "text-gold" : ""}>{formatDate(application.nextFollowUpAt)}</span>
                        {application.followUpsSent.length > 0 && ` · Sent: ${application.followUpsSent.length}`}
                        {application.interviewAt ? ` · Interview: ${formatDate(application.interviewAt)}` : ""}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <Link href={`/tailor?applicationId=${application.id}`} className="rounded-md border border-gold/40 px-3 py-2 font-black text-gold">{hasSavedJobWorkspace(application) ? "Open job workspace →" : "Add job posting →"}</Link>
                        {resumeVersionLabel(application.resumeVersionId) && <Link href={`/versions/view?id=${application.resumeVersionId}`} className="rounded-md border border-cyan/35 px-3 py-2 font-bold text-cyan">Open attached résumé</Link>}
                        {application.discoveryUrl && <a href={application.discoveryUrl} target="_blank" rel="noreferrer" className="rounded-md border border-white/15 px-3 py-2 text-paper/65">Discovery post</a>}
                        {application.applicationUrl && <a href={application.applicationUrl} target="_blank" rel="noreferrer" className="rounded-md border border-white/15 px-3 py-2 text-paper/65">Employer application</a>}
                      </div>

                      {linkedSprints.length > 0 && (
                        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] leading-4">
                          <span className="uppercase text-paper/45">Role Sprints:</span>
                          {linkedSprints.map((sprint) => <Link key={sprint.id} href={`/role-sprint?id=${sprint.id}`} className="text-cyan/85 underline-offset-2 hover:text-gold hover:underline">{sprint.title || sprint.requirement} · {sprintTrackerLabel(state, sprint)}</Link>)}
                        </p>
                      )}
                    </div>

                    <select value={application.status} onChange={(event) => setStatus(application, event.target.value as ApplicationStatus)} className={`lab-mono rounded-full border bg-obsidian/60 px-3 py-1.5 text-[0.65rem] font-bold uppercase ${statusStyles[application.status]}`}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {followUpDue && <button type="button" onClick={() => logFollowUp(application)} className="rounded-md bg-gold px-3 py-1.5 text-xs font-black text-ink transition hover:bg-cyan">Followed up</button>}
                    {application.status === "interviewing" && <input type="date" value={application.interviewAt ? application.interviewAt.slice(0, 10) : ""} onChange={(event) => patchApplication(application.id, { interviewAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className="trust-input border px-2 py-1.5 text-xs text-ink" aria-label="Interview date" />}
                    <button type="button" onClick={() => setPendingRemovalId(removalOpen ? null : application.id)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/50 transition hover:border-coral hover:text-coral">Remove</button>
                  </div>

                  {removalOpen && (
                    <div className="mt-4 rounded-xl border border-coral/35 bg-coral/10 p-4 text-sm leading-6 text-paper/75">
                      {linkedRoleSprintCount(state, application.id) > 0 ? (
                        <>
                          <p className="font-bold text-paper">This job has {linkedRoleSprintCount(state, application.id)} linked Role Sprint{linkedRoleSprintCount(state, application.id) === 1 ? "" : "s"}.</p>
                          <p className="mt-1 text-xs text-paper/55">Approved practice evidence stays in your evidence library either way.</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => confirmRemoval(application.id, "keep-sprints")} className="rounded-md border border-gold/45 px-3 py-2 text-xs font-bold text-gold">Delete job, keep practice</button>
                            <button type="button" onClick={() => confirmRemoval(application.id, "remove-sprints")} className="rounded-md border border-coral/50 px-3 py-2 text-xs font-bold text-coral">Delete job + sprint records</button>
                            <button type="button" onClick={() => setPendingRemovalId(null)} className="rounded-md border border-white/15 px-3 py-2 text-xs font-bold text-paper/60">Cancel</button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3"><span>Delete this job workspace?</span><button type="button" onClick={() => confirmRemoval(application.id, "keep-sprints")} className="rounded-md border border-coral/50 px-3 py-2 text-xs font-bold text-coral">Delete job</button><button type="button" onClick={() => setPendingRemovalId(null)} className="text-xs font-bold text-paper/60">Cancel</button></div>
                      )}
                    </div>
                  )}

                  <textarea value={application.notes} rows={1} placeholder="Notes: contact names, salary range, what you emphasized…" onChange={(event) => patchApplication(application.id, { notes: event.target.value })} className="mt-3 w-full rounded-md border border-white/10 bg-obsidian/40 px-3 py-2 text-sm text-paper/80 placeholder:text-paper/35" />
                  {application.applicationQuestions.length > 0 && <section className="mt-4 border-t border-white/10 pt-4"><h3 className="text-sm font-bold text-paper">Application answers</h3><div className="mt-3 grid gap-3">{application.applicationQuestions.map((question) => <label key={question.id} className="block"><span className="text-xs font-bold text-paper/70">{question.prompt}</span><textarea value={question.draftAnswer} rows={4} onChange={(event) => patchApplication(application.id, { applicationQuestions: application.applicationQuestions.map((item) => item.id === question.id ? { ...item, draftAnswer: event.target.value, userEdited: true } : item) })} className="mt-1 w-full rounded-md border border-white/10 bg-obsidian/40 px-3 py-2 text-sm text-paper/80" /><span className="mt-1 block text-xs text-paper/45">Supporting evidence: {question.evidenceIds.length ? question.evidenceIds.map((id) => state.dossier.evidence.find((item) => item.id === id)?.detail).filter(Boolean).join(" · ") : "None — do not submit until evidence is added."}{question.userEdited ? " · User edited" : ""}</span></label>)}</div></section>}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
