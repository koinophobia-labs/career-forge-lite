import type { ResumePackage, TemplateStyle } from "@/types/career";

export type EvidenceKind =
  | "identity"
  | "role"
  | "project"
  | "education"
  | "responsibility"
  | "tool"
  | "skill"
  | "metric"
  | "proof"
  | "story"
  | "constraint"
  | "goal";

export type EvidenceSource = "guided" | "story" | "resume-import" | "legacy-profile" | "manual";

export type DossierEvidenceRecord = {
  id: string;
  kind: EvidenceKind;
  label: string;
  detail: string;
  source: EvidenceSource;
  sourceText: string;
  confidence: "high" | "medium" | "low";
  approved: boolean;
  rejected: boolean;
  sourceFilenames: string[];
  sourceExcerpts: string[];
  createdAt: string;
  updatedAt: string;
};

export type DossierRole = {
  id: string;
  title: string;
  employer: string;
  startDate: string;
  endDate: string;
  current: boolean;
  responsibilities: string[];
  tools: string[];
  outcomes: string[];
  evidenceIds: string[];
};

export type DossierProject = {
  id: string;
  name: string;
  organization: string;
  dates: string;
  description: string;
  responsibilities: string[];
  tools: string[];
  outcomes: string[];
  metrics: string[];
  links: string[];
  defaultPlacement: "projects" | "experience" | "selected-projects" | "omit";
  evidenceIds: string[];
};

export type DossierEducation = {
  id: string;
  institution: string;
  credential: string;
  field: string;
  dates: string;
  evidenceIds: string[];
};

export type CareerDossier = {
  id: string;
  identity: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    links: string[];
  };
  roles: DossierRole[];
  projects: DossierProject[];
  education: DossierEducation[];
  responsibilities: string[];
  tools: string[];
  transferableSkills: string[];
  outcomes: string[];
  metrics: string[];
  proofPoints: string[];
  interviewStories: string[];
  constraints: string[];
  preferredWorkStyle: string[];
  careerGoals: string[];
  targetRoleInterests: string[];
  approvedClaims: string[];
  evidence: DossierEvidenceRecord[];
  unstructuredNotes: string[];
  migrationReview: string[];
  createdAt: string;
  updatedAt: string;
};

export type ResumeVariantKind = "ats" | "recruiter" | "job-specific";
export type ResumeVariantStatus = "current" | "needs-review" | "out-of-date" | "missing-evidence" | "job-specific" | "archived";

export type ResumeEvidenceReference = {
  claimPath: string;
  claimText: string;
  evidenceIds: string[];
  supportType: "direct" | "combined" | "transferred";
};

export type ResumeVariant = {
  id: string;
  laneId: string;
  kind: ResumeVariantKind;
  title: string;
  status: ResumeVariantStatus;
  canonical: boolean;
  userEdited: boolean;
  resume: ResumePackage;
  template: TemplateStyle;
  evidenceReferences: ResumeEvidenceReference[];
  userAuthoredPaths: string[];
  sectionOrder: Array<"summary" | "skills" | "experience" | "projects" | "education">;
  sourceDossierUpdatedAt: string;
  baselineVariantId: string | null;
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LanePack = {
  laneId: string;
  positioningPitch: string;
  variantIds: string[];
  evidenceUsed: string[];
  evidenceOmitted: string[];
  gapsAvoided: string[];
};

export type PackGenerationReceipt = {
  id: string;
  generatedAt: string;
  evidenceUsed: string[];
  evidenceOmitted: string[];
  laneFraming: Array<{ laneId: string; angle: string }>;
  keywordsIncluded: string[];
  gapsAvoided: string[];
  unsupportedClaimsRefused: string[];
  transferredClaims: string[];
  gapsLeftUnclaimed: string[];
};

export type ImportProposalGroup =
  | "identity"
  | "employment"
  | "projects"
  | "education"
  | "tools"
  | "skills"
  | "metrics-outcomes"
  | "other";

export type ImportProposalRecord = {
  id: string;
  group: ImportProposalGroup;
  kind: EvidenceKind;
  label: string;
  detail: string;
  sourceFilenames: string[];
  sourceExcerpts: string[];
  confidence: "high" | "medium" | "low";
  status: "proposed" | "approved" | "rejected";
};

export type ResumePack = {
  id: string;
  dossierId: string;
  status: "current" | "needs-review" | "out-of-date" | "archived";
  lanePacks: LanePack[];
  variants: ResumeVariant[];
  linkedinHeadlines: string[];
  linkedinAbout: string;
  linkedinSkills: string[];
  masterProofBank: string[];
  coverLetterFoundation: string;
  receipt: PackGenerationReceipt;
  createdAt: string;
  updatedAt: string;
};

export type ExportMetadata = {
  id: string;
  packId: string;
  formats: Array<"pdf" | "docx">;
  filenames: string[];
  exportedAt: string;
};
