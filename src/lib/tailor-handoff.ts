import { createId } from "@/lib/command-center-store";
import type { JobPostAnalysis } from "@/lib/job-post-analyzer";
import type { ApplicationRecord, CommandCenterState, ResumeSnapshot, TargetLane } from "@/types/command-center";

// The handoff carries a tailoring session from /tailor into /resume-builder.
// It's a consume-once localStorage blob with a TTL: written when the user
// clicks "Build the resume for this shot", read (and removed) when the
// builder mounts. Stale or malformed blobs are ignored — the builder just
// behaves normally.

export const HANDOFF_KEY = "career-forge-tailor-handoff-v1";
export const HANDOFF_TTL_MS = 60 * 60 * 1000; // 1 hour

export type TailorHandoff = {
  version: 1;
  createdAt: string;
  applicationId: string | null;
  baselineVariantId?: string | null;
  company: string;
  roleTitle: string;
  laneId: string | null;
  laneTitle: string | null;
  resumeAngle: string;
  keywords: string[];
  coveredRequirements: string[];
  partialRequirements: string[];
  gaps: string[];
  weakSpots: string[];
  bulletPrompts: string[];
};

// Everything in the handoff is copied verbatim from the analysis, the lane the
// user chose, and what they typed — nothing is synthesized here, so nothing
// can be invented.
export function buildHandoff(options: {
  analysis: JobPostAnalysis;
  lane: TargetLane | null;
  company: string;
  roleTitle: string;
  applicationId: string | null;
  baselineVariantId?: string | null;
  nowIso?: string;
}): TailorHandoff {
  const { analysis, lane, company, roleTitle, applicationId } = options;
  const byStatus = (status: "covered" | "partial" | "gap") =>
    analysis.requirements.filter((req) => req.status === status).map((req) => req.requirement);

  return {
    version: 1,
    createdAt: options.nowIso ?? new Date().toISOString(),
    applicationId,
    baselineVariantId: options.baselineVariantId ?? null,
    company: company.trim(),
    roleTitle: roleTitle.trim() || lane?.title || "",
    laneId: lane?.id ?? null,
    laneTitle: lane?.title ?? null,
    resumeAngle: lane?.resumeAngle ?? "",
    keywords: analysis.keywords.map((hit) => hit.term),
    coveredRequirements: byStatus("covered"),
    partialRequirements: byStatus("partial"),
    gaps: byStatus("gap"),
    weakSpots: [...analysis.weakSpots],
    bulletPrompts: analysis.bulletSuggestions.map((item) => item.suggestion)
  };
}

// Rebuilds a handoff from an application's stored analysis summary, so a
// tailored resume session can be restarted later without re-pasting the job
// post. Covered/partial splits weren't persisted, so they stay empty; every
// field is copied verbatim from what the user already saved.
export function handoffFromApplication(
  application: ApplicationRecord,
  lane: TargetLane | null,
  nowIso?: string
): TailorHandoff {
  return {
    version: 1,
    createdAt: nowIso ?? new Date().toISOString(),
    applicationId: application.id,
    baselineVariantId: null,
    company: application.company === "Unknown company" ? "" : application.company,
    roleTitle: application.roleTitle === "Untitled role" ? (lane?.title ?? "") : application.roleTitle,
    laneId: lane?.id ?? application.laneId,
    laneTitle: lane?.title ?? null,
    resumeAngle: lane?.resumeAngle ?? "",
    keywords: [...application.analysisKeywords],
    coveredRequirements: [],
    partialRequirements: [],
    gaps: [...application.analysisGaps],
    weakSpots: [...application.analysisWeakSpots],
    bulletPrompts: []
  };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parseHandoff(serialized: string | null, nowIso: string): TailorHandoff | null {
  if (!serialized) return null;
  try {
    const raw = JSON.parse(serialized) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || raw.version !== 1) return null;

    const createdAt = asString(raw.createdAt);
    if (!createdAt) return null;
    const age = new Date(nowIso).getTime() - new Date(createdAt).getTime();
    if (Number.isNaN(age) || age < 0 || age > HANDOFF_TTL_MS) return null;

    const roleTitle = asString(raw.roleTitle);
    if (!roleTitle.trim()) return null;

    return {
      version: 1,
      createdAt,
      applicationId: asStringOrNull(raw.applicationId),
      baselineVariantId: asStringOrNull(raw.baselineVariantId),
      company: asString(raw.company),
      roleTitle,
      laneId: asStringOrNull(raw.laneId),
      laneTitle: asStringOrNull(raw.laneTitle),
      resumeAngle: asString(raw.resumeAngle),
      keywords: asStringArray(raw.keywords),
      coveredRequirements: asStringArray(raw.coveredRequirements),
      partialRequirements: asStringArray(raw.partialRequirements),
      gaps: asStringArray(raw.gaps),
      weakSpots: asStringArray(raw.weakSpots),
      bulletPrompts: asStringArray(raw.bulletPrompts)
    };
  } catch {
    return null;
  }
}

export function saveHandoff(handoff: TailorHandoff): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
}

// Consume-once: reading removes the blob so a later, unrelated visit to the
// builder starts clean.
export function consumeHandoff(nowIso: string): TailorHandoff | null {
  if (typeof window === "undefined") return null;
  const serialized = window.localStorage.getItem(HANDOFF_KEY);
  if (serialized !== null) window.localStorage.removeItem(HANDOFF_KEY);
  return parseHandoff(serialized, nowIso);
}

// Records a tailored resume version and links it back to the source
// application via resumeVersionId. Pure: takes and returns state.
export function recordTailoredResumeVersion(
  state: CommandCenterState,
  handoff: TailorHandoff,
  nowIso: string,
  influenceSummary = "",
  resumeText = "",
  resumeSnapshot: ResumeSnapshot | null = null
): CommandCenterState {
  const versionId = createId("resume");
  const target = handoff.company ? `${handoff.roleTitle} @ ${handoff.company}` : handoff.roleTitle;

  const version = {
    id: versionId,
    label: `${target} — ${nowIso.slice(0, 10)}`,
    laneId: handoff.laneId,
    notes: `Tailored from job-post analysis${handoff.laneTitle ? ` (${handoff.laneTitle} lane)` : ""}.`,
    source: "tailor" as const,
    applicationId: handoff.applicationId,
    dossierId: state.dossier?.id,
    baselineVariantId: handoff.baselineVariantId ?? null,
    jobPostAnalysisId: handoff.applicationId ? `analysis-${handoff.applicationId}` : `analysis-${handoff.createdAt}`,
    targetCompany: handoff.company,
    targetTitle: handoff.roleTitle,
    keywordsUsed: handoff.keywords,
    gapsAcknowledged: handoff.gaps,
    influenceSummary,
    resumeText,
    resumeSnapshot,
    createdAt: nowIso
  };

  return {
    ...state,
    resumeVersions: [...state.resumeVersions, version],
    applications: handoff.applicationId
      ? state.applications.map((app) => (app.id === handoff.applicationId ? { ...app, resumeVersionId: versionId } : app))
      : state.applications
  };
}
