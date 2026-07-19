"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { BetaFeedbackCard } from "@/components/BetaFeedbackCard";
import { ActivationPath } from "@/components/ActivationPath";
import { CommandNav } from "@/components/CommandNav";
import { EditConflictDialog } from "@/components/EditConflictDialog";
import { SiteFooter } from "@/components/SiteFooter";
import { deleteResumeVersion, loadState } from "@/lib/command-center-store";
import { fieldLabel, fieldValueAtPath, isFieldConflict, resumeWithFieldValue, type FieldConflict } from "@/lib/edit-conflicts";
import { LockedActionPill, LockedFeaturePanel } from "@/components/LockedFeature";
import { useEntitlement } from "@/lib/entitlement";
import { createPackBundle, createVariantFile, downloadBlob, exportSections, variantPlainText } from "@/lib/pack-export";
import { updatePackVariant } from "@/lib/resume-pack";
import { syncBuilderVersionsWithPack } from "@/lib/version-sync";
import { trackCareerEvent } from "@/lib/analytics";
import { variantPurpose } from "@/lib/activation";
import { deriveDefensibilityReceipt, uniqueUnclaimedReceiptItems } from "@/lib/defensibility";
import { handoffFromApplication, saveHandoff } from "@/lib/tailor-handoff";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationRecord, ResumeVersionRecord } from "@/types/command-center";
import type { ResumePack, ResumeVariant } from "@/types/dossier";

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
  const purpose = variantPurpose(version.source === "tailor" ? "job-specific" : version.label.toLowerCase().includes("recruiter") ? "recruiter" : "ats");

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
          onClick={() => trackCareerEvent("resume_variant_opened")}
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

      <p className="mt-3 rounded-lg border border-cyan/20 bg-cyan/5 px-3 py-2 text-xs leading-5 text-paper/65"><strong className="text-cyan">Use this for:</strong> {purpose.purpose}</p>

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

function IdentityGatePrompt({ compact }: { compact?: boolean }) {
  // Real explanation instead of a dead/blocked control: one field on the
  // dossier fixes every export at once, because documents read identity at
  // export time — no re-forge needed.
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Link href="/profile#identity" className="inline-flex min-h-11 items-center rounded-md border border-gold/50 bg-gold/10 px-4 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink">
        Add your name first → one field, 10 seconds
      </Link>
      {!compact && <span className="text-xs leading-5 text-paper/55">Exports are paused so you never send a résumé without your name on it. Documents pick up your name the moment you save it.</span>}
    </span>
  );
}

function PackDashboard({ pack, state, onUpdate, onRecordExport }: { pack: ResumePack; state: ReturnType<typeof useCommandCenter>["state"]; onUpdate: (next: ResumePack) => void; onRecordExport: (filenames: string[]) => void }) {
  const [working, setWorking] = useState(false);
  const [lastExportCount, setLastExportCount] = useState<number | null>(null);
  const [exportNotice, setExportNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [undoByVariant, setUndoByVariant] = useState<Record<string, ResumeVariant["resume"]>>({});
  const { hasFeature } = useEntitlement();
  // Building, reviewing, and editing stay free; taking documents out of the
  // app (copy/PDF/DOCX/bundle) is what a pack purchase unlocks.
  const exportsUnlocked = hasFeature("export_baseline_pack");
  // Documents bind identity at export time, so a missing name means every
  // file would ship headed "Résumé"/placeholder — block with an explanation.
  const identityMissing = !state.dossier.identity.fullName.trim();
  const uniqueUnclaimed = uniqueUnclaimedReceiptItems(pack.receipt);
  const defensibilityByVariant = new Map(pack.variants.map((variant) => [variant.id, deriveDefensibilityReceipt(variant, state.dossier)]));
  const packExportBlocked = [...defensibilityByVariant.values()].some((receipt) => receipt.missingProvenance > 0);

  async function exportBundle() {
    if (packExportBlocked || !exportsUnlocked || identityMissing) return;
    setWorking(true);
    try {
      const result = await createPackBundle(pack, state.dossier, state.lanes, ["pdf", "docx"]);
      downloadBlob(result.blob, result.filename);
      onRecordExport(result.filenames);
      setLastExportCount(result.filenames.length);
      setExportNotice({ tone: "ok", text: `Saved ${result.filename} to your downloads.` });
      trackCareerEvent("pack_bundle_exported");
      trackCareerEvent("full_pack_exported");
    } catch (error) {
      setExportNotice({ tone: "error", text: `Pack export failed${error instanceof Error ? `: ${error.message}` : ""}. Try exporting a single résumé, or copy its text.` });
    } finally { setWorking(false); }
  }

  async function exportVariant(variant: ResumeVariant, format: "pdf" | "docx") {
    if (!exportsUnlocked || identityMissing) return;
    if ((defensibilityByVariant.get(variant.id)?.missingProvenance ?? 1) > 0) return;
    const lane = state.lanes.find((item) => item.id === variant.laneId);
    try {
      const file = await createVariantFile(variant, state.dossier, lane?.title ?? "General", format);
      downloadBlob(file.blob, file.filename);
      // Downloads give no visible page feedback; confirm so the button never
      // reads as a silent no-op.
      setExportNotice({ tone: "ok", text: `Saved ${file.filename} to your downloads. Open it to review or print.` });
      trackCareerEvent("resume_exported");
    } catch (error) {
      setExportNotice({ tone: "error", text: `${format.toUpperCase()} export failed${error instanceof Error ? `: ${error.message}` : ""}. Try the other format, or copy the text instead.` });
    }
  }

  async function copyVariant(variant: ResumeVariant) {
    try {
      await navigator.clipboard.writeText(variantPlainText(state.dossier, variant.resume, variant.sectionOrder, variant.kind));
      setExportNotice({ tone: "ok", text: "Copied the complete document — header, summary, skills, experience, and education — in your chosen section order." });
    } catch {
      setExportNotice({ tone: "error", text: "Clipboard unavailable in this browser. Open View / edit and copy the text manually." });
    }
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
    // Rebase on the freshest stored pack so a commit from this tab never
    // clobbers another tab's concurrent edits to other variants or fields.
    const freshPack = loadState().resumePacks.find((item) => item.id === pack.id) ?? pack;
    onUpdate(updatePackVariant(freshPack, variant.id, resume, new Date().toISOString(), [path]));
  }

  // --- Same-field multi-tab conflict handling -------------------------------
  // Editor fields are uncontrolled drafts committed on blur, so a tab that
  // started from an older stored value could silently overwrite a newer edit
  // from another tab. captureBase records what this tab started from;
  // commitFieldEdit compares base vs current stored vs proposed at commit time
  // and opens an explicit keep-mine / keep-stored / merge dialog on conflict.
  // Unrelated-field edits still merge automatically through the store rebase.
  const editBaseRef = useRef<Record<string, string>>({});
  const [conflict, setConflict] = useState<FieldConflict | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);

  // The freshest stored variant, read straight from localStorage rather than
  // React state: a storage event from another tab may not have re-rendered
  // this component yet at the moment a blur commits.
  function freshestVariant(variantId: string): ResumeVariant | null {
    const stored = loadState().resumePacks.find((item) => item.id === pack.id);
    return stored?.variants.find((item) => item.id === variantId) ?? null;
  }

  function captureBase(variant: ResumeVariant, path: string, domValue: string) {
    const key = `${variant.id}:${path}`;
    // The DOM's value at first focus is what this tab's edit actually starts
    // from (canonicalized through the same serializer used at commit time).
    if (!(key in editBaseRef.current)) {
      editBaseRef.current[key] = fieldValueAtPath(resumeWithFieldValue(variant.resume, path, domValue), path);
    }
  }

  function commitFieldEdit(variant: ResumeVariant, path: string, rawValue: string) {
    const key = `${variant.id}:${path}`;
    const latest = freshestVariant(variant.id) ?? variant;
    const stored = fieldValueAtPath(latest.resume, path);
    const base = editBaseRef.current[key] ?? stored;
    delete editBaseRef.current[key];
    // Build on the freshest resume so committing one field can never
    // resurrect stale values in sibling fields.
    const nextResume = resumeWithFieldValue(latest.resume, path, rawValue);
    const proposed = fieldValueAtPath(nextResume, path);
    if (proposed === stored) return;
    if (isFieldConflict(base, stored, proposed)) {
      setConflict({ variantId: variant.id, path, label: fieldLabel(path), base, mine: proposed, stored });
      return;
    }
    editVariant(latest, nextResume, path);
  }

  function resolveConflict(chosen: string | null) {
    if (!conflict) return;
    if (chosen !== null) {
      const latest = freshestVariant(conflict.variantId) ?? pack.variants.find((item) => item.id === conflict.variantId);
      if (latest) editVariant(latest, resumeWithFieldValue(latest.resume, conflict.path, chosen), conflict.path);
    }
    setConflict(null);
    // Remount the editor so uncontrolled fields re-read the committed value.
    setEditorEpoch((epoch) => epoch + 1);
  }

  function undoLatest(variant: ResumeVariant) {
    const previous = undoByVariant[variant.id];
    if (!previous) return;
    onUpdate(updatePackVariant(pack, variant.id, previous, new Date().toISOString(), ["undo"]));
    setUndoByVariant((current) => { const next = { ...current }; delete next[variant.id]; return next; });
  }

  return (
    <section className="trust-panel mt-8 overflow-hidden p-5 sm:p-6" aria-labelledby="pack-ready-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="trust-kicker text-xs font-bold uppercase">{packExportBlocked ? "Evidence integrity changed" : "Generation complete"}</p><h2 id="pack-ready-title" className="mt-2 text-3xl font-bold text-paper">{packExportBlocked ? "Your Résumé Pack needs evidence review." : "Your Résumé Pack is ready."}</h2><p className="mt-2 text-sm text-paper/65">{pack.lanePacks.length} active lane{pack.lanePacks.length === 1 ? "" : "s"} · {pack.variants.length} generated résumés · {pack.receipt.evidenceUsed.length} evidence items in the original generation receipt · {uniqueUnclaimed.length} unique gaps or unsupported claims left unclaimed</p>{packExportBlocked && <p className="mt-2 text-sm font-bold text-coral">A cited source is missing, rejected, or incomplete. Review dossier evidence and regenerate before tailoring or export.</p>}</div>
        <div className="flex flex-wrap gap-2">{packExportBlocked ? <Link href="/profile" className="inline-flex min-h-11 items-center rounded border border-coral/45 px-5 py-2.5 text-sm font-bold text-coral">Review dossier evidence →</Link> : <Link href="/tailor" className="lab-pill-button inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-black">Tailor a résumé to a real job →</Link>}{!exportsUnlocked ? <LockedActionPill feature="export_baseline_pack" label="Export complete pack" /> : identityMissing ? <IdentityGatePrompt /> : <button type="button" onClick={exportBundle} disabled={working || packExportBlocked} title={packExportBlocked ? "Restore every cited source before exporting this pack." : undefined} className="min-h-11 rounded-md border border-gold/45 bg-gold/10 px-4 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-50">{working ? "Building ZIP…" : "Export complete pack"}</button>}{lastExportCount !== null && <p className="w-full text-xs font-bold text-mint">Bundle prepared with {lastExportCount} résumé files plus LinkedIn materials and a README.</p>}{exportNotice && <p role="status" aria-live="polite" className={`w-full text-xs font-bold ${exportNotice.tone === "ok" ? "text-mint" : "text-coral"}`}>{exportNotice.text}</p>}</div>
      </div>
      {!exportsUnlocked && (
        <div className="mt-5">
          <LockedFeaturePanel
            feature="export_baseline_pack"
            title="Your pack is built — unlock it to use it."
            description="Everything below is generated from your approved evidence and free to review and edit. A one-time pack unlocks copying, PDF and DOCX export, and the complete ZIP bundle with your LinkedIn materials."
          />
        </div>
      )}
      <div className="mt-5 grid gap-5">
        {pack.lanePacks.map((lanePack) => {
          const lane = state.lanes.find((item) => item.id === lanePack.laneId);
          const variants = pack.variants.filter((item) => item.laneId === lanePack.laneId);
          return <div key={lanePack.laneId} className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><h3 className="text-lg font-bold text-paper">{lane?.title ?? "Lane"}</h3><p className="mt-1 text-sm leading-5 text-paper/55">{lanePack.positioningPitch}</p><div className="mt-3 grid gap-3">
            {variants.map((variant) => {
              const previous = state.resumePacks.flatMap((item) => item.variants).filter((item) => item.id !== variant.id && item.laneId === variant.laneId && item.kind === variant.kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              const purpose = variantPurpose(variant.kind);
              const defensibility = defensibilityByVariant.get(variant.id)!;
              const exportBlocked = defensibility.missingProvenance > 0;
              const tracedClaimCount = defensibility.directlySupported + defensibility.combinedEvidence + defensibility.transferred;
              const withheldFacts = exportSections(variant.resume, variant.sectionOrder, variant.kind).withheldFacts;
              return <article key={variant.id} className="rounded-lg border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap items-center gap-2"><div className="mr-auto"><p className="font-bold text-paper">{purpose.label} · {lane?.title ?? "Lane"}</p><p className="lab-mono mt-1 text-[0.62rem] font-bold uppercase text-paper/45">{variant.status.replace("-", " ")} · {tracedClaimCount} fully traced claims{variant.userEdited ? " · user edited" : ""}</p></div><button type="button" onClick={() => { setEditingId(editingId === variant.id ? null : variant.id); if (editingId !== variant.id) trackCareerEvent("resume_variant_opened"); }} className="min-h-11 rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">{editingId === variant.id ? "Close" : "View / edit"}</button>{!exportsUnlocked ? <LockedActionPill feature="export_baseline_pack" label="Copy / PDF / DOCX" /> : identityMissing ? <IdentityGatePrompt compact /> : <><button type="button" disabled={exportBlocked} title={exportBlocked ? "Restore every cited source before copying." : undefined} onClick={() => void copyVariant(variant)} className="min-h-11 rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70 disabled:cursor-not-allowed disabled:opacity-40">Copy</button><button type="button" disabled={exportBlocked} title={exportBlocked ? "Restore every cited source before exporting." : undefined} onClick={() => void exportVariant(variant, "pdf")} className="min-h-11 rounded-full border border-cyan/30 px-3 py-1.5 text-xs text-cyan disabled:cursor-not-allowed disabled:opacity-40">Print / PDF</button><button type="button" disabled={exportBlocked} title={exportBlocked ? "Restore every cited source before exporting." : undefined} onClick={() => void exportVariant(variant, "docx")} className="min-h-11 rounded-full border border-cyan/30 px-3 py-1.5 text-xs text-cyan disabled:cursor-not-allowed disabled:opacity-40">DOCX</button></>}<button type="button" onClick={() => duplicate(variant)} className="min-h-11 rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Duplicate</button><button type="button" onClick={() => rename(variant)} className="min-h-11 rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Rename</button><button type="button" onClick={() => markCanonical(variant)} className="min-h-11 rounded-full border border-gold/30 px-3 py-1.5 text-xs text-gold">{variant.canonical ? "Baseline" : "Make baseline"}</button>{previous && <button type="button" onClick={() => setCompareId(compareId === variant.id ? null : variant.id)} className="min-h-11 rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper/70">Compare</button>}<button type="button" onClick={() => remove(variant)} className="min-h-11 rounded-full border border-coral/25 px-3 py-1.5 text-xs text-coral">Delete</button></div><div className="mt-3 grid gap-2 rounded-lg border border-cyan/20 bg-cyan/5 p-3 text-xs leading-5 text-paper/65"><p><strong className="text-cyan">Use this for:</strong> {purpose.purpose}</p><p><strong className="text-gold">Why it differs:</strong> {purpose.difference}</p>{withheldFacts.length > 0 && <p className="font-bold text-gold">{withheldFacts.length} fact{withheldFacts.length === 1 ? "" : "s"} withheld ({withheldFacts.join(", ")}) — deliberately kept out of every copy and export.</p>}</div><details onClick={(event) => { if ((event.target as HTMLElement).tagName === "SUMMARY") trackCareerEvent("defensibility_receipt_opened"); }} className="mt-3 rounded-lg border border-white/12 bg-obsidian/35 p-3"><summary className="cursor-pointer text-xs font-bold text-paper"><span className={defensibility.status.includes("review") || defensibility.status.includes("recheck") ? "text-coral" : "text-mint"}>{defensibility.status}</span> · Open Defensibility Receipt</summary><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-paper/60 sm:grid-cols-3"><p>Total claims: {defensibility.totalClaims}</p><p>Direct: {defensibility.directlySupported}</p><p>Combined: {defensibility.combinedEvidence}</p><p>Transferred: {defensibility.transferred}</p><p>Missing provenance: {defensibility.missingProvenance}</p><p>Incomplete cited sources: {defensibility.incompleteProvenance}</p><p>Verified durations: {defensibility.verifiedDurations}</p><p>Unverified durations: {defensibility.unverifiedDurations}</p><p>User edits to recheck: {defensibility.userEditedClaimsNeedingReview}</p></div></details>
                {editingId === variant.id && <div key={`editor-${variant.id}-${editorEpoch}`} className="mt-3 grid gap-4 border-t border-white/10 pt-3"><div className="flex items-center justify-between"><p className="lab-mono text-[0.65rem] font-bold uppercase text-gold">Full document editor</p>{undoByVariant[variant.id] && <button type="button" onClick={() => undoLatest(variant)} className="rounded border border-gold/40 px-3 py-1 text-xs font-bold text-gold">Undo latest edit</button>}</div><label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Summary<textarea className="trust-input mt-1.5 w-full border p-3 text-sm text-ink" rows={5} defaultValue={variant.resume.summary} onFocus={(event) => captureBase(variant, "summary", event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, "summary", event.target.value)} /></label><label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Skills<textarea className="trust-input mt-1.5 w-full border p-3 text-sm text-ink" rows={4} defaultValue={variant.resume.coreSkills.join("\n")} onFocus={(event) => captureBase(variant, "coreSkills", event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, "coreSkills", event.target.value)} /></label>{variant.resume.experience.map((role, roleIndex) => <fieldset key={`${variant.id}-role-${roleIndex}`} className="rounded-lg border border-white/10 p-3"><legend className="px-2 text-xs font-bold uppercase text-paper/50">Role or project {roleIndex + 1}</legend><div className="grid gap-2 sm:grid-cols-3"><input aria-label={`Edit heading ${roleIndex + 1}`} defaultValue={role.title} onFocus={(event) => captureBase(variant, `experience.${roleIndex}.title`, event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, `experience.${roleIndex}.title`, event.target.value)} className="trust-input border p-2 text-sm text-ink"/><input aria-label={`Edit company ${roleIndex + 1}`} defaultValue={role.company} onFocus={(event) => captureBase(variant, `experience.${roleIndex}.company`, event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, `experience.${roleIndex}.company`, event.target.value)} className="trust-input border p-2 text-sm text-ink"/><input aria-label={`Edit dates ${roleIndex + 1}`} defaultValue={role.time} onFocus={(event) => captureBase(variant, `experience.${roleIndex}.time`, event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, `experience.${roleIndex}.time`, event.target.value)} className="trust-input border p-2 text-sm text-ink"/></div><textarea aria-label={`Edit bullets ${roleIndex + 1}`} defaultValue={role.bullets.join("\n")} onFocus={(event) => captureBase(variant, `experience.${roleIndex}.bullets`, event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, `experience.${roleIndex}.bullets`, event.target.value)} rows={5} className="trust-input mt-2 w-full border p-2 text-sm text-ink"/></fieldset>)}<label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Education<textarea className="trust-input mt-1.5 w-full border p-3 text-sm text-ink" rows={3} defaultValue={variant.resume.education} onFocus={(event) => captureBase(variant, "education", event.currentTarget.value)} onBlur={(event) => commitFieldEdit(variant, "education", event.target.value)} /></label><label className="lab-mono text-[0.65rem] font-bold uppercase text-paper/60">Section order<select value={variant.sectionOrder.join(",")} onChange={(event) => onUpdate({ ...pack, variants: pack.variants.map((item) => item.id === variant.id ? { ...item, sectionOrder: event.target.value.split(",") as ResumeVariant["sectionOrder"], userEdited: true } : item) })} className="trust-input mt-1.5 w-full border p-2 text-sm text-ink"><option value="summary,skills,experience,projects,education">ATS: summary, skills, experience, projects, education</option><option value="summary,projects,experience,skills,education">Recruiter: summary, projects, experience, skills, education</option><option value="summary,experience,projects,education,skills">Narrative: summary, experience, projects, education, skills</option></select></label><div className="mt-1 grid gap-2">{variant.evidenceReferences.map((ref) => <details key={`${variant.id}-${ref.claimPath}`} className="rounded border border-white/10 p-2 text-xs leading-5 text-paper/50"><summary><strong className="text-paper/70">{ref.claimPath}</strong> · {ref.supportType} · {ref.evidenceIds.length} source(s)</summary><p className="mt-1 text-paper/70">{ref.claimText}</p>{ref.evidenceIds.map((id) => <p key={id} className="mt-1 border-l-2 border-cyan/30 pl-2">{state.dossier.evidence.find((item) => item.id === id)?.detail ?? "Missing evidence"}</p>)}</details>)}</div></div>}
                {compareId === variant.id && previous && <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 md:grid-cols-2"><div><p className="lab-mono text-xs text-paper/45">Previous</p><p className="mt-1 text-sm text-paper/65">{previous.resume.summary}</p></div><div><p className="lab-mono text-xs text-gold">Current</p><p className="mt-1 text-sm text-paper/80">{variant.resume.summary}</p></div></div>}
              </article>;
            })}
          </div></div>;
        })}
      </div>
      <details onClick={(event) => { if ((event.target as HTMLElement).tagName === "SUMMARY") trackCareerEvent("defensibility_receipt_opened"); }} className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><summary className="cursor-pointer text-sm font-bold text-paper">Open pack-level evidence receipt</summary><div className="mt-3 grid gap-4 text-sm text-paper/60 sm:grid-cols-2"><p>Evidence used: {pack.receipt.evidenceUsed.length}</p><p>Evidence omitted: {pack.receipt.evidenceOmitted.length}</p><p>Keywords included: {pack.receipt.keywordsIncluded.join(", ") || "None without evidence"}</p><p>Claims transferred from related experience: {pack.receipt.transferredClaims.length}</p><div><p className="font-bold text-gold">Known evidence gaps</p><p className="mt-1">{pack.receipt.gapsLeftUnclaimed.join(" · ") || "None"}</p></div>{pack.receipt.unsupportedClaimsRefused.length > 0 && <div><p className="font-bold text-coral">Claims Career Forge refused to generate</p><p className="mt-1">{pack.receipt.unsupportedClaimsRefused.join(" · ")}</p></div>}</div></details>
      {conflict && (
        <EditConflictDialog
          conflict={conflict}
          onKeepMine={() => resolveConflict(conflict.mine)}
          onKeepStored={() => resolveConflict(null)}
          onMerge={(merged) => resolveConflict(merged)}
        />
      )}
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
    update((current) => ({
      ...current,
      resumePacks: current.resumePacks.map((pack) => pack.id === next.id ? next : pack),
      resumeVersions: syncBuilderVersionsWithPack(current, next)
    }));
  }

  function recordPackExport(filenames: string[]) {
    update((current) => ({ ...current, exports: [...current.exports, { id: `export-${Date.now().toString(36)}`, packId: currentPack?.id ?? "", formats: ["pdf", "docx"], filenames, exportedAt: new Date().toISOString() }] }));
  }

  return (
    <main>
      <CommandNav active="/versions" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 4 · Résumé Pack</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Every version, and why it exists.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Each generated resume is saved here with its full text, the job it was built for, the keywords it used, and
          the gaps it refused to claim. Copy a version for an application, reopen an old angle, or clear out drafts.
        </p>

        {hydrated && <div className="mt-8"><ActivationPath state={state} compact /></div>}

        {hydrated && currentPack && <PackDashboard pack={currentPack} state={state} onUpdate={updatePack} onRecordExport={recordPackExport} />}
        {hydrated && currentPack && currentPack.variants.length > 0 && <div className="mt-4"><BetaFeedbackCard milestone="pack" /></div>}

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
