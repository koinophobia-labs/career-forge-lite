import type { ResumePackage, TemplateStyle } from "@/types/career";

export type LaneStatus = "active" | "exploring" | "paused";

export type ApplicationStatus =
  | "drafting"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "closed";

export type OutreachStatus = "planned" | "sent" | "replied" | "meeting_booked" | "dormant";

export type OutreachChannel = "linkedin" | "email" | "recruiter" | "referral" | "community" | "other";

export type CareerProfile = {
  currentSituation: string;
  targetRoles: string;
  transferableSkills: string[];
  experienceSummary: string;
  strengths: string[];
  constraints: string;
  workStyle: string;
  proofPoints: string;
  updatedAt: string | null;
};

export type TargetLane = {
  id: string;
  title: string;
  status: LaneStatus;
  whyFit: string;
  resumeAngle: string;
  proof: string[];
  gaps: string[];
  keywords: string[];
  source: "library" | "custom";
  createdAt: string;
};

export type ResumeVersionRecord = {
  id: string;
  label: string;
  laneId: string | null;
  notes: string;
  // Tailoring metadata. Versions from the plain guided builder use
  // source "builder" with the target fields empty.
  source: "builder" | "tailor";
  applicationId: string | null;
  targetCompany: string;
  targetTitle: string;
  keywordsUsed: string[];
  gapsAcknowledged: string[];
  // Human-readable record of how tailoring changed this version's output.
  influenceSummary: string;
  // The exact plain-text render of the generated resume, persisted verbatim so
  // versions can be reopened and copied later. Legacy versions revive with "".
  resumeText: string;
  // Structured snapshot of the generated document, persisted verbatim at
  // generation time so the styled preview/print view can reopen it without
  // regenerating. Null for versions created before snapshots existed.
  resumeSnapshot: ResumeSnapshot | null;
  createdAt: string;
};

export type ResumeSnapshot = {
  fullName: string;
  email: string;
  phone: string;
  website: string;
  template: TemplateStyle;
  resume: ResumePackage;
};

export type ApplicationRecord = {
  id: string;
  company: string;
  roleTitle: string;
  laneId: string | null;
  status: ApplicationStatus;
  jobPostUrl: string;
  resumeVersionId: string | null;
  appliedAt: string | null;
  nextFollowUpAt: string | null;
  // ISO timestamps of follow-ups actually sent for this application — the
  // durable record behind "follow-ups completed" in the weekly review.
  followUpsSent: string[];
  interviewAt: string | null;
  notes: string;
  // Summary of the job-post analysis that produced this application, kept so
  // interview prep can build gap-defense questions from the real posting.
  analysisKeywords: string[];
  analysisGaps: string[];
  analysisWeakSpots: string[];
  // Which finalized pack resume was recommended/sent (resume-pack.ts id),
  // plus the exact brief and outreach message at apply time — the durable
  // answer to "what did I send to this company?". Legacy records revive
  // with null/"".
  packResumeId: string | null;
  briefText: string;
  outreachMessage: string;
  createdAt: string;
};

export type OutreachContact = {
  id: string;
  name: string;
  company: string;
  role: string;
  channel: OutreachChannel;
  status: OutreachStatus;
  laneId: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  followUpCount: number;
  notes: string;
  createdAt: string;
};

export type CommandCenterState = {
  version: 1;
  profile: CareerProfile;
  lanes: TargetLane[];
  applications: ApplicationRecord[];
  outreach: OutreachContact[];
  resumeVersions: ResumeVersionRecord[];
};

export type NextBestAction = {
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};
