"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { APPLICATION_FOLLOW_UP_DAYS, addDays, isDue, logApplicationFollowUp } from "@/lib/command-center-insights";
import { createId } from "@/lib/command-center-store";
import { assessApplication, validateApplicationInput } from "@/lib/input-guidance";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationRecord, ApplicationStatus } from "@/types/command-center";

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

export default function ApplicationsPage() {
  const { state, update, hydrated } = useCommandCenter();
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [laneId, setLaneId] = useState("");
  const [inputIssues, setInputIssues] = useState<string[]>([]);
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const sorted = useMemo(() => {
    const order: ApplicationStatus[] = ["interviewing", "applied", "drafting", "offer", "rejected", "closed"];
    return [...state.applications].sort(
      (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.createdAt.localeCompare(a.createdAt)
    );
  }, [state.applications]);

  function addApplication() {
    const issues = validateApplicationInput({ company, roleTitle });
    setInputIssues(issues);
    // Missing both fields means there's nothing worth tracking yet; one
    // missing field gets flagged but doesn't block.
    if (!company.trim() && !roleTitle.trim()) return;
    update((current) => ({
      ...current,
      applications: [
        ...current.applications,
        {
          id: createId("app"),
          company: company.trim() || "Unknown company",
          roleTitle: roleTitle.trim() || "Untitled role",
          laneId: laneId || null,
          status: "drafting",
          jobPostUrl: "",
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
        }
      ]
    }));
    setCompany("");
    setRoleTitle("");
    setLaneId("");
  }

  function patchApplication(id: string, patch: Partial<ApplicationRecord>) {
    update((current) => ({
      ...current,
      applications: current.applications.map((app) => (app.id === id ? { ...app, ...patch } : app))
    }));
  }

  function setStatus(app: ApplicationRecord, status: ApplicationStatus) {
    const now = new Date().toISOString();
    const patch: Partial<ApplicationRecord> = { status };
    if (status === "applied" && !app.appliedAt) {
      patch.appliedAt = now;
      patch.nextFollowUpAt = addDays(now, APPLICATION_FOLLOW_UP_DAYS);
    }
    if (status !== "applied" && status !== "drafting") {
      patch.nextFollowUpAt = null;
    }
    patchApplication(app.id, patch);
  }

  function logFollowUp(app: ApplicationRecord) {
    const logged = logApplicationFollowUp(app, new Date().toISOString());
    patchApplication(app.id, { followUpsSent: logged.followUpsSent, nextFollowUpAt: logged.nextFollowUpAt });
  }

  function removeApplication(id: string) {
    update((current) => ({
      ...current,
      applications: current.applications.filter((app) => app.id !== id)
    }));
  }

  const laneTitle = (id: string | null) => state.lanes.find((lane) => lane.id === id)?.title ?? "—";
  const resumeVersionLabel = (id: string | null) =>
    id ? (state.resumeVersions.find((version) => version.id === id)?.label ?? null) : null;

  return (
    <main>
      <CommandNav active="/applications" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 04 · Pipeline</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Applications tracker</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Every application gets a status and a follow-up date. Marking one as applied schedules a follow-up in{" "}
          {APPLICATION_FOLLOW_UP_DAYS} days automatically — the dashboard will surface it when it’s due.
        </p>

        <div className="trust-panel mt-8 flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-40 flex-1">
            <span className="text-sm font-bold text-paper">Company</span>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Company name"
              className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
            />
          </label>
          <label className="min-w-40 flex-1">
            <span className="text-sm font-bold text-paper">Role</span>
            <input
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
              placeholder="Role title"
              className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
            />
          </label>
          <label className="min-w-40 flex-1">
            <span className="text-sm font-bold text-paper">Lane</span>
            <select
              value={laneId}
              onChange={(event) => setLaneId(event.target.value)}
              className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
            >
              <option value="">No lane</option>
              {state.lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addApplication}
            className="rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink transition hover:bg-cyan"
          >
            Add application
          </button>
          {inputIssues.length > 0 && (
            <div className="w-full">
              {inputIssues.map((issue) => (
                <p key={issue} className="mt-1 text-xs leading-5 text-gold">
                  {issue}
                </p>
              ))}
            </div>
          )}
        </div>

        {hydrated && !sorted.length && (
          <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/10 p-5 text-sm leading-6 text-paper/72">
            No applications tracked yet. The fastest path:{" "}
            <Link href="/tailor" className="font-bold text-cyan underline-offset-2 hover:underline">
              paste a job post into the tailoring engine
            </Link>
            , get your angle, apply, and it lands here with a follow-up date already set.
          </div>
        )}

        {hydrated && sorted.length > 0 && (
          <div className="mt-8 grid gap-3">
            {sorted.map((app) => {
              const followUpDue = app.status === "applied" && isDue(app.nextFollowUpAt, nowIso);
              const dataFlags = assessApplication(app);
              return (
                <article
                  key={app.id}
                  className={`trust-panel p-4 sm:p-5 ${followUpDue ? "border-gold/40" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                      <h2 className="text-base font-bold text-paper">
                        {app.roleTitle} <span className="font-normal text-paper/55">· {app.company}</span>
                        {dataFlags.map((flag) => (
                          <span
                            key={flag}
                            className="lab-mono ml-2 rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-gold"
                          >
                            {flag}
                          </span>
                        ))}
                      </h2>
                      <p className="lab-mono mt-1 text-[0.65rem] font-bold uppercase text-paper/45">
                        Lane: {laneTitle(app.laneId)} · Applied: {formatDate(app.appliedAt)} · Next follow-up:{" "}
                        <span className={followUpDue ? "text-gold" : ""}>{formatDate(app.nextFollowUpAt)}</span>
                        {app.followUpsSent.length > 0 &&
                          ` · Sent: ${app.followUpsSent.length} (last ${formatDate(app.followUpsSent[app.followUpsSent.length - 1])})`}
                        {app.interviewAt ? ` · Interview: ${formatDate(app.interviewAt)}` : ""}
                      </p>
                      {resumeVersionLabel(app.resumeVersionId) && (
                        <p className="mt-1 text-[0.72rem] leading-4">
                          <Link
                            href={`/versions/view?id=${app.resumeVersionId}`}
                            className="text-cyan/85 underline-offset-2 transition hover:text-gold hover:underline"
                          >
                            Resume attached: {resumeVersionLabel(app.resumeVersionId)}
                          </Link>
                        </p>
                      )}
                    </div>

                    <select
                      value={app.status}
                      onChange={(event) => setStatus(app, event.target.value as ApplicationStatus)}
                      className={`lab-mono rounded-full border bg-obsidian/60 px-3 py-1.5 text-[0.65rem] font-bold uppercase ${statusStyles[app.status]}`}
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>

                    {followUpDue && (
                      <button
                        type="button"
                        onClick={() => logFollowUp(app)}
                        className="rounded-md bg-gold px-3 py-1.5 text-xs font-black text-ink transition hover:bg-cyan"
                      >
                        Followed up — reschedule
                      </button>
                    )}

                    {app.status === "interviewing" && (
                      <input
                        type="date"
                        value={app.interviewAt ? app.interviewAt.slice(0, 10) : ""}
                        onChange={(event) =>
                          patchApplication(app.id, {
                            interviewAt: event.target.value ? new Date(event.target.value).toISOString() : null
                          })
                        }
                        className="trust-input border px-2 py-1.5 text-xs text-ink"
                        aria-label="Interview date"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => removeApplication(app.id)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/50 transition hover:border-coral hover:text-coral"
                    >
                      Remove
                    </button>
                  </div>

                  <textarea
                    value={app.notes}
                    rows={1}
                    placeholder="Notes: contact names, salary range, what you emphasized…"
                    onChange={(event) => patchApplication(app.id, { notes: event.target.value })}
                    className="mt-3 w-full rounded-md border border-white/10 bg-obsidian/40 px-3 py-2 text-sm text-paper/80 placeholder:text-paper/35"
                  />
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
