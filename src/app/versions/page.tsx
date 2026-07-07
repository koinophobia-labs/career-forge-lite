"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { deleteResumeVersion } from "@/lib/command-center-store";
import { handoffFromApplication, saveHandoff } from "@/lib/tailor-handoff";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationRecord, ResumeVersionRecord } from "@/types/command-center";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type VersionCardProps = {
  version: ResumeVersionRecord;
  application: ApplicationRecord | null;
  laneTitle: string | null;
  onDelete: () => void;
  onTailorAgain: (() => void) | null;
};

function VersionCard({ version, application, laneTitle, onDelete, onTailorAgain }: VersionCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(version.resumeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; text is visible in details for manual copy.
    }
  }

  return (
    <article id={version.id} className="trust-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-base font-bold text-paper">
            {version.label}
            <span
              className={`lab-mono ml-2 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase ${
                version.source === "tailor" ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-white/25 text-paper/55"
              }`}
            >
              {version.source === "tailor" ? "tailored" : "plain"}
            </span>
          </h2>
          <p className="lab-mono mt-1 text-[0.65rem] font-bold uppercase text-paper/45">
            {formatDate(version.createdAt)}
            {laneTitle ? ` · Lane: ${laneTitle}` : ""}
            {version.source === "tailor" && version.targetTitle
              ? ` · Target: ${version.targetTitle}${version.targetCompany ? ` @ ${version.targetCompany}` : ""}`
              : ""}
          </p>
          {application && (
            <p className="mt-1 text-[0.72rem] leading-4 text-cyan/85">
              Linked application: {application.roleTitle} · {application.company} ({application.status})
            </p>
          )}
        </div>

        <Link
          href={`/versions/view?id=${version.id}`}
          className="rounded-md bg-cyan px-3 py-1.5 text-xs font-black text-ink transition hover:bg-gold"
        >
          {version.resumeSnapshot ? "View & export" : "Open"}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
        >
          {open ? "Collapse" : "Details"}
        </button>
        {version.resumeText && (
          <button
            type="button"
            onClick={copyText}
            className="rounded-md bg-gold px-3 py-1.5 text-xs font-black text-ink transition hover:bg-cyan"
          >
            {copied ? "Copied" : "Copy resume text"}
          </button>
        )}
        {application && (
          <Link
            href="/applications"
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
          >
            Open application
          </Link>
        )}
        {onTailorAgain && (
          <button
            type="button"
            onClick={onTailorAgain}
            title="Restart a tailored resume session using this application's saved job-post analysis"
            className="rounded-md border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs font-bold text-cyan transition hover:border-gold hover:text-gold"
          >
            Tailor again
          </button>
        )}
        {confirmingDelete ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md bg-coral px-3 py-1.5 text-xs font-black text-ink transition hover:bg-ember"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/50 transition hover:border-coral hover:text-coral"
          >
            Delete
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 grid gap-4 border-t border-white/10 pt-4">
          {version.influenceSummary && (
            <div>
              <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Why this version changed</p>
              <p className="mt-1 text-[0.8rem] leading-5 text-paper/72">{version.influenceSummary}</p>
            </div>
          )}
          {version.keywordsUsed.length > 0 && (
            <div>
              <p className="lab-mono text-[0.68rem] font-bold uppercase text-mint">Keywords from the posting</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {version.keywordsUsed.map((term) => (
                  <span key={term} className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-0.5 text-xs font-bold text-mint">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
          {version.gapsAcknowledged.length > 0 && (
            <div>
              <p className="lab-mono text-[0.68rem] font-bold uppercase text-coral">Gaps kept honest (not claimed)</p>
              <ul className="mt-1 grid gap-1">
                {version.gapsAcknowledged.map((gap) => (
                  <li key={gap} className="text-[0.78rem] leading-5 text-paper/68">
                    · {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="lab-mono text-[0.68rem] font-bold uppercase text-paper/55">Resume text</p>
            {version.resumeText ? (
              <pre className="mt-1.5 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/12 bg-obsidian/50 p-4 font-sans text-[0.8rem] leading-5 text-paper/85">
                {version.resumeText}
              </pre>
            ) : (
              <p className="mt-1 text-[0.78rem] leading-5 text-paper/55">
                This version was generated before Career Forge stored resume text. Newly generated versions keep their
                full text — regenerate from the builder to get a stored copy.
              </p>
            )}
          </div>
          <p className="lab-mono text-[0.62rem] font-bold uppercase text-paper/40">{version.notes}</p>
        </div>
      )}
    </article>
  );
}

export default function VersionsPage() {
  const { state, update, hydrated } = useCommandCenter();
  const router = useRouter();
  const [deletedLabel, setDeletedLabel] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...state.resumeVersions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.resumeVersions]
  );

  const applicationFor = (version: ResumeVersionRecord): ApplicationRecord | null =>
    (version.applicationId ? state.applications.find((app) => app.id === version.applicationId) : null) ??
    state.applications.find((app) => app.resumeVersionId === version.id) ??
    null;

  const laneTitleFor = (version: ResumeVersionRecord): string | null =>
    version.laneId ? (state.lanes.find((lane) => lane.id === version.laneId)?.title ?? null) : null;

  function removeVersion(version: ResumeVersionRecord) {
    update((current) => deleteResumeVersion(current, version.id));
    setDeletedLabel(version.label);
    window.setTimeout(() => setDeletedLabel(null), 4000);
  }

  function tailorAgain(application: ApplicationRecord) {
    const lane = application.laneId ? (state.lanes.find((item) => item.id === application.laneId) ?? null) : null;
    saveHandoff(handoffFromApplication(application, lane));
    router.push("/resume-builder");
  }

  return (
    <main>
      <CommandNav active="/versions" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Resume archive</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Every version, and why it exists.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Each generated resume is saved here with its full text, the job it was built for, the keywords it used, and
          the gaps it refused to claim. Copy a version for an application, reopen an old angle, or clear out drafts.
        </p>

        {deletedLabel && (
          <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-paper/80">
            Deleted “{deletedLabel}”. Any application it was attached to now shows no resume version.
          </div>
        )}

        {hydrated && !sorted.length && (
          <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/10 p-5 text-sm leading-6 text-paper/72">
            <p>
              No resume versions yet. Generate one in the builder — or better, start from a job post so the version is
              tailored and linked to an application.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/tailor" className="rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink transition hover:bg-gold">
                Tailor against a job post
              </Link>
              <Link
                href="/resume-builder"
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
              >
                Open the builder
              </Link>
            </div>
          </div>
        )}

        {hydrated && sorted.length > 0 && (
          <div className="mt-8 grid gap-3">
            {sorted.map((version) => {
              const application = applicationFor(version);
              return (
                <VersionCard
                  key={version.id}
                  version={version}
                  application={application}
                  laneTitle={laneTitleFor(version)}
                  onDelete={() => removeVersion(version)}
                  onTailorAgain={
                    application && (application.analysisKeywords.length || application.analysisGaps.length)
                      ? () => tailorAgain(application)
                      : null
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
