import type { ApplicationRecord } from "@/types/command-center";

const JOB_TEXT_PREFIX = "career-forge-job-text:v1:";

// ApplicationRecord already has a durable, backed-up jobPostUrl field that was
// unused by the current UI. Store pasted posting text there with an explicit
// prefix while keeping discoveryUrl/applicationUrl reserved for real links.
export function encodeJobPostText(jobPost: string): string {
  const trimmed = jobPost.trim();
  return trimmed ? `${JOB_TEXT_PREFIX}${encodeURIComponent(trimmed)}` : "";
}

export function decodeJobPostText(value: string): string {
  if (!value.startsWith(JOB_TEXT_PREFIX)) return "";
  try {
    return decodeURIComponent(value.slice(JOB_TEXT_PREFIX.length));
  } catch {
    return "";
  }
}

export function applicationJobPost(application: ApplicationRecord): string {
  return decodeJobPostText(application.jobPostUrl);
}

export function hasSavedJobWorkspace(application: ApplicationRecord): boolean {
  return Boolean(applicationJobPost(application));
}

export function normalizeJobPostText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable, synchronous FNV-1a fingerprint for local job-post comparisons. */
export function jobPostFingerprint(value: string): string {
  const normalized = normalizeJobPostText(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * A full paste over a saved posting is a new workspace even when both jobs use
 * the same title on line one. Small manual edits remain attached to the job.
 */
export function isLikelyNewJobPost(
  currentPost: string,
  nextPost: string,
  inputType = ""
): boolean {
  const current = normalizeJobPostText(currentPost);
  const next = normalizeJobPostText(nextPost);
  if (!current || !next || current === next) return false;

  const pasted = inputType === "insertFromPaste" || inputType === "insertFromDrop";
  if (pasted && jobPostFingerprint(current) !== jobPostFingerprint(next)) return true;

  const lengthShift = Math.abs(next.length - current.length) / Math.max(current.length, 1);
  const prefixLength = Math.min(120, current.length, next.length);
  const prefixChanged = current.slice(0, prefixLength) !== next.slice(0, prefixLength);
  return lengthShift > 0.35 && prefixChanged;
}
