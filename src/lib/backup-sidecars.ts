import type { InterviewSession } from "@/types/interview";

export type BackupSidecars = {
  interviewPrepDrafts: Record<string, string>;
  interviewSession: InterviewSession | null;
};

export function emptyBackupSidecars(): BackupSidecars {
  return { interviewPrepDrafts: {}, interviewSession: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizePrepDraftMap(raw: unknown, limit = 300): Record<string, string> {
  if (!isRecord(raw)) return {};
  const entries = Object.entries(raw)
    .filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === "string" && Boolean(entry[1].trim()))
    .slice(-limit);
  return Object.fromEntries(entries);
}

export function sanitizeInterviewSession(raw: unknown): InterviewSession | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!Array.isArray(raw.messages) || !raw.messages.every((message) =>
    isRecord(message) &&
    typeof message.id === "string" &&
    (message.role === "assistant" || message.role === "user" || message.role === "system") &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string"
  )) return null;
  if (!isRecord(raw.resumeDraft) || !isRecord(raw.memory)) return null;
  if (!Array.isArray(raw.fieldStatuses) || !Array.isArray(raw.completedStages)) return null;
  if (typeof raw.currentStage !== "string" || typeof raw.createdAt !== "string" || typeof raw.updatedAt !== "string") return null;

  // The existing interview store performs the same structural trust check. Clone
  // the accepted value so restoring never keeps a reference to parsed input.
  return JSON.parse(JSON.stringify(raw)) as InterviewSession;
}

export function sanitizeBackupSidecars(raw: unknown): BackupSidecars {
  if (!isRecord(raw)) return emptyBackupSidecars();
  return {
    interviewPrepDrafts: sanitizePrepDraftMap(raw.interviewPrepDrafts),
    interviewSession: sanitizeInterviewSession(raw.interviewSession)
  };
}
