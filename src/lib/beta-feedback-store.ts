import { SAVE_ERROR_EVENT } from "@/lib/command-center-store";

// Lightweight beta-learning capture. Kept deliberately separate from the
// Command Center dossier: this is product feedback about the experience, never
// career evidence, and it must never contaminate anything that becomes a résumé
// claim. Persisted locally in the same layer as everything else (localStorage),
// so no account, server, or network is involved.
export const BETA_FEEDBACK_KEY = "career-forge-beta-feedback-v1";

export type BetaEasier = "yes" | "same" | "no";
export type BetaWouldUseAgain = "yes" | "maybe" | "no";

export type BetaFeedbackEntry = {
  version: 1;
  milestone: string;
  easier: BetaEasier;
  blocker: string;
  wouldUseAgain: BetaWouldUseAgain;
  testimonial: string;
  createdAt: string;
};

function isEntry(value: unknown): value is BetaFeedbackEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    entry.version === 1 &&
    typeof entry.milestone === "string" &&
    (entry.easier === "yes" || entry.easier === "same" || entry.easier === "no") &&
    (entry.wouldUseAgain === "yes" || entry.wouldUseAgain === "maybe" || entry.wouldUseAgain === "no") &&
    typeof entry.createdAt === "string"
  );
}

export function loadBetaFeedback(): BetaFeedbackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(BETA_FEEDBACK_KEY) ?? "null") as unknown;
    return Array.isArray(raw) ? raw.filter(isEntry) : [];
  } catch {
    return [];
  }
}

// True once the user has already given feedback for this milestone, so the
// prompt never nags a second time after value was delivered.
export function hasSubmittedBetaFeedback(milestone: string): boolean {
  return loadBetaFeedback().some((entry) => entry.milestone === milestone);
}

export function saveBetaFeedbackEntry(
  input: Omit<BetaFeedbackEntry, "version" | "createdAt"> & { createdAt?: string }
): boolean {
  if (typeof window === "undefined") return false;
  const entry: BetaFeedbackEntry = {
    version: 1,
    milestone: input.milestone,
    easier: input.easier,
    blocker: input.blocker.trim(),
    wouldUseAgain: input.wouldUseAgain,
    testimonial: input.testimonial.trim(),
    createdAt: input.createdAt ?? new Date().toISOString()
  };
  try {
    const next = [...loadBetaFeedback(), entry];
    window.localStorage.setItem(BETA_FEEDBACK_KEY, JSON.stringify(next));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent(SAVE_ERROR_EVENT));
    return false;
  }
}
