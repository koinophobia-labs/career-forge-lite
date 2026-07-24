"use client";

import { useRef, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  backupFilename,
  buildPreview,
  createBackup,
  getLastBackupAt,
  markBackupCreated,
  validateBackup,
  type BackupPreview,
  type CommandCenterBackup
} from "@/lib/backup";
import { emptyBackupSidecars, type BackupSidecars } from "@/lib/backup-sidecars";
import { buildPilotSummary, pilotSummaryContainsContent } from "@/lib/pilot-metrics";
import { updateCommandCenter, useCommandCenter } from "@/lib/use-command-center";
import { emptyState, RECOVERY_KEY, STORAGE_KEY } from "@/lib/command-center-store";
import { LAST_BACKUP_KEY } from "@/lib/backup";
import {
  captureWorkspaceSidecars,
  clearWorkspaceSidecars,
  replaceWorkspaceSidecars
} from "@/lib/workspace-sidecars";
import type { CommandCenterState } from "@/types/command-center";

function formatDate(iso: string | null): string {
  if (!iso) return "unknown date";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? "unknown date"
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PreviewStats({ preview, context = "backup" }: { preview: BackupPreview; context?: "backup" | "current" }) {
  const rows: Array<[string, string]> = [
    ...(context === "backup"
      ? [["Exported", preview.exportedAt ? formatDate(preview.exportedAt) : "not recorded (older backup format)"] as [string, string]]
      : []),
    ["Profile", preview.profilePresent ? "present" : "empty"],
    ["Target lanes", String(preview.laneCount)],
    ["Applications", String(preview.applicationCount)],
    ["Role Sprints", String(preview.roleSprintCount)],
    ["Interview answer drafts", String(preview.interviewDraftCount)],
    ["Conversation interview", preview.interviewSessionPresent ? "present" : "empty"],
    ["Outreach contacts", String(preview.outreachCount)],
    ["Resume versions", `${preview.resumeVersionCount} (${preview.snapshotCount} with styled snapshots)`],
    ["Dossier evidence", String(preview.dossierEvidenceCount)],
    ["Résumé packs", String(preview.resumePackCount)],
    ["Export records", String(preview.exportCount)],
    ["Pending Truth Inbox reviews", String(preview.pendingImportReviewCount)]
  ];
  return (
    <dl className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2 text-sm">
          <dt className="lab-mono text-[0.68rem] font-bold uppercase text-paper/50">{label}:</dt>
          <dd className="text-paper/80">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function downloadJsonBackup(backup: CommandCenterBackup, filename: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SettingsPage() {
  const { state, hydrated } = useCommandCenter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ state: CommandCenterState; sidecars: BackupSidecars; preview: BackupPreview } | null>(null);
  const [rollbackBackup, setRollbackBackup] = useState<CommandCenterBackup | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [pilotConsent, setPilotConsent] = useState(false);
  const [pilotNotice, setPilotNotice] = useState<string | null>(null);

  function exportPilotSummary() {
    if (!pilotConsent) return;
    const summary = buildPilotSummary(state, new Date().toISOString());
    if (pilotSummaryContainsContent(summary)) {
      setPilotNotice("Export blocked: the summary unexpectedly contained content fields. Please report this.");
      return;
    }
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `career-forge-pilot-summary-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setPilotNotice("Saved. Open the file to review it before sharing.");
  }

  const lastBackup = lastBackupAt ?? (typeof window !== "undefined" ? getLastBackupAt() : null);
  const currentSidecars = hydrated && typeof window !== "undefined" ? captureWorkspaceSidecars() : emptyBackupSidecars();
  const currentPreview = buildPreview(state, null, null, currentSidecars);

  function exportBackup() {
    const backup = createBackup(state, undefined, captureWorkspaceSidecars());
    downloadJsonBackup(backup, backupFilename(backup.exportedAt));
    markBackupCreated(backup.exportedAt);
    setLastBackupAt(backup.exportedAt);
  }

  async function handleFile(file: File) {
    setImportError(null);
    setPendingImport(null);
    setRestoredAt(null);
    const text = await file.text();
    const result = validateBackup(text);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setPendingImport({ state: result.state, sidecars: result.sidecars, preview: result.preview });
  }

  function confirmRestore() {
    if (!pendingImport) return;
    const nowIso = new Date().toISOString();
    const rollback = createBackup(state, nowIso, captureWorkspaceSidecars());
    const rollbackStamp = nowIso.replace(/[:.]/g, "-");
    downloadJsonBackup(rollback, `career-forge-before-restore-${rollbackStamp}.json`);
    setRollbackBackup(rollback);

    // Sidecars are replaced before the command-center update so the rebuildable
    // activity index cannot override timestamps from the restored dataset.
    replaceWorkspaceSidecars(pendingImport.sidecars);
    updateCommandCenter(() => pendingImport.state);
    setPendingImport(null);
    setRestoredAt(new Date().toLocaleTimeString());
  }

  function undoRestore() {
    if (!rollbackBackup) return;
    replaceWorkspaceSidecars(rollbackBackup.sidecars);
    updateCommandCenter(() => rollbackBackup.state);
    setRollbackBackup(null);
    setRestoredAt(`${new Date().toLocaleTimeString()} (restore undone)`);
  }

  function clearLocalData() {
    clearWorkspaceSidecars();
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LAST_BACKUP_KEY);
    window.localStorage.removeItem(RECOVERY_KEY);
    updateCommandCenter(() => emptyState());
    setPendingImport(null);
    setRollbackBackup(null);
    setConfirmingClear(false);
  }

  return (
    <main>
      <CommandNav active="/settings" />

      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Data</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Backup &amp; restore</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Everything in Career Forge lives on this device — no account, no cloud. That’s private, but it also means a
          cleared browser erases months of work. Back up to a file you control; restore it here or on another machine.
        </p>

        <div className="trust-panel mt-8 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-paper">Create a backup</h2>
          <p className="mt-1 text-sm leading-6 text-paper/60">
            Downloads one JSON file containing your profile, evidence, applications, Role Sprints, interview drafts,
            conversation interview, outreach, and every résumé version including styled snapshots.
          </p>
          {hydrated && <PreviewStats preview={currentPreview} context="current" />}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={exportBackup}
              className="rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink transition hover:bg-cyan"
            >
              Download backup
            </button>
            {hydrated && (
              <span className="lab-mono text-xs text-paper/45">
                {lastBackup ? `Last backup: ${formatDate(lastBackup)}` : "No backup recorded yet"}
              </span>
            )}
          </div>
          <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs leading-5 text-paper/75">
            Backups contain your personal career data — work history, contacts, applications, and interview answers.
            Store the file somewhere private, and don’t share it or commit it to a public repo.
          </p>
        </div>

        <div className="trust-panel mt-6 p-5 sm:p-6" aria-labelledby="pilot-summary-title">
          <h2 id="pilot-summary-title" className="text-xl font-bold text-paper">Founding-user pilot summary</h2>
          <p className="mt-1 text-sm leading-6 text-paper/60">
            If you are part of the founding-user pilot, this exports a small JSON of timings and counts — how long
            setup took, how many facts you approved, how much you edited, what you exported. It contains{" "}
            <strong className="text-paper/85">no résumé content</strong>: no claims, names, employers, or document
            text. Nothing is sent anywhere; you review the file and share it yourself if you choose to.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-paper/75">
            <input
              type="checkbox"
              checked={pilotConsent}
              onChange={(event) => setPilotConsent(event.target.checked)}
              className="mt-1"
            />
            <span>I consent to generating this counts-and-timings summary for the pilot. I understand I will review the file before sharing it.</span>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={exportPilotSummary}
              disabled={!pilotConsent}
              className="rounded-md border border-cyan/40 bg-cyan/10 px-5 py-2.5 text-sm font-bold text-cyan transition hover:bg-cyan hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download pilot summary (no résumé content)
            </button>
            {pilotNotice && <span role="status" className="text-xs font-bold text-mint">{pilotNotice}</span>}
          </div>
        </div>

        <div className="trust-panel mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-paper">Restore from a backup</h2>
          <p className="mt-1 text-sm leading-6 text-paper/60">
            Pick a Career Forge backup file. You’ll see what’s inside before anything is written. Restoring replaces
            the current workspace and clears any temporary résumé handoff that was waiting from the old dataset.
          </p>
          <input
            ref={fileInputRef}
            aria-label="Restore backup file"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-md border border-cyan/40 bg-cyan/10 px-5 py-2.5 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold"
          >
            Choose backup file…
          </button>

          {importError && (
            <p className="mt-4 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm leading-6 text-paper/80">
              {importError}
            </p>
          )}

          {pendingImport && (
            <div className="mt-4 rounded-xl border border-cyan/30 bg-cyan/10 p-4">
              <p className="trust-kicker text-xs font-bold uppercase">Backup contents</p>
              <PreviewStats preview={pendingImport.preview} />
              <p className="mt-3 text-sm leading-6 text-paper/75">
                Restoring will <strong className="text-coral">replace</strong> the data currently on this device
                {hydrated
                  ? ` (${currentPreview.applicationCount} applications, ${currentPreview.roleSprintCount} Role Sprints, ${currentPreview.interviewDraftCount} interview drafts)`
                  : ""}
                . Career Forge will automatically download a pre-restore rollback file first.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmRestore}
                  className="rounded-md bg-coral px-4 py-2 text-sm font-black text-ink transition hover:bg-ember"
                >
                  Replace current data with this backup
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {restoredAt && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-spruce/50 bg-mint/10 px-3 py-2 text-sm leading-6 text-mint">
              <span>Backup restored at {restoredAt}. Every page is now reading the restored workspace.</span>
              {rollbackBackup && <button type="button" onClick={undoRestore} className="font-black underline underline-offset-2">Undo restore</button>}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-coral/30 bg-coral/5 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-paper">Clear local data</h2>
          <p className="mt-1 text-sm leading-6 text-paper/60">Use this only after downloading a backup. This removes the dossier, résumé packs, applications, Role Sprints, outreach, interview drafts, conversation interview, and temporary handoffs from this browser.</p>
          {confirmingClear ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={clearLocalData} className="rounded-md bg-coral px-4 py-2 text-sm font-black text-ink">Yes, clear all local Career Forge data</button><button type="button" onClick={() => setConfirmingClear(false)} className="rounded border border-white/20 px-4 py-2 text-sm text-paper/70">Cancel</button></div> : <button type="button" onClick={() => setConfirmingClear(true)} className="mt-4 rounded border border-coral/50 px-4 py-2 text-sm font-bold text-coral">Clear local data…</button>}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
