import {
  mergeImportProposals as mergeBaseImportProposals,
  parseResumePackToProposals as parseBaseResumePackToProposals,
  projectProfileFromDossier
} from "@/lib/dossier";
import { containsTerminationReason, isUncertaintyStatement } from "@/lib/truth-guards";
import type { ResumePackage } from "@/types/career";
import type { CommandCenterState, ResumeVersionRecord } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEvidenceRecord,
  EvidenceKind,
  ImportProposalRecord,
  PendingImportReview,
  ResumePack,
  ResumeVariant
} from "@/types/dossier";

export type EvidenceAdmissibility =
  | "claim"
  | "constraint"
  | "preference"
  | "gap"
  | "separation_reason"
  | "uncertainty";

const PROFESSIONAL_KINDS = new Set<EvidenceKind>([
  "role",
  "project",
  "education",
  "responsibility",
  "tool",
  "skill",
  "metric",
  "proof",
  "story"
]);

const TARGET_PREFERENCE_PATTERNS = [
  /^\s*(?:target(?:ed|ing)?|preferred|desired|ideal)\s+roles?\s*:/i,
  /^\s*(?:roles?\s+(?:of interest|wanted)|career targets?)\s*:/i,
  /^\s*(?:i(?:'m| am)?\s+)?(?:seeking|looking for|interested in|targeting)\b/i,
  /^\s*i\s+(?:want|would like|hope)\s+to\b/i
];

const GAP_PATTERNS = [
  /^\s*no\s+(?![-\s]?code\b)(?=.*\b(?:employment|experience|metrics?|outcomes?|results?|leadership|title|ownership|credentials?|certifications?|degree|qualification|background|history|saas|software\s+implementation|project[-\s]?management)\b)/i,
  /\b(?:do|does|did|have|has)\s+not\s+(?:manage|own|lead|implement|hold|have|work|use|track|measure)\b/i,
  /\b(?:don['’]?t|doesn['’]?t|didn['’]?t|haven['’]?t|hasn['’]?t)\s+(?:manage|own|lead|implement|hold|have|work|use|track|measure)\b/i,
  /\b(?:lack|lacks|lacking|without)\s+(?:formal\s+)?(?:experience|metrics?|outcomes?|credentials?|certifications?|degree|leadership|ownership|qualification)\b/i,
  /\bnot\s+(?:yet\s+)?(?:experienced|certified|qualified|credentialed)\b/i,
  /\b(?:not|never)\s+responsible\s+for\b/i
];

const CONSTRAINT_PATTERNS = [
  /^\s*(?:constraint|constraints|availability|schedule|location|salary|compensation|work authorization)\s*:/i,
  /\b(?:cannot|can['’]?t|unable to|must not|not available|only available|requires? remote|requires? hybrid)\b/i
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function contextCategory(kind: EvidenceKind, detail: string): EvidenceAdmissibility {
  if (kind === "goal") return "preference";
  if (kind === "constraint") return "constraint";
  return classifyEvidenceAdmissibility(detail);
}

export function classifyEvidenceAdmissibility(text: string): EvidenceAdmissibility {
  const value = text.trim();
  if (!value) return "gap";
  if (/^no[-\s]?code\b/i.test(value) || /^no\.\s*\d/i.test(value)) return "claim";
  if (isUncertaintyStatement(value)) return "uncertainty";
  if (containsTerminationReason(value)) return "separation_reason";
  if (TARGET_PREFERENCE_PATTERNS.some((pattern) => pattern.test(value))) return "preference";
  if (GAP_PATTERNS.some((pattern) => pattern.test(value))) return "gap";
  if (CONSTRAINT_PATTERNS.some((pattern) => pattern.test(value))) return "constraint";
  return "claim";
}

function contextLabel(category: Exclude<EvidenceAdmissibility, "claim">): string {
  if (category === "preference") return "Target preference (context only)";
  if (category === "gap") return "Evidence gap (not career-material content)";
  if (category === "separation_reason") return "Separation reason (withheld from career materials)";
  if (category === "uncertainty") return "Uncertainty (not evidence)";
  return "Constraint (context only)";
}

export function normalizeImportProposal(proposal: ImportProposalRecord): ImportProposalRecord {
  const category = contextCategory(proposal.kind, proposal.detail);
  if (category === "claim") return proposal;
  return {
    ...proposal,
    group: "other",
    kind: category === "preference" ? "goal" : "constraint",
    label: contextLabel(category),
    confidence: category === "uncertainty" ? "high" : proposal.confidence
  };
}

export function parseResumePackToSafeProposals(
  files: Array<{ filename: string; text: string }>
): ImportProposalRecord[] {
  return parseBaseResumePackToProposals(files).map(normalizeImportProposal);
}

export function isProfessionalEvidence(record: DossierEvidenceRecord): boolean {
  return PROFESSIONAL_KINDS.has(record.kind) && contextCategory(record.kind, record.detail) === "claim";
}

function targetRoleValues(detail: string): string[] {
  const cleaned = detail
    .replace(/^.*?(?:target(?:ed|ing)?|preferred|desired|ideal)\s+roles?\s*:\s*/i, "")
    .replace(/^.*?(?:seeking|looking for|interested in|targeting)\s+/i, "")
    .trim();
  return unique(cleaned.split(/\r?\n|;|\||,(?=\s*[A-Z])/));
}

function safeArray(values: string[]): string[] {
  return unique(values.filter((value) => classifyEvidenceAdmissibility(value) === "claim"));
}

export type DossierSanitization = {
  dossier: CareerDossier;
  removedEvidenceIds: string[];
  contextItems: string[];
};

export function sanitizeCareerDossier(dossier: CareerDossier): DossierSanitization {
  const approvedContext = dossier.evidence.filter(
    (item) => item.approved && !item.rejected && contextCategory(item.kind, item.detail) !== "claim"
  );
  const contextItems = approvedContext.map((item) => item.detail);
  const removedEvidenceIds = approvedContext.map((item) => item.id);

  const evidence = dossier.evidence.flatMap((item): DossierEvidenceRecord[] => {
    const category = contextCategory(item.kind, item.detail);
    if (item.approved && !item.rejected && category !== "claim") return [];
    if (category === "claim") return [item];
    return [{
      ...item,
      kind: category === "preference" ? "goal" : "constraint",
      label: contextLabel(category)
    }];
  });

  const approvedProfessionalIds = new Set(
    evidence.filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item)).map((item) => item.id)
  );
  const approvedProfessional = evidence.filter(
    (item) => item.approved && !item.rejected && isProfessionalEvidence(item)
  );

  const roles = dossier.roles.flatMap((role) => {
    const heading = [role.title, role.employer].filter(Boolean).join(" · ");
    const evidenceIds = role.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    if (heading && classifyEvidenceAdmissibility(heading) !== "claim") return [];
    if (role.evidenceIds.length > 0 && evidenceIds.length === 0) return [];
    return [{
      ...role,
      responsibilities: safeArray(role.responsibilities),
      tools: safeArray(role.tools),
      outcomes: safeArray(role.outcomes),
      evidenceIds
    }];
  });

  const projects = dossier.projects.flatMap((project) => {
    const evidenceIds = project.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    if (classifyEvidenceAdmissibility(project.name) !== "claim") return [];
    if (project.description && classifyEvidenceAdmissibility(project.description) !== "claim") return [];
    if (project.evidenceIds.length > 0 && evidenceIds.length === 0) return [];
    return [{
      ...project,
      responsibilities: safeArray(project.responsibilities),
      tools: safeArray(project.tools),
      outcomes: safeArray(project.outcomes),
      metrics: safeArray(project.metrics),
      description: project.description && classifyEvidenceAdmissibility(project.description) === "claim"
        ? project.description
        : "",
      evidenceIds
    }];
  });

  const education = dossier.education.flatMap((item) => {
    const evidenceIds = item.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    if (classifyEvidenceAdmissibility([item.credential, item.institution].filter(Boolean).join(" · ")) !== "claim") return [];
    if (item.evidenceIds.length > 0 && evidenceIds.length === 0) return [];
    return [{ ...item, evidenceIds }];
  });

  const preferences = approvedContext.filter((item) => contextCategory(item.kind, item.detail) === "preference");
  const constraints = approvedContext.filter((item) => contextCategory(item.kind, item.detail) !== "preference");
  const safetyNote = removedEvidenceIds.length
    ? "Context-only import items were separated from professional evidence and cannot enter generated career materials."
    : "";

  return {
    removedEvidenceIds,
    contextItems,
    dossier: {
      ...dossier,
      roles,
      projects,
      education,
      responsibilities: safeArray(dossier.responsibilities),
      tools: safeArray(dossier.tools),
      transferableSkills: safeArray(dossier.transferableSkills),
      outcomes: safeArray(dossier.outcomes),
      metrics: safeArray(dossier.metrics),
      proofPoints: safeArray(dossier.proofPoints),
      interviewStories: safeArray(dossier.interviewStories),
      constraints: unique([...dossier.constraints, ...constraints.map((item) => item.detail)]),
      targetRoleInterests: unique([
        ...dossier.targetRoleInterests,
        ...preferences.flatMap((item) => targetRoleValues(item.detail))
      ]),
      approvedClaims: unique(approvedProfessional.map((item) => item.detail)),
      evidence,
      unstructuredNotes: safeArray(dossier.unstructuredNotes),
      migrationReview: unique([...dossier.migrationReview, safetyNote])
    }
  };
}

export function mergeSafeImportProposals(
  dossier: CareerDossier,
  proposals: ImportProposalRecord[],
  nowIso = new Date().toISOString(),
  retainSourceFilenames = false
): CareerDossier {
  const merged = mergeBaseImportProposals(
    dossier,
    proposals.map(normalizeImportProposal),
    nowIso,
    retainSourceFilenames
  );
  return sanitizeCareerDossier(merged).dossier;
}

function safeOutputText(value: string): boolean {
  return Boolean(value.trim()) && classifyEvidenceAdmissibility(value) === "claim" && !containsTerminationReason(value);
}

function sanitizeParagraph(value: string): string {
  return value
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((part) => part.trim())
    .filter(safeOutputText)
    .join(" ")
    .trim();
}

export function sanitizeResumeForProfessionalUse(resume: ResumePackage): ResumePackage {
  const coreSkills = safeArray(resume.coreSkills);
  const experience = resume.experience.flatMap((role) => {
    const heading = [role.title, role.company].filter(Boolean).join(" · ");
    if (heading && classifyEvidenceAdmissibility(heading) !== "claim") return [];
    const bullets = role.bullets.filter(safeOutputText);
    if (!bullets.length) return [];
    return [{ ...role, bullets }];
  });
  const summary = sanitizeParagraph(resume.summary);
  const linkedinSummary = sanitizeParagraph(resume.linkedinSummary);
  const headline = safeOutputText(resume.linkedinHeadline)
    ? resume.linkedinHeadline
    : coreSkills.slice(0, 3).join(" | ");
  return {
    summary,
    coreSkills,
    experience,
    education: safeOutputText(resume.education) ? resume.education : "",
    linkedinHeadline: headline,
    linkedinSummary
  };
}

function sanitizeVariant(
  variant: ResumeVariant,
  validEvidenceIds: Set<string>,
  forceReview: boolean
): ResumeVariant {
  const resume = sanitizeResumeForProfessionalUse(variant.resume);
  const references = variant.evidenceReferences
    .map((reference) => ({
      ...reference,
      evidenceIds: reference.evidenceIds.filter((id) => validEvidenceIds.has(id))
    }))
    .filter((reference) => reference.evidenceIds.length > 0 && safeOutputText(reference.claimText));
  const changed = JSON.stringify(resume) !== JSON.stringify(variant.resume) || references.length !== variant.evidenceReferences.length;
  return {
    ...variant,
    resume,
    evidenceReferences: references,
    status: variant.status === "archived" ? "archived" : forceReview || changed ? "needs-review" : variant.status
  };
}

function sanitizePack(pack: ResumePack, dossier: CareerDossier, forceReview: boolean): ResumePack {
  const validEvidenceIds = new Set(
    dossier.evidence.filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item)).map((item) => item.id)
  );
  const variants = pack.variants.map((variant) => sanitizeVariant(variant, validEvidenceIds, forceReview));
  const first = variants.find((variant) => variant.kind === "recruiter")?.resume ?? variants[0]?.resume;
  const approvedFacts = dossier.evidence
    .filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item))
    .map((item) => item.detail);
  return {
    ...pack,
    status: pack.status === "archived" ? "archived" : forceReview ? "needs-review" : pack.status,
    variants,
    lanePacks: pack.lanePacks.map((lanePack) => ({
      ...lanePack,
      evidenceUsed: lanePack.evidenceUsed.filter((id) => validEvidenceIds.has(id)),
      evidenceOmitted: lanePack.evidenceOmitted.filter((id) => validEvidenceIds.has(id))
    })),
    linkedinHeadlines: unique(variants.map((variant) => variant.resume.linkedinHeadline)).filter(Boolean),
    linkedinAbout: first?.linkedinSummary || first?.summary || "",
    linkedinSkills: unique(variants.flatMap((variant) => variant.resume.coreSkills)).slice(0, 30),
    masterProofBank: safeArray(pack.masterProofBank),
    coverLetterFoundation: approvedFacts.length
      ? `Approved evidence to draw from: ${approvedFacts.slice(0, 3).join("; ")}`
      : "Add approved professional evidence before drafting a cover letter.",
    receipt: {
      ...pack.receipt,
      evidenceUsed: pack.receipt.evidenceUsed.filter((id) => validEvidenceIds.has(id)),
      evidenceOmitted: pack.receipt.evidenceOmitted.filter((id) => validEvidenceIds.has(id)),
      unsupportedClaimsRefused: unique([
        ...pack.receipt.unsupportedClaimsRefused,
        ...(forceReview ? ["Context-only items withheld after evidence-safety review"] : [])
      ]),
      transferredClaims: pack.receipt.transferredClaims.filter(safeOutputText)
    }
  };
}

function resumeText(resume: ResumePackage): string {
  return [
    resume.summary,
    resume.coreSkills.join(", "),
    ...resume.experience.flatMap((role) => [
      [role.title, role.company, role.time].filter(Boolean).join(" | "),
      ...role.bullets.map((bullet) => `- ${bullet}`)
    ]),
    resume.education
  ].filter(Boolean).join("\n");
}

function sanitizeVersion(version: ResumeVersionRecord, forceReview: boolean): ResumeVersionRecord {
  if (!version.resumeSnapshot) {
    const lines = version.resumeText.split(/\r?\n/).filter((line) => !line.trim() || safeOutputText(line.replace(/^[-•]\s*/, "")));
    return {
      ...version,
      resumeText: lines.join("\n"),
      notes: forceReview && !version.notes.includes("evidence-safety review")
        ? `${version.notes} Needs review after evidence-safety update.`.trim()
        : version.notes
    };
  }
  const resume = sanitizeResumeForProfessionalUse(version.resumeSnapshot.resume);
  return {
    ...version,
    resumeText: resumeText(resume),
    resumeSnapshot: { ...version.resumeSnapshot, resume },
    notes: forceReview && !version.notes.includes("evidence-safety review")
      ? `${version.notes} Needs review after evidence-safety update.`.trim()
      : version.notes
  };
}

function reconcilePendingReviews(
  previous: PendingImportReview[] | undefined,
  next: PendingImportReview[]
): PendingImportReview[] {
  const previousStatus = new Map(
    (previous ?? []).flatMap((batch) => batch.proposals.map((proposal) => [proposal.id, proposal.status] as const))
  );
  return next.map((batch) => ({
    ...batch,
    proposals: batch.proposals.map((proposal) => {
      const normalized = normalizeImportProposal(proposal);
      // A rejection is sticky. To change it, the user must explicitly click
      // Undecide first, then Approve in a separate action. This prevents the
      // section-level bulk action from silently reversing a rejection.
      if (previousStatus.get(proposal.id) === "rejected" && normalized.status === "approved") {
        return { ...normalized, status: "rejected" };
      }
      return normalized;
    })
  }));
}

export function sanitizeCommandCenterState(
  next: CommandCenterState,
  previous?: CommandCenterState
): CommandCenterState {
  const pendingImportReviews = reconcilePendingReviews(previous?.pendingImportReviews, next.pendingImportReviews);
  const sanitized = sanitizeCareerDossier(next.dossier);
  const forceReview = sanitized.removedEvidenceIds.length > 0;
  const dossier = sanitized.dossier;
  return {
    ...next,
    profile: projectProfileFromDossier(dossier),
    dossier,
    pendingImportReviews,
    resumePacks: next.resumePacks.map((pack) => sanitizePack(pack, dossier, forceReview)),
    resumeVersions: next.resumeVersions.map((version) => sanitizeVersion(version, forceReview))
  };
}
