import { createInitialInterviewSession } from "@/lib/interview-mode";
import type { InterviewSession } from "@/types/interview";

// Interview Mode conversations used to live only in component state, so a
// refresh destroyed the transcript, the draft, and the preview-answer count.
// Sessions now persist locally through the same external-store pattern the
// command center uses. "Start Over" remains an explicit, intentional reset.

export const INTERVIEW_SESSION_KEY = "career-forge-interview-session-v1";

// Sanity check, not a full revival: a session that fails these shape checks
// falls back to a fresh session — identical to the pre-persistence behavior.
function isPlausibleSession(raw: unknown): raw is InterviewSession {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const session = raw as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    Array.isArray(session.messages) &&
    session.messages.every(
      (message) =>
        message &&
        typeof message === "object" &&
        typeof (message as Record<string, unknown>).role === "string" &&
        typeof (message as Record<string, unknown>).content === "string"
    ) &&
    typeof session.currentStage === "string" &&
    Boolean(session.resumeDraft) &&
    typeof session.resumeDraft === "object" &&
    Boolean(session.memory) &&
    typeof session.memory === "object"
  );
}

export function loadInterviewSession(): InterviewSession {
  if (typeof window === "undefined") return createInitialInterviewSession();
  try {
    const serialized = window.localStorage.getItem(INTERVIEW_SESSION_KEY);
    if (!serialized) return createInitialInterviewSession();
    const raw = JSON.parse(serialized) as unknown;
    if (isPlausibleSession(raw)) return raw;
  } catch {
    // Fall through to a fresh session.
  }
  return createInitialInterviewSession();
}

export function saveInterviewSession(session: InterviewSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTERVIEW_SESSION_KEY, JSON.stringify(session));
  } catch {
    // A failed save keeps the in-memory session usable; the shared
    // command-center save-error banner covers the storage-full case.
  }
}

export function clearInterviewSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(INTERVIEW_SESSION_KEY);
}

// --- External store (mirrors use-command-center) ---------------------------

const listeners = new Set<() => void>();
let snapshot: InterviewSession | null = null;
let serverSnapshot: InterviewSession | null = null;

export function getInterviewSessionSnapshot(): InterviewSession {
  if (snapshot === null) snapshot = loadInterviewSession();
  return snapshot;
}

export function getInterviewSessionServerSnapshot(): InterviewSession {
  if (serverSnapshot === null) serverSnapshot = createInitialInterviewSession();
  return serverSnapshot;
}

export function subscribeInterviewSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setInterviewSession(session: InterviewSession): void {
  snapshot = session;
  saveInterviewSession(session);
  listeners.forEach((listener) => listener());
}

export function resetInterviewSession(): InterviewSession {
  clearInterviewSession();
  snapshot = createInitialInterviewSession();
  listeners.forEach((listener) => listener());
  return snapshot;
}
