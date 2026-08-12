import type { DisclosureReason } from "@/lib/truth-guards";

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

// "role-sprint" marks evidence produced by a bounded practice sprint. It is
// provenance, not employment history: the analyzer treats it as at-most
// partial support and the record's detail text carries the practice label.
export type EvidenceSource = "guided" | "story" | "resume-import" | "legacy-profile" | "manual" | "role-sprint";

export type StoryFactCategory =
  | "identity" | "employer" | "title" | "role-date" | "responsibility" | "achievement" | "metric"
  | "skill" | "project" | "project-date" | "volunteer-role" | "informal-work" | "education"
  | "career-gap" | "career-transition" | "aspiration" | "personal-context" | "unresolved";
export type StoryFactCertainty = "exact" | "approximate" | "bounded-range" | "user-estimated" | "unknown" | "conflicting" | "not-applicable" | "unsupported";
export type StoryFactPrecision = "day" | "month" | "year" | "range" | "duration" | "current" | "qualitative" | "unknown" | "not-applicable";
export type StoryFactDisposition = "represented" | "needs-review" | "user-confirmed" | "user-corrected" | "user-rejected" | "intentionally-omitted" | "non-resume-context" | "duplicate" | "conflicting" | "unresolved";

/** Durable, source-positioned ledger entry for typed story intake. */
export type StoryFact = {
  id: string;
  category: StoryFactCategory;
  sourceExcerpt: string;
  sourceStart: number;
  sourceEnd: number;
  candidateValue: string;
  userWording: string;
  certainty: StoryFactCertainty;
  precision: StoryFactPrecision;
  reviewRequired: boolean;
  disposition: StoryFactDisposition;
  omissionReason?: string;
  conflictGroup?: string;
  associationId?: string;
  origin: "user-supplied" | "parser-separated" | "generated-wording";
  evidenceId?: string;
  downstreamClaims: string[];
  updatedAt: string;
};

export type DossierEvidenceRecord = {
  id: string;
  kind: EvidenceKind;
  label: string;
  detail: string;
  /**
   * The role this fact was collected for, when it is known. Explicit ownership:
   * a résumé role may only cite evidence it owns, so one employer's duties can
   * never be printed under another. Absent on records written before ownership
   * existed — those fall back to the ambiguity guard in resume-pack.ts.
   */
  roleId?: string;
  source: EvidenceSource;
  sourceText: string;
  confidence: "high" | "medium" | "low";
  approved: boolean;
  rejected: boolean;
  /**
   * Set when a lexical check thinks this MIGHT be a personal disclosure. It is
   * a question, not a verdict: the text is never altered and the record is
   * never deleted. Until the user resolves it the record is neither used nor
   * counted as omitted, rejected, or a separation reason.
   *
   *   "needs_review" — flagged, undecided. Excluded from generation, and an
   *                    export surfaces the review step rather than deciding.
   *   "keep"         — the user confirmed it describes their work. Used
   *                    normally, exactly as they wrote it.
   *   "exclude"      — the user chose to leave it off the résumé. Reported as
   *                    excluded BY THE USER, with no invented reason.
   */
  disclosureReview?: "needs_review" | "keep" | "exclude";
  /** Why the hand went up. Preserved separately so the receipt never guesses. */
  disclosureReason?: DisclosureReason;
  /**
   * The EXACT text the user saw when they resolved the flag. A resolution
   * belongs to the version that was reviewed, not to an id that may later
   * hold different words: keep a sentence, then edit it into something newly
   * sensitive, and the old "keep" must not silently authorise the new text.
   * When this no longer matches `detail`, the resolution is stale and the
   * record returns to needs_review.
   */
  disclosureReviewedText?: string;
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
  chronology?: { sourceText: string; certainty: StoryFactCertainty; precision: StoryFactPrecision };
  /**
   * Set by the C3 recovery migration when a structural field was found
   * destroyed on disk. "recovered" values are already restored; "candidate"
   * and "unrecoverable" are questions for the user. Never a licence to invent
   * an employer or a title.
   */
  structuralReview?: import("@/lib/employment-structure").StructuralReview[];
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
  volunteer?: boolean;
  chronology?: { sourceText: string; certainty: StoryFactCertainty; precision: StoryFactPrecision };
};

export type DossierEducation = {
  id: string;
  institution: string;
  credential: string;
  field: string;
  dates: string;
  evidenceIds: string[];
};

import type { MissingRoleCandidate } from "@/lib/employment-structure";

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
  /**
   * Employment containers the historical record establishes but the dossier no
   * longer holds. DERIVED on every read, never persisted — and never inserted
   * into `roles`. The user confirms each one.
   */
  missingRoleCandidates?: MissingRoleCandidate[];
  /**
   * Roles the user deliberately removed. The tombstone that lets recovery tell
   * "Career Forge destroyed this" from "the user deleted this" — without it the
   * two are the same state on disk and a migration cannot safely restore
   * either. Entries are identity keys, not ids, so they survive re-import.
   */
  removedRoleIds?: string[];
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
  storyFacts?: StoryFact[];
  storyRawSources?: string[];
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
  /**
   * Exact generation-time revisions for the evidence records above. Older
   * stored variants intentionally omit this field and must be regenerated
   * before generated text can cross an export boundary.
   */
  evidenceRevisions?: Record<string, string>;
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
  /** User-authored fields the user explicitly reviewed after editing. */
  reviewedUserAuthoredPaths?: string[];
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
  /** Excluded by the USER after reviewing a disclosure flag. Never a guess. */
  itemsExcludedByUser?: number;
  /** Flagged and still undecided; counted as neither used nor omitted. */
  itemsAwaitingReview?: number;
  /**
   * Career Forge rejected one of ITS OWN generated sentences at export. Kept
   * distinct from user-resolution withholding so the receipt never has to
   * guess why something is absent.
   */
  generatedSentencesWithheld?: number;
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

export type ImportProposalField =
  | "identity.fullName"
  | "identity.email"
  | "identity.phone"
  | "identity.location"
  | "identity.link"
  | "role"
  | "education"
  | "project"
  | "skill"
  | "tool"
  | "metric"
  | "proof"
  | "unresolved"
  | "structure";

export type ImportProposalDisposition =
  | "valid-candidate"
  | "ambiguous-candidate"
  | "conflicting-candidate"
  | "duplicate-candidate"
  | "structural-heading"
  | "formatting-noise"
  | "unsupported-candidate"
  | "unresolved";

export type ImportProposalValidation = "valid" | "ambiguous" | "conflicting" | "structural" | "noise" | "unsupported";
export type ImportSourceSection = "contact" | "summary" | "experience" | "education" | "projects" | "skills" | "certifications" | "volunteer" | "leadership" | "awards" | "unknown";

export type ImportRoleCandidate = {
  title: string;
  employer: string;
  /** Exact source chronology is kept in `dates`; endpoints never gain precision. */
  dates: string;
  startDate: string;
  endDate: string;
  location: string;
  current: boolean;
  datePrecision: "year" | "month" | "day" | "unknown";
};

export type ImportEducationCandidate = {
  institution: string;
  credential: string;
  field: string;
  dates: string;
  location: string;
};

export type ImportProjectCandidate = {
  name: string;
  organization: string;
  dates: string;
  description: string;
  links: string[];
};

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
  edited: boolean;
  likelyDuplicateOf: string | null;
  /** Deterministic field contract for new imports. Missing on legacy queues. */
  proposedField?: ImportProposalField;
  candidateValue?: string;
  disposition?: ImportProposalDisposition;
  validation?: ImportProposalValidation;
  classificationReasons?: string[];
  sourceSection?: ImportSourceSection;
  sourcePositions?: number[];
  conflictGroup?: string | null;
  reviewRequired?: boolean;
  occurrenceCount?: number;
  roleCandidate?: ImportRoleCandidate;
  educationCandidate?: ImportEducationCandidate;
  projectCandidate?: ImportProjectCandidate;
};

export type PendingImportReview = {
  version: 1;
  id: string;
  proposals: ImportProposalRecord[];
  sourceFilenames: string[];
  sourceFileCount: number;
  retainSourceFilenames: boolean;
  importedAt: string;
  updatedAt: string;
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
