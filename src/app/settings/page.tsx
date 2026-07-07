"use client";

import { useMemo, useRef, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  backupFilename,
  buildPreview,
  createBackup,
  getLastBackupAt,
  markBackupCreated,
  validateBackup,
  type BackupPreview
} from "@/lib/backup";
import { updateCommandCenter, useCommandCenter } from "@/lib/use-command-center";
import type { CommandCenterState } from "@/types/command-center";

function formatDate(iso: string | null): string {
  if (!iso) return "unknown date";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? "unknown date"
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PreviewStats({ preview }: { preview: BackupPreview }) {
  const rows: Array<[string, string]> = [
    ["Exported", preview.exportedAt ? formatDate(preview.exportedAt) : "not recorded (legacy backup)"],
    ["Profile", preview.profilePresent ? "present" : "empty"],
    ["Target lanes", String(preview.laneCount)],
    ["Applications", String(preview.applicationCount)],
    ["Outreach contacts", String(preview.outreachCount)],
    ["Resume versions", `${preview.resumeVersionCount} (${preview.snapshotCount} with styled snapshots)`]
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

export default function SettingsPage() {
  const { state, hydrated } = useCommandCenter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ state: CommandCenterState; preview: BackupPreview } | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  // Read once per render on the client; hydration-gated below.
  const lastBackup = lastBackupAt ?? (typeof window !== "undefined" ? getLastBackupAt() : null);
  const currentPreview = useMemo(() => buildPreview(state, null, null), [state]);

  function exportBackup() {
    const backup = createBackup(state);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = backupFilename(backup.exportedAt);
    anchor.click();
    URL.revokeObjectURL(url);
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
    setPendingImport({ state: result.state, preview: result.preview });
  }

  function confirmRestore() {
    if (!pendingImport) return;
    // Replaces the live store atomically; every open page re-renders from the
    // restored state through the shared subscription.
    updateCommandCenter(() => pendingImport.state);
    setPendingImport(null);
    setRestoredAt(new Date().toLocaleTimeString());
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
            Downloads one JSON file containing your profile, lanes, applications, outreach, and every resume version
            including styled snapshots.
          </p>
          {hydrated && <PreviewStats preview={currentPreview} />}
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
            Backups contain your personal career data — work history, contacts, applications. Store the file somewhere
            private, and don’t share it or commit it to a public repo.
          </p>
        </div>

        <div className="trust-panel mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-paper">Restore from a backup</h2>
          <p className="mt-1 text-sm leading-6 text-paper/60">
            Pick a Career Forge backup file. You’ll see what’s inside before anything is written — restoring replaces
            the data currently on this device.
          </p>
          <input
            ref={fileInputRef}
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
                  ? ` (${currentPreview.applicationCount} applications, ${currentPreview.resumeVersionCount} resume versions)`
                  : ""}
                . If the current data matters, download a backup of it first.
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
            <p className="mt-4 rounded-lg border border-spruce/50 bg-mint/10 px-3 py-2 text-sm leading-6 text-mint">
              Backup restored at {restoredAt}. Every page is now reading the restored data — check the dashboard.
            </p>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
