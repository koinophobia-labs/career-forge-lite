import { APPLICATION_ACTIVITY_KEY } from "@/lib/application-activity";
import { emptyBackupSidecars, sanitizeBackupSidecars, sanitizeInterviewSession, type BackupSidecars } from "@/lib/backup-sidecars";
import {
  clearPrepDrafts,
  readPrepDraftMap,
  replacePrepDraftMap
} from "@/lib/interview-prep-drafts";
import {
  INTERVIEW_SESSION_KEY,
  resetInterviewSession,
  setInterviewSession
} from "@/lib/interview-session-store";
import { HANDOFF_KEY } from "@/lib/tailor-handoff";

export function captureWorkspaceSidecars(): BackupSidecars {
  if (typeof window === "undefined") return emptyBackupSidecars();
  let interviewSession = null;
  try {
    const serialized = window.localStorage.getItem(INTERVIEW_SESSION_KEY);
    interviewSession = serialized ? sanitizeInterviewSession(JSON.parse(serialized)) : null;
  } catch {
    interviewSession = null;
  }
  return {
    interviewPrepDrafts: readPrepDraftMap(),
    interviewSession
  };
}

/**
 * Dataset replacement boundary. Consume-once handoffs and the rebuildable
 * application activity index never cross it; interview work crosses only when
 * it was explicitly present in the backup.
 */
export function replaceWorkspaceSidecars(raw: unknown): BackupSidecars {
  const sidecars = sanitizeBackupSidecars(raw);
  if (typeof window === "undefined") return sidecars;

  window.localStorage.removeItem(HANDOFF_KEY);
  window.localStorage.removeItem(APPLICATION_ACTIVITY_KEY);
  replacePrepDraftMap(sidecars.interviewPrepDrafts);
  if (sidecars.interviewSession) setInterviewSession(sidecars.interviewSession);
  else resetInterviewSession();
  return sidecars;
}

export function clearWorkspaceSidecars(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HANDOFF_KEY);
  window.localStorage.removeItem(APPLICATION_ACTIVITY_KEY);
  clearPrepDrafts();
  resetInterviewSession();
}
