import type {
  ApplicationRecord,
  CareerProfile,
  CommandCenterState,
  OutreachContact,
  ResumeSnapshot,
  ResumeVersionRecord,
  TargetLane
} from "@/types/command-center";

export const STORAGE_KEY = "career-forge-command-center-v1";

export function emptyProfile(): CareerProfile {
  return {
    currentSituation: "",
    targetRoles: "",
    transferableSkills: [],
    experienceSummary: "",
    strengths: [],
    constraints: "",
    workStyle: "",
    proofPoints: "",
    updatedAt: null
  };
}

export function emptyState(): CommandCenterState {
  return {
    version: 1,
    profile: emptyProfile(),
    lanes: [],
    applications: [],
    outreach: [],
    resumeVersions: []
  };
}

export function isProfileStarted(profile: CareerProfile): boolean {
  return Boolean(
    profile.currentSituation.trim() ||
      profile.targetRoles.trim() ||
      profile.transferableSkills.length ||
      profile.experienceSummary.trim() ||
      profile.strengths.length
  );
}

export function isProfileComplete(profile: CareerProfile): boolean {
  return Boolean(
    profile.currentSituation.trim() &&
      profile.targetRoles.trim() &&
      profile.transferableSkills.length >= 3 &&
      profile.experienceSummary.trim()
  );
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

// Timestamp arrays additionally drop entries that aren't parseable dates, so
// malformed follow-up history can never poison weekly counts.
function asTimestampArray(value: unknown): string[] {
  return asStringArray(value).filter((item) => !Number.isNaN(new Date(item).getTime()));
}

function reviveProfile(raw: unknown): CareerProfile {
  if (!raw || typeof raw !== "object") return emptyProfile();
  const source = raw as Record<string, unknown>;
  return {
    currentSituation: asString(source.currentSituation),
    targetRoles: asString(source.targetRoles),
    transferableSkills: asStringArray(source.transferableSkills),
    experienceSummary: asString(source.experienceSummary),
    strengths: asStringArray(source.strengths),
    constraints: asString(source.constraints),
    workStyle: asString(source.workStyle),
    proofPoints: asString(source.proofPoints),
    updatedAt: asStringOrNull(source.updatedAt)
  };
}

function reviveLane(raw: Record<string, unknown>): TargetLane | null {
  if (!asString(raw.id) || !asString(raw.title)) return null;
  const status = raw.status === "active" || raw.status === "exploring" || raw.status === "paused" ? raw.status : "exploring";
  return {
    id: asString(raw.id),
    title: asString(raw.title),
    status,
    whyFit: asString(raw.whyFit),
    resumeAngle: asString(raw.resumeAngle),
    proof: asStringArray(raw.proof),
    gaps: asStringArray(raw.gaps),
    keywords: asStringArray(raw.keywords),
    source: raw.source === "custom" ? "custom" : "library",
    createdAt: asString(raw.createdAt, new Date(0).toISOString())
  };
}

const applicationStatuses = ["drafting", "applied", "interviewing", "offer", "rejected", "closed"] as const;
const outreachStatuses = ["planned", "sent", "replied", "meeting_booked", "dormant"] as const;
const outreachChannels = ["linkedin", "email", "recruiter", "referral", "community", "other"] as const;

function reviveApplication(raw: Record<string, unknown>): ApplicationRecord | null {
  if (!asString(raw.id)) return null;
  const status = applicationStatuses.includes(raw.status as (typeof applicationStatuses)[number])
    ? (raw.status as ApplicationRecord["status"])
    : "drafting";
  return {
    id: asString(raw.id),
    company: asString(raw.company),
    roleTitle: asString(raw.roleTitle),
    laneId: asStringOrNull(raw.laneId),
    status,
    jobPostUrl: asString(raw.jobPostUrl),
    resumeVersionId: asStringOrNull(raw.resumeVersionId),
    appliedAt: asStringOrNull(raw.appliedAt),
    nextFollowUpAt: asStringOrNull(raw.nextFollowUpAt),
    followUpsSent: asTimestampArray(raw.followUpsSent),
    interviewAt: asStringOrNull(raw.interviewAt),
    notes: asString(raw.notes),
    analysisKeywords: asStringArray(raw.analysisKeywords),
    analysisGaps: asStringArray(raw.analysisGaps),
    analysisWeakSpots: asStringArray(raw.analysisWeakSpots),
    packResumeId: asStringOrNull(raw.packResumeId),
    briefText: asString(raw.briefText),
    outreachMessage: asString(raw.outreachMessage),
    createdAt: asString(raw.createdAt, new Date(0).toISOString())
  };
}

function reviveContact(raw: Record<string, unknown>): OutreachContact | null {
  if (!asString(raw.id)) return null;
  const status = outreachStatuses.includes(raw.status as (typeof outreachStatuses)[number])
    ? (raw.status as OutreachContact["status"])
    : "planned";
  const channel = outreachChannels.includes(raw.channel as (typeof outreachChannels)[number])
    ? (raw.channel as OutreachContact["channel"])
    : "linkedin";
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    company: asString(raw.company),
    role: asString(raw.role),
    channel,
    status,
    laneId: asStringOrNull(raw.laneId),
    lastContactedAt: asStringOrNull(raw.lastContactedAt),
    nextFollowUpAt: asStringOrNull(raw.nextFollowUpAt),
    followUpCount: typeof raw.followUpCount === "number" ? raw.followUpCount : 0,
    notes: asString(raw.notes),
    createdAt: asString(raw.createdAt, new Date(0).toISOString())
  };
}

const templateStyles = ["Corporate", "Modern ATS", "Tech ATS"] as const;

// Deep-validates a stored resume snapshot. Anything malformed collapses to
// null, which the UI treats as "styled preview unavailable".
export function reviveResumeSnapshot(raw: unknown): ResumeSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const resumeRaw = source.resume;
  if (!resumeRaw || typeof resumeRaw !== "object") return null;
  const resume = resumeRaw as Record<string, unknown>;
  if (typeof resume.summary !== "string" || typeof resume.education !== "string") return null;
  if (!Array.isArray(resume.coreSkills) || !Array.isArray(resume.experience)) return null;

  const experience = resume.experience
    .filter((role): role is Record<string, unknown> => Boolean(role) && typeof role === "object")
    .map((role) => ({
      title: asString(role.title),
      company: asString(role.company),
      time: asString(role.time),
      bullets: asStringArray(role.bullets)
    }));

  return {
    fullName: asString(source.fullName),
    email: asString(source.email),
    phone: asString(source.phone),
    website: asString(source.website),
    template: templateStyles.includes(source.template as (typeof templateStyles)[number])
      ? (source.template as ResumeSnapshot["template"])
      : "Modern ATS",
    resume: {
      summary: resume.summary,
      coreSkills: asStringArray(resume.coreSkills),
      experience,
      education: resume.education,
      linkedinHeadline: asString(resume.linkedinHeadline),
      linkedinSummary: asString(resume.linkedinSummary)
    }
  };
}

function reviveResumeVersion(raw: Record<string, unknown>): ResumeVersionRecord | null {
  if (!asString(raw.id)) return null;
  return {
    id: asString(raw.id),
    label: asString(raw.label),
    laneId: asStringOrNull(raw.laneId),
    notes: asString(raw.notes),
    source: raw.source === "tailor" ? "tailor" : "builder",
    applicationId: asStringOrNull(raw.applicationId),
    targetCompany: asString(raw.targetCompany),
    targetTitle: asString(raw.targetTitle),
    keywordsUsed: asStringArray(raw.keywordsUsed),
    gapsAcknowledged: asStringArray(raw.gapsAcknowledged),
    influenceSummary: asString(raw.influenceSummary),
    resumeText: asString(raw.resumeText),
    resumeSnapshot: reviveResumeSnapshot(raw.resumeSnapshot),
    createdAt: asString(raw.createdAt, new Date(0).toISOString())
  };
}

// Removes a resume version and clears any application links pointing at it.
export function deleteResumeVersion(state: CommandCenterState, versionId: string): CommandCenterState {
  return {
    ...state,
    resumeVersions: state.resumeVersions.filter((version) => version.id !== versionId),
    applications: state.applications.map((app) =>
      app.resumeVersionId === versionId ? { ...app, resumeVersionId: null } : app
    )
  };
}

function reviveList<T>(raw: unknown, revive: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map(revive)
    .filter((item): item is T => item !== null);
}

export function parseState(serialized: string | null): CommandCenterState {
  if (!serialized) return emptyState();
  try {
    const raw = JSON.parse(serialized) as Record<string, unknown>;
    if (!raw || typeof raw !== "object") return emptyState();
    return {
      version: 1,
      profile: reviveProfile(raw.profile),
      lanes: reviveList(raw.lanes, reviveLane),
      applications: reviveList(raw.applications, reviveApplication),
      outreach: reviveList(raw.outreach, reviveContact),
      resumeVersions: reviveList(raw.resumeVersions, reviveResumeVersion)
    };
  } catch {
    return emptyState();
  }
}

export function loadState(): CommandCenterState {
  if (typeof window === "undefined") return emptyState();
  return parseState(window.localStorage.getItem(STORAGE_KEY));
}

export function saveState(state: CommandCenterState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
