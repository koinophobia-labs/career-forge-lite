"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { deleteResumeVersion } from "@/lib/command-center-store";
import { createPackBundle, createVariantFile, downloadBlob } from "@/lib/pack-export";
import { updatePackVariant } from "@/lib/resume-pack";
import { trackCareerEvent } from "@/lib/analytics";
import { handoffFromApplication, saveHandoff } from "@/lib/tailor-handoff";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationRecord, ResumeVersionRecord } from "@/types/command-center";
import type { ResumePack, ResumeVariant } from "@/types/dossier";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function valuesForEditor(value: string): string[] {
  return [...new Set(value.split(/\n+/).map((item) => item.trim()).filter(Boolean))];
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

function PackDashboard({ pack, state, onUpdate, onRecordExport }: { pack: ResumePack; state: ReturnType<typeof useCommandCenter>["state"]; onUpdate: (next: ResumePack) => void; onRecordExport: (filenames: string[]) => void }) {
  const [working, setWorking] = useState(false);
  const [lastExportCount, setLastExportCount] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [undoByVariant, setUndoByVariant] = useState<Record<string, ResumeVariant["resume"]>>({});

  async function exportBundle() {
    setWorking(true);
    try {
      const result = await createPackBundle(pack, state.dossier, state.lanes, ["pdf", "docx"]);
      downloadBlob(result.blob, result.filename);
      onRecordExport(result.filenames);
      setLastExportCount(result.filenames.length);
      trackCareerEvent("pack_bundle_exported");
    } finally { setWorking(false); }
  }

  async function exportVariant(variant: ResumeVariant, format: "pdf" | "docx") {
    const lane = state.lanes.find((item) => item.id === variant.laneId);
    const file = await createVariantFile(variant, state.dossier, lane?.title ?? "General", format);
    downloadBlob(file.blob, file.filename);
    trackCareerEvent("resume_exported");
  }

  function duplicate(variant: ResumeVariant) {
    const copy = { ...variant, id: `${variant.id}-copy-${Date.now().toString(36)}`, title: `${variant.title} (copy)`, canonical: false, userEdited: true, status: "needs-review" as const };
    onUpdate({ ...pack, variants: [...pack.variants, copy], status: "needs-review", updatedAt: new Date().toISOString() });
  }

  function rename(variant: ResumeVariant) {
    const title = window.prompt("Rename résumé", variant.title)?.trim();
    if (!title) return;
    onUpdate({ ...pack, variants: pack.variants.map((item) => item.id === variant.id ? { ...item, title, userEdited: true } : item) });
  }

  function markCanonical(variant: ResumeVariant) {
    onUpdate({ ...pack, variants: pack.variants.map((item) => item.laneId === variant.laneId && item.kind === variant.kind ? { ...item, canonical: item.id === variant.id } : item) });
  }

  function remove(variant: ResumeVariant) {
    const linked = state.applications.some((app) => app.resumeVersionId === variant.id) || pack.variants.some((item) => item.baselineVariantId === variant.id);
    if (linked) { window.alert("This résumé is still linked to an application or job-specific version. Reassign that relationship before deleting it."); return; }
    onUpdate({ ...pack, variants: pack.variants.filter((item) => item.id !== variant.id), status: "needs-review" });
  }

  function editVariant(variant: ResumeVariant, resume: ResumeVariant["resume"], path: string) {
    setUndoByVariant((current) => current[variant.id] ? current : { ...current, [variant.id]: variant.resume });
    onUpdate(updatePackVariant(pack, variant.id, resume, new Date().toISOString(), [path]));
  }

  function undoLatest(variant: ResumeVariant) {
    const previous = undoByVariant[variant.id];
    if (!previous) return;
    onUpdate(updatePackVariant(pack, variant.id, previous, new Date().toISOString(), ["undo"]));
    setUndoByVariant((current) => { const next = { ...current }; delete next[variant.id]; return next; });
  }

  return (
    <section className="trust-panel mt-8 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="trust-kicker text-xs font-bold uppercase">Current Résumé Pack</p><h2 className="mt-2 text-2xl font-bold text-paper">{pack.variants.length} documents across {pack.lanePacks.length} lane(s)</h2><p className="mt-1 text-sm text-paper/55">Status: {pack.status.replace("-", " ")} · generated {formatDate(pack.createdAt)}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={exportBundle} disabled={working} className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan disabled:opacity-50">{working ? "Building ZIP…" : "Export PDF + DOCX bundle"}</button><Link href="/targets" className="rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan">Regenerate from dossier</Link>{lastExportCount !== null && <p className="w-full text-xs font-bold text-mint">Bundle prepared with {lastExportCount} files: 6 PDF/DOCX pairs plus LinkedIn materials and README.</p>}</div>
      </div>
      <div className="mt-5 grid gap-5">
        {pack.lanePacks.map((lanePack) => {
          const lane = state.lanes.find((item) => item.id === lanePack.laneId);
          const variants = pack.variants.filter((item) => item.laneId === lanePack.laneId);
          return <div key={lanePack.laneId} className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><h3 className="text-lg font-bold text-paper">{lane?.title ?? "Lane"}</h3><p className="mt-1 text-sm leading-5 text-paper/55">{lanePack.positioningPitch}</p><div className="mt-3 grid gap-3">
            {variants.map((variant) => {
              const previous = state.resumePacks.flatMap((item) => item.variants).filter((item) => item.id !== variant.id && item.laneId === variant.laneId && item.kind === variant.kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              return <article key={variant.id} className="rounded-lg border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap items-center gap-2"><div className="mr-auto"><p className="font-bold text-paper">{variant.title}</p><p className="lab-mono mt-1 text-[0.62rem] font-bold uppercase text-paper/45">{variant.kind} · {variant.status.replace("-", " ")} · {variant.evidenceReferences.length} traced claims{variant.userEdited ? " · user edited" : ""}</p></div><button type="button" onClick={() => setEditingId(editingId === variant.id ? null : variant.id)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">{editingId === variant.id ? "Close" : "View / edit"}</button><button type="button" onClick={() => void navigator.clipboard.writeText([variant.resume.summary, ...variant.resume.experience.flatMap((role) => role.bullets)].join("\n"))} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Copy</button><button type="button" onClick={() => void exportVariant(variant, "pdf")} className="rounded-full border border-cyan/30 px-3 py-1.5 text-xs text-cyan">Print / PDF</button><button type="button" onClick={() => void exportVariant(variant, "docx")} className="rounded-full border border-cyan/30 px-3 py-1.5 text-xs text-cyan">DOCX</button><button type="button" onClick={() => duplicate(variant)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Duplicate</button><button type="button" onClick={() => rename(variant)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Rename</button><button type="button" onClick={() => markCanonical(variant)} className="rounded-full border border-gold/30 px-3 py-1.5 text-xs text-gold">{variant.canonical ? "Canonical" : "Mark canonical"}</button>{previous && <button type="button" onClick={() => setCompareId(compareId === variant.id ? null : variant.id)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Compare</button>}<button type="button" onClick={() => remove(variant)} className="rounded-full border border-coral/25 px-3 py-1.5 text-xs text-coral">Delete</button></div>
                {editingId === variant.id && <div className="mt-3 grid gap-4 border-t border-white/10 pt-3"><div className="flex items-center justify-between"><p className="lab-mono text-[0.65rem] font-bold uppercase text-gold">Full document editor</p>{undoByVariant[variant.id] && <button type="button" onClick={() => undoLatest(variant)} className="rounded border border-gold/40 px-3 py-1 text-xs font-bold text-gold">Undo latest edit</button>}</div><label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Summary<textarea className="trust-input mt-1.5 w-full border p-3 text-sm text-ink" rows={5} defaultValue={variant.resume.summary} onBlur={(event) => { if (event.target.value !== variant.resume.summary) editVariant(variant, { ...variant.resume, summary: event.target.value }, "summary"); }} /></label><label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Skills<textarea className="trust-input mt-1.5 w-full border p-3 text-sm text-ink" rows={4} defaultValue={variant.resume.coreSkills.join("\n")} onBlur={(event) => editVariant(variant, { ...variant.resume, coreSkills: valuesForEditor(event.target.value) }, "coreSkills")} /></label>{variant.resume.experience.map((role, roleIndex) => <fieldset key={`${variant.id}-role-${roleIndex}`} className="rounded-lg border border-white/10 p-3"><legend className="px-2 text-xs font-bold uppercase text-paper/50">Role or project {roleIndex + 1}</legend><div className="grid gap-2 sm:grid-cols-3"><input aria-label={`Edit heading ${roleIndex + 1}`} defaultValue={role.title} onBlur={(event) => editVariant(variant, { ...variant.resume, experience: variant.resume.experience.map((item, index) => index === roleIndex ? { ...item, title: event.target.value } : item) }, `experience.${roleIndex}.title`)} className="trust-input border p-2 text-sm text-ink"/><input aria-label={`Edit company ${roleIndex + 1}`} defaultValue={role.company} onBlur={(event) => editVariant(variant, { ...variant.resume, experience: variant.resume.experience.map((item, index) => index === roleIndex ? { ...item, company: event.target.value } : item) }, `experience.${roleIndex}.company`)} className="trust-input border p-2 text-sm text-ink"/><input aria-label={`Edit dates ${roleIndex + 1}`} defaultValue={role.time} onBlur={(event) => editVariant(variant, { ...variant.resume, experience: variant.resume.experience.map((item, index) => index === roleIndex ? { ...item, time: event.target.value } : item) }, `experience.${roleIndex}.time`)} className="trust-input border p-2 text-sm text-ink"/></div><textarea aria-label={`Edit bullets ${roleIndex + 1}`} defaultValue={role.bullets.join("\n")} onBlur={(event) => editVariant(variant, { ...variant.resume, experience: variant.resume.experience.map((item, index) => index === roleIndex ? { ...item, bullets: valuesForEditor(event.target.value) } : item) }, `experience.${roleIndex}.bullets`)} rows={5} className="trust-input mt-2 w-full border p-2 text-sm text-ink"/></fieldset>)}<label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Education<textarea className="trust-input mt-1.5 w-full border p-3 text-sm text-ink" rows={3} defaultValue={variant.resume.education} onBlur={(event) => editVariant(variant, { ...variant.resume, education: event.target.value }, "education")} /></label><label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Section order<select value={variant.sectionOrder.join(",")} onChange={(event) => onUpdate({ ...pack, variants: pack.variants.map((item) => item.id === variant.id ? { ...item, sectionOrder: event.target.value.split(",") as ResumeVariant["sectionOrder"], userEdited: true } : item) })} className="trust-input mt-1.5 w-full border p-2 text-sm text-ink"><option value="summary,skills,experience,projects,education">ATS: summary, skills, experience, projects, education</option><option value="summary,projects,experience,skills,education">Recruiter: summary, projects, experience, skills, education</option><option value="summary,experience,projects,education,skills">Narrative: summary, experience, projects, education, skills</option></select></label><div className="mt-1 grid gap-2">{variant.evidenceReferences.map((ref) => <details key={`${variant.id}-${ref.claimPath}`} className="rounded border border-white/10 p-2 text-xs leading-5 text-paper/50"><summary><strong className="text-paper/70">{ref.claimPath}</strong> · {ref.supportType} · {ref.evidenceIds.length} source(s)</summary><p className="mt-1 text-paper/70">{ref.claimText}</p>{ref.evidenceIds.map((id) => <p key={id} className="mt-1 border-l-2 border-cyan/30 pl-2">{state.dossier.evidence.find((item) => item.id === id)?.detail ?? "Missing evidence"}</p>)}</details>)}</div></div>}
                {compareId === variant.id && previous && <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 md:grid-cols-2"><div><p className="lab-mono text-xs text-paper/45">Previous</p><p className="mt-1 text-sm text-paper/65">{previous.resume.summary}</p></div><div><p className="lab-mono text-xs text-gold">Current</p><p className="mt-1 text-sm text-paper/80">{variant.resume.summary}</p></div></div>}
              </article>;
            })}
          </div></div>;
        })}
      </div>
      <details className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><summary className="cursor-pointer text-sm font-bold text-paper">Generation receipt</summary><div className="mt-3 grid gap-2 text-sm text-paper/60 sm:grid-cols-2"><p>Evidence used: {pack.receipt.evidenceUsed.length}</p><p>Evidence omitted: {pack.receipt.evidenceOmitted.length}</p><p>Keywords included: {pack.receipt.keywordsIncluded.join(", ") || "None without evidence"}</p><p>Unsupported claims refused: {pack.receipt.unsupportedClaimsRefused.length}</p><p>Transferred claims: {pack.receipt.transferredClaims.length}</p><p>Gaps left unclaimed: {pack.receipt.gapsLeftUnclaimed.join(" · ") || "None"}</p></div></details>
    </section>
  );
}

export default function VersionsPage() {
  const { state, update, hydrated } = useCommandCenter();
  const router = useRouter();
  const [deletedLabel, setDeletedLabel] = useState<string | null>(null);
  const currentPack = useMemo(() => [...state.resumePacks].filter((pack) => pack.status !== "archived").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? [...state.resumePacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null, [state.resumePacks]);

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

  function updatePack(next: ResumePack) {
    update((current) => ({ ...current, resumePacks: current.resumePacks.map((pack) => pack.id === next.id ? next : pack) }));
  }

  function recordPackExport(filenames: string[]) {
    update((current) => ({ ...current, exports: [...current.exports, { id: `export-${Date.now().toString(36)}`, packId: currentPack?.id ?? "", formats: ["pdf", "docx"], filenames, exportedAt: new Date().toISOString() }] }));
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

        {hydrated && currentPack && <PackDashboard pack={currentPack} state={state} onUpdate={updatePack} onRecordExport={recordPackExport} />}

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
