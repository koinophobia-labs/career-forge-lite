import type { ResumePackage, TemplateStyle } from "@/types/career";
import type { CareerDossier, ExportMetadata, PendingImportReview, ResumePack } from "@/types/dossier";

export type LaneStatus = "active" | "exploring" | "paused";
export type CareerGoalKind = "new-job" | "career-change" | "update-resume" | "first-resume" | "practice-interview";
export type ActiveCareerGoal = { kind: CareerGoalKind; selectedAt: string; updatedAt: string };
export type ApplicationStatus = "drafting" | "applied" | "interviewing" | "offer" | "rejected" | "closed";
export type OutreachStatus = "planned" | "sent" | "replied" | "meeting_booked" | "dormant";
export type OutreachChannel = "linkedin" | "email" | "recruiter" | "referral" | "community" | "other";

export type CareerProfile = {
  currentSituation: string; targetRoles: string; transferableSkills: string[]; experienceSummary: string;
  strengths: string[]; constraints: string; workStyle: string; proofPoints: string; updatedAt: string | null;
};

export type TargetLane = {
  id: string; title: string; status: LaneStatus; whyFit: string; resumeAngle: string; proof: string[];
  gaps: string[]; keywords: string[]; source: "library" | "custom"; createdAt: string;
};

export type ResumeVersionRecord = {
  id: string; label: string; laneId: string | null; notes: string; source: "builder" | "tailor";
  applicationId: string | null; dossierId?: string; baselineVariantId?: string | null; jobPostAnalysisId?: string | null;
  targetCompany: string; targetTitle: string; keywordsUsed: string[]; gapsAcknowledged: string[];
  influenceSummary: string; resumeText: string; resumeSnapshot: ResumeSnapshot | null; createdAt: string;
};

export type ResumeSnapshot = {
  fullName: string; email: string; phone: string; website: string; template: TemplateStyle; resume: ResumePackage;
};

export type ApplicationStageEvent = { status: ApplicationStatus; at: string };

export type ApplicationRecord = {
  id: string; company: string; roleTitle: string; laneId: string | null; status: ApplicationStatus; jobPostUrl: string;
  source: "linkedin" | "company-site" | "referral" | "recruiter" | "other"; discoveryUrl: string; applicationUrl: string;
  postingDate: string | null; deadline: string | null; contactName: string; contactUrl: string; resumeVariantId: string | null;
  applicationQuestions: ApplicationQuestion[]; resumeVersionId: string | null; appliedAt: string | null; nextFollowUpAt: string | null;
  followUpsSent: string[]; interviewAt: string | null; notes: string; analysisKeywords: string[]; analysisGaps: string[];
  analysisWeakSpots: string[]; createdAt: string;
  // Added after the original local schema. Legacy records fall back to createdAt.
  updatedAt?: string;
  // Explicit stage history makes destructive transitions explainable and reversible.
  stageHistory?: ApplicationStageEvent[];
  interviewHistory?: string[];
};

export type ApplicationQuestion = { id: string; prompt: string; draftAnswer: string; evidenceIds: string[]; userEdited: boolean };
export type RoleSprintType = "explain" | "evaluate" | "plan" | "simulate" | "build";
export type RoleSprintStatus = "draft" | "completed" | "approved-as-evidence";
export type RoleSprintOutputs = {
  portfolioTitle: string; portfolioSummary: string; resumeBullet: string; starStory: string; talkingPoint: string; userEdited: boolean;
};
export type RoleSprintRecord = {
  id: string; applicationId: string | null; company: string; roleTitle: string; requirement: string; originalStatus: "gap" | "partial";
  sprintType: RoleSprintType; title: string; instructions: string[]; completionCriteria: string[]; supportingEvidenceIds: string[];
  userWork: string; status: RoleSprintStatus; evidenceId: string | null; outputs: RoleSprintOutputs | null; createdAt: string; updatedAt: string;
};

export type OutreachContact = {
  id: string; name: string; company: string; role: string; channel: OutreachChannel; status: OutreachStatus; laneId: string | null;
  lastContactedAt: string | null; nextFollowUpAt: string | null; followUpCount: number; notes: string; createdAt: string;
};

export type CommandCenterState = {
  version: 2; profile: CareerProfile; dossier: CareerDossier; lanes: TargetLane[]; applications: ApplicationRecord[];
  outreach: OutreachContact[]; resumeVersions: ResumeVersionRecord[]; resumePacks: ResumePack[]; exports: ExportMetadata[];
  pendingImportReviews: PendingImportReview[]; roleSprints: RoleSprintRecord[]; activeGoal: ActiveCareerGoal | null;
};

export type NextBestAction = { title: string; detail: string; href: string; actionLabel: string };
