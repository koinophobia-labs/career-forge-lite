import { emptyBackupSidecars, sanitizeBackupSidecars, type BackupSidecars } from "@/lib/backup-sidecars";
import { parseState } from "@/lib/command-center-store";
import type { ApplicationRecord, ApplicationStatus, CommandCenterState } from "@/types/command-center";

// Full workspace backup: everything Career Forge persists, including interview
// drafts and the conversational interview session, wrapped in a versioned file.
// Consume-once navigation handoffs are intentionally excluded.

export const BACKUP_SCHEMA_VERSION = 3;
export const LAST_BACKUP_KEY = "career-forge-last-backup-at";

export type CommandCenterBackup = {
  app: "career-forge";
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  state: CommandCenterState;
  sidecars: BackupSidecars;
};

export type BackupPreview = {
  exportedAt: string | null;
  schemaVersion: number | null;
  profilePresent: boolean;
  laneCount: number;
  applicationCount: number;
  outreachCount: number;
  resumeVersionCount: number;
  snapshotCount: number;
  dossierEvidenceCount: number;
  resumePackCount: number;
  exportCount: number;
  pendingImportReviewCount: number;
  roleSprintCount: number;
  interviewDraftCount: number;
  interviewSessionPresent: boolean;
};

export type BackupValidation =
  | { ok: true; state: CommandCenterState; sidecars: BackupSidecars; preview: BackupPreview }
  | { ok: false; error: string };

const applicationStatuses = new Set<ApplicationStatus>(["drafting", "applied", "interviewing", "offer", "rejected", "closed"]);

function restoreApplicationDurability(
  state: CommandCenterState,
  rawState: unknown
): CommandCenterState {
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) return state;
  const rawApplications = (rawState as { applications?: unknown }).applications;
  if (!Array.isArray(rawApplications)) return state;

  const byId = new Map(
    rawApplications
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === "string")
      .map((item) => [item.id as string, item])
  );

  return {
    ...state,
    applications: state.applications.map((application): ApplicationRecord => {
      const source = byId.get(application.id);
      if (!source) return application;
      const stageHistory = Array.isArray(source.stageHistory)
        ? source.stageHistory.flatMap((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
            const value = entry as Record<string, unknown>;
            if (typeof value.status !== "string" || !applicationStatuses.has(value.status as ApplicationStatus) || typeof value.at !== "string") return [];
            return [{ status: value.status as ApplicationStatus, at: value.at }];
          })
        : application.stageHistory;
      const interviewHistory = Array.isArray(source.interviewHistory)
        ? source.interviewHistory.filter((value): value is string => typeof value === "string")
        : application.interviewHistory;
      return {
        ...application,
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : application.updatedAt,
        stageHistory,
        interviewHistory,
        statusRevision: typeof source.statusRevision === "string" ? source.statusRevision : application.statusRevision
      };
    })
  };
}

function normalizeBackupState(rawState: unknown): CommandCenterState {
  const parsed = parseState(JSON.stringify(rawState));
  return restoreApplicationDurability(parsed, rawState);
}

export function createBackup(
  state: CommandCenterState,
  nowIso?: string,
  sidecars: BackupSidecars = emptyBackupSidecars()
): CommandCenterBackup {
  return {
    app: "career-forge",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: nowIso ?? new Date().toISOString(),
    state: normalizeBackupState(state),
    sidecars: sanitizeBackupSidecars(sidecars)
  };
}

export function backupFilename(nowIso?: string): string {
  const stamp = (nowIso ?? new Date().toISOString()).slice(0, 10);
  return `career-forge-backup-${stamp}.json`;
}

export function buildPreview(
  state: CommandCenterState,
  exportedAt: string | null,
  schemaVersion: number | null,
  sidecars: BackupSidecars = emptyBackupSidecars()
): BackupPreview {
  return {
    exportedAt,
    schemaVersion,
    profilePresent: Boolean(
      state.profile.currentSituation.trim() ||
        state.profile.experienceSummary.trim() ||
        state.profile.transferableSkills.length
    ),
    laneCount: state.lanes.length,
    applicationCount: state.applications.length,
    outreachCount: state.outreach.length,
    resumeVersionCount: state.resumeVersions.length,
    snapshotCount: state.resumeVersions.filter((version) => version.resumeSnapshot !== null).length,
    dossierEvidenceCount: state.dossier.evidence.length,
    resumePackCount: state.resumePacks.length,
    exportCount: state.exports.length,
    pendingImportReviewCount: state.pendingImportReviews.length,
    roleSprintCount: state.roleSprints.length,
    interviewDraftCount: Object.keys(sidecars.interviewPrepDrafts).length,
    interviewSessionPresent: Boolean(sidecars.interviewSession)
  };
}

// Validates a backup without touching live storage. Version 1–2 backups remain
// valid and simply restore with empty interview sidecars.
export function validateBackup(serialized: string): BackupValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(serialized);
  } catch {
    return { ok: false, error: "That file isn't valid JSON. Choose a Career Forge backup file (.json)." };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "That file doesn't look like a Career Forge backup — the top level isn't an object." };
  }

  const root = raw as Record<string, unknown>;

  if ("schemaVersion" in root || "app" in root) {
    if (root.app !== "career-forge") {
      return { ok: false, error: "This JSON file wasn't exported by Career Forge." };
    }
    if (typeof root.schemaVersion !== "number" || root.schemaVersion > BACKUP_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `This backup uses schema version ${String(root.schemaVersion)}, which is newer than this app understands. Update Career Forge, then import.`
      };
    }
    if (!root.state || typeof root.state !== "object" || Array.isArray(root.state)) {
      return { ok: false, error: "The backup's data section is missing or malformed." };
    }
    const state = normalizeBackupState(root.state);
    const sidecars = sanitizeBackupSidecars(root.sidecars);
    const exportedAt = typeof root.exportedAt === "string" ? root.exportedAt : null;
    return { ok: true, state, sidecars, preview: buildPreview(state, exportedAt, root.schemaVersion, sidecars) };
  }

  if ("profile" in root || "applications" in root || "resumeVersions" in root || "roleSprints" in root) {
    const state = normalizeBackupState(root);
    const sidecars = emptyBackupSidecars();
    return { ok: true, state, sidecars, preview: buildPreview(state, null, null, sidecars) };
  }

  return { ok: false, error: "That file doesn't contain Career Forge data." };
}

export function getLastBackupAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_BACKUP_KEY);
}

export function markBackupCreated(nowIso?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_BACKUP_KEY, nowIso ?? new Date().toISOString());
}

const BACKUP_NUDGE_DAYS = 14;

// Role Sprints represent concentrated work, so they count more heavily than
// lightweight tracker entries. This avoids nagging early users while protecting
// substantial practice and evidence libraries.
export function shouldNudgeBackup(state: CommandCenterState, lastBackupAt: string | null, nowIso: string): boolean {
  const approvedEvidence = state.dossier.evidence.filter((item) => item.approved && !item.rejected).length;
  const meaningfulAssets =
    state.applications.length +
    state.resumeVersions.length +
    state.resumePacks.length +
    state.roleSprints.length * 2 +
    state.outreach.length +
    state.pendingImportReviews.length +
    approvedEvidence;
  if (meaningfulAssets < 4) return false;
  if (!lastBackupAt) return true;
  const age = new Date(nowIso).getTime() - new Date(lastBackupAt).getTime();
  return Number.isNaN(age) || age > BACKUP_NUDGE_DAYS * 24 * 60 * 60 * 1000;
}
