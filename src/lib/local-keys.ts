// One registry for every localStorage key Career Forge writes.
//
// "Clear local data" and "Replace current data with this backup" used to
// enumerate keys by hand, and both drifted: interview prep drafts, beta
// feedback, and application activity survived a clear the privacy page
// describes as removing every record, and survived a restore that swaps in a
// different person's dossier. A key that is not listed here is not cleared,
// so every module that persists something must register it here.
//
// The license key is the ONE deliberate exception: it is proof of a purchase
// on this device, not career data. Clearing it would destroy access the user
// paid for, so it is excluded by name and the UI says so.

import { APPLICATION_ACTIVITY_KEY } from "@/lib/application-activity";
import { LAST_BACKUP_KEY } from "@/lib/backup";
import { BETA_FEEDBACK_KEY } from "@/lib/beta-feedback-store";
import { RECOVERY_KEY, STORAGE_KEY } from "@/lib/command-center-store";
import { LICENSE_STORAGE_KEY } from "@/lib/entitlement";
import { PREP_DRAFT_KEY } from "@/lib/interview-prep";
import { INTERVIEW_SESSION_KEY } from "@/lib/interview-session-store";
import { HANDOFF_KEY } from "@/lib/tailor-handoff";

/**
 * "Put your name on your documents" dismissal, owned by /profile. It lives
 * here rather than in the page so clearing cannot miss it — a cleared device
 * should offer the callout again to whoever starts next.
 */
export const IDENTITY_CALLOUT_DISMISSED_KEY = "career-forge-identity-callout-dismissed-v1";

/** Career data written by this device. Cleared by "Clear local data". */
export const CAREER_DATA_KEYS = [
  STORAGE_KEY,
  RECOVERY_KEY,
  APPLICATION_ACTIVITY_KEY,
  BETA_FEEDBACK_KEY,
  PREP_DRAFT_KEY,
  INTERVIEW_SESSION_KEY,
  HANDOFF_KEY,
  LAST_BACKUP_KEY,
  IDENTITY_CALLOUT_DISMISSED_KEY
] as const;

/**
 * Keys holding a person's own words outside the command-center state. A
 * restore swaps identities, so these must not survive it — an interview
 * transcript or a practice answer about a termination belongs to whoever
 * typed it, not to whoever restores next.
 */
export const IDENTITY_BOUND_KEYS = [
  INTERVIEW_SESSION_KEY,
  PREP_DRAFT_KEY,
  BETA_FEEDBACK_KEY,
  APPLICATION_ACTIVITY_KEY,
  HANDOFF_KEY
] as const;

/** Excluded from clearing by design; stated in the settings UI. */
export const PRESERVED_KEYS = [LICENSE_STORAGE_KEY] as const;

export function clearCareerDataKeys(): void {
  if (typeof window === "undefined") return;
  for (const key of CAREER_DATA_KEYS) window.localStorage.removeItem(key);
}

export function clearIdentityBoundKeys(): void {
  if (typeof window === "undefined") return;
  for (const key of IDENTITY_BOUND_KEYS) window.localStorage.removeItem(key);
}
