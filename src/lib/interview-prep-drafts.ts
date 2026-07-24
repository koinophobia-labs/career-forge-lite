import { sanitizePrepDraftMap } from "@/lib/backup-sidecars";

export const PREP_DRAFT_KEY = "career-forge-prep-drafts-v2";
export const LEGACY_PREP_DRAFT_KEY = "career-forge-prep-drafts-v1";

export type PrepDraftScope = {
  applicationId: string | null;
  laneId: string | null;
  questionId: string;
  question: string;
};

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function prepDraftKey(scope: PrepDraftScope): string {
  return [
    scope.applicationId ?? "no-application",
    scope.laneId ?? "no-lane",
    scope.questionId,
    stableHash(scope.question.trim())
  ].map((part) => encodeURIComponent(part)).join("::");
}

export function readPrepDraftMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREP_DRAFT_KEY) ?? "{}");
    return sanitizePrepDraftMap(raw);
  } catch {
    return {};
  }
}

export function replacePrepDraftMap(raw: unknown): void {
  if (typeof window === "undefined") return;
  const drafts = sanitizePrepDraftMap(raw);
  window.localStorage.removeItem(LEGACY_PREP_DRAFT_KEY);
  if (Object.keys(drafts).length) window.localStorage.setItem(PREP_DRAFT_KEY, JSON.stringify(drafts));
  else window.localStorage.removeItem(PREP_DRAFT_KEY);
}

export function clearPrepDrafts(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREP_DRAFT_KEY);
  window.localStorage.removeItem(LEGACY_PREP_DRAFT_KEY);
}

export function loadPrepDraft(key: string): string {
  return readPrepDraftMap()[key] ?? "";
}

export function savePrepDraft(key: string, draft: string): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = readPrepDraftMap();
    if (draft.trim()) drafts[key] = draft;
    else delete drafts[key];
    const trimmed = sanitizePrepDraftMap(drafts);
    if (Object.keys(trimmed).length) window.localStorage.setItem(PREP_DRAFT_KEY, JSON.stringify(trimmed));
    else window.localStorage.removeItem(PREP_DRAFT_KEY);
  } catch {
    // Keep the textarea usable even when local storage is unavailable.
  }
}
