import {
  mergeImportProposals as mergeBaseImportProposals,
  parseResumePackToProposals as parseBaseResumePackToProposals,
  projectProfileFromDossier
} from "@/lib/dossier";
import {
  containsTerminationReason,
  isUncertaintyStatement,
  stripTerminationReasons
} from "@/lib/truth-guards";
import type { ResumePackage } from "@/types/career";
import type { CommandCenterState, ResumeVersionRecord } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEvidenceRecord,
  DossierProject,
  EvidenceKind,
  ImportProposalRecord,
  PendingImportReview,
  ResumeEvidenceReference,
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

const GENERIC_PROJECT_TYPES = /^(?:school|academic|class|course|volunteer|personal|portfolio|independent|community)$/i;

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

export function sanitizeProfessionalLine(value: string): string {
  const stripped = stripTerminationReasons(value).text.trim();
  if (!stripped) return "";
  return classifyEvidenceAdmissibility(stripped) === "claim" ? stripped : "";
}

export function sanitizeProfessionalParagraph(value: string): string {
  return value
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((part) => sanitizeProfessionalLine(part.trim()))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function safeArray(values: string[]): string[] {
  return unique(values.map(sanitizeProfessionalLine));
}

function safeParagraphArray(values: string[]): string[] {
  return unique(values.map(sanitizeProfessionalParagraph));
}

function normalizeProjectSemantics(project: DossierProject): DossierProject {
  const name = project.name.trim();
  const organization = project.organization.trim();
  if (!GENERIC_PROJECT_TYPES.test(name) || !organization) return project;
  const type = `${name[0]?.toUpperCase() ?? ""}${name.slice(1).toLowerCase()} project`;
  return { ...project, name: organization, organization: type };
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
    const title = sanitizeProfessionalLine(role.title);
    const employer = sanitizeProfessionalLine(role.employer);
    const heading = [title, employer].filter(Boolean).join(" · ");
    const evidenceIds = role.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    if (!heading) return [];
    if (role.evidenceIds.length > 0 && evidenceIds.length === 0) return [];
    return [{
      ...role,
      title,
      employer,
      responsibilities: safeParagraphArray(role.responsibilities),
      tools: safeArray(role.tools),
      outcomes: safeParagraphArray(role.outcomes),
      evidenceIds
    }];
  });

  const projects = dossier.projects.flatMap((rawProject) => {
    const normalized = normalizeProjectSemantics(rawProject);
    const name = sanitizeProfessionalLine(normalized.name);
    const organization = sanitizeProfessionalLine(normalized.organization);
    const description = sanitizeProfessionalParagraph(normalized.description);
    const evidenceIds = normalized.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    if (!name) return [];
    if (normalized.evidenceIds.length > 0 && evidenceIds.length === 0) return [];
    return [{
      ...normalized,
      name,
      organization,
      description,
      responsibilities: safeParagraphArray(normalized.responsibilities),
      tools: safeArray(normalized.tools),
      outcomes: safeParagraphArray(normalized.outcomes),
      metrics: safeArray(normalized.metrics),
      evidenceIds
    }];
  });

  const education = dossier.education.flatMap((item) => {
    const credential = sanitizeProfessionalLine(item.credential);
    const institution = sanitizeProfessionalLine(item.institution);
    const field = sanitizeProfessionalLine(item.field);
    const evidenceIds = item.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    if (!credential && !institution) return [];
    if (item.evidenceIds.length > 0 && evidenceIds.length === 0) return [];
    return [{ ...item, credential, institution, field, evidenceIds }];
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
      responsibilities: safeParagraphArray(dossier.responsibilities),
      tools: safeArray(dossier.tools),
      transferableSkills: safeArray(dossier.transferableSkills),
      outcomes: safeParagraphArray(dossier.outcomes),
      metrics: safeArray(dossier.metrics),
      proofPoints: safeParagraphArray(dossier.proofPoints),
      interviewStories: safeParagraphArray(dossier.interviewStories),
      constraints: unique([...dossier.constraints, ...constraints.map((item) => item.detail)]),
      targetRoleInterests: unique([
        ...dossier.targetRoleInterests,
        ...preferences.flatMap((item) => targetRoleValues(item.detail))
      ]),
      approvedClaims: unique(approvedProfessional.map((item) => item.detail)),
      evidence,
      unstructuredNotes: safeParagraphArray(dossier.unstructuredNotes),
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

function claimsForResume(resume: ResumePackage): Array<{ path: string; text: string }> {
  const claims: Array<{ path: string; text: string }> = [];
  const add = (path: string, text: string) => { if (text.trim()) claims.push({ path, text }); };
  add("summary", resume.summary);
  resume.coreSkills.forEach((text, index) => add(`coreSkills.${index}`, text));
  resume.experience.forEach((role, roleIndex) => {
    add(`experience.${roleIndex}.heading`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((text, index) => add(`experience.${roleIndex}.bullets.${index}`, text));
  });
  add("education", resume.education);
  add("linkedinHeadline", resume.linkedinHeadline);
  add("linkedinSummary", resume.linkedinSummary);
  return claims;
}

function sanitizeClaimForPath(path: string, text: string): string {
  return path === "summary" || path === "linkedinSummary" || path.includes(".bullets.")
    ? sanitizeProfessionalParagraph(text)
    : sanitizeProfessionalLine(text);
}

export function sanitizeResumeForProfessionalUse(resume: ResumePackage): ResumePackage {
  const coreSkills = safeArray(resume.coreSkills);
  const experience = resume.experience.flatMap((role) => {
    const title = sanitizeProfessionalLine(role.title);
    const company = sanitizeProfessionalLine(role.company);
    const heading = [title, company].filter(Boolean).join(" · ");
    if (!heading) return [];
    const bullets = safeParagraphArray(role.bullets);
    if (!bullets.length) return [];
    return [{ ...role, title, company, bullets }];
  });
  const summary = sanitizeProfessionalParagraph(resume.summary);
  const linkedinSummary = sanitizeProfessionalParagraph(resume.linkedinSummary);
  // Sentence-level, not line-level: a mixed headline like "Operations
  // Coordinator. Target roles: X; Y" must lose the preference sentence while
  // keeping the professional one — line-level classification let the whole
  // line through because its first sentence is a legitimate claim.
  const headline = sanitizeProfessionalParagraph(resume.linkedinHeadline) || coreSkills.slice(0, 3).join(" | ");
  return {
    summary,
    coreSkills,
    experience,
    education: sanitizeProfessionalParagraph(resume.education),
    linkedinHeadline: headline,
    linkedinSummary
  };
}

function reconcileReferences(
  variant: ResumeVariant,
  resume: ResumePackage,
  validEvidenceIds: Set<string>
): ResumeEvidenceReference[] {
  const candidates = variant.evidenceReferences.map((reference) => ({
    ...reference,
    evidenceIds: reference.evidenceIds.filter((id) => validEvidenceIds.has(id)),
    sanitizedText: sanitizeClaimForPath(reference.claimPath, reference.claimText)
  }));
  const used = new Set<number>();
  return claimsForResume(resume).flatMap((claim): ResumeEvidenceReference[] => {
    let index = candidates.findIndex((reference, candidateIndex) =>
      !used.has(candidateIndex) &&
      reference.claimPath === claim.path &&
      reference.sanitizedText === claim.text &&
      reference.evidenceIds.length > 0
    );
    if (index < 0) {
      index = candidates.findIndex((reference, candidateIndex) =>
        !used.has(candidateIndex) &&
        reference.sanitizedText === claim.text &&
        reference.evidenceIds.length > 0
      );
    }
    if (index < 0) return [];
    used.add(index);
    const reference = candidates[index];
    return [{
      claimPath: claim.path,
      claimText: claim.text,
      evidenceIds: reference.evidenceIds,
      supportType: reference.supportType
    }];
  });
}

function sanitizeVariant(
  variant: ResumeVariant,
  validEvidenceIds: Set<string>,
  forceReview: boolean
): ResumeVariant {
  const resume = sanitizeResumeForProfessionalUse(variant.resume);
  const references = reconcileReferences(variant, resume, validEvidenceIds);
  const claims = claimsForResume(resume);
  const complete = claims.length > 0 && references.length === claims.length;
  const status = variant.status === "archived"
    ? "archived"
    : forceReview || !complete
      ? "needs-review"
      : variant.status === "missing-evidence"
        ? "current"
        : variant.status;
  return { ...variant, resume, evidenceReferences: references, status };
}

function sanitizePack(pack: ResumePack, dossier: CareerDossier, forceReview: boolean): ResumePack {
  const validEvidenceIds = new Set(
    dossier.evidence
      .filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item))
      .map((item) => item.id)
  );
  const variants = pack.variants.map((variant) => sanitizeVariant(variant, validEvidenceIds, forceReview));
  const first = variants.find((variant) => variant.kind === "recruiter")?.resume ?? variants[0]?.resume;
  const approvedFacts = dossier.evidence
    .filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item))
    .map((item) => sanitizeProfessionalParagraph(item.detail))
    .filter(Boolean);
  const lanePacks = pack.lanePacks.map((lanePack) => ({
    ...lanePack,
    positioningPitch: sanitizeProfessionalParagraph(lanePack.positioningPitch),
    evidenceUsed: lanePack.evidenceUsed.filter((id) => validEvidenceIds.has(id)),
    evidenceOmitted: lanePack.evidenceOmitted.filter((id) => validEvidenceIds.has(id))
  }));
  const laneFraming = pack.receipt.laneFraming.flatMap((item) => {
    const angle = sanitizeProfessionalParagraph(item.angle);
    return angle ? [{ ...item, angle }] : [];
  });
  const needsReview = forceReview || variants.some((variant) => variant.status === "needs-review");
  return {
    ...pack,
    status: pack.status === "archived" ? "archived" : needsReview ? "needs-review" : pack.status,
    variants,
    lanePacks,
    linkedinHeadlines: unique(variants.map((variant) => variant.resume.linkedinHeadline)).filter(Boolean),
    linkedinAbout: first?.linkedinSummary || first?.summary || "",
    linkedinSkills: unique(variants.flatMap((variant) => variant.resume.coreSkills)).slice(0, 30),
    masterProofBank: safeParagraphArray(pack.masterProofBank),
    coverLetterFoundation: approvedFacts.length
      ? `Approved evidence to draw from: ${approvedFacts.slice(0, 3).join("; ")}`
      : "Add approved professional evidence before drafting a cover letter.",
    receipt: {
      ...pack.receipt,
      evidenceUsed: pack.receipt.evidenceUsed.filter((id) => validEvidenceIds.has(id)),
      evidenceOmitted: pack.receipt.evidenceOmitted.filter((id) => validEvidenceIds.has(id)),
      laneFraming,
      unsupportedClaimsRefused: unique([
        ...pack.receipt.unsupportedClaimsRefused,
        ...(forceReview ? ["Context-only items withheld after evidence-safety review"] : [])
      ]),
      transferredClaims: safeParagraphArray(pack.receipt.transferredClaims)
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
    const lines = version.resumeText.split(/\r?\n/).flatMap((line): string[] => {
      if (!line.trim()) return [""];
      const bullet = line.match(/^([-•]\s*)/i)?.[1] ?? "";
      const cleaned = sanitizeProfessionalParagraph(line.replace(/^[-•]\s*/, ""));
      return cleaned ? [`${bullet}${cleaned}`] : [];
    });
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
  const profile = projectProfileFromDossier(dossier);
  profile.constraints = unique(
    dossier.constraints.filter((value) => {
      const category = classifyEvidenceAdmissibility(value);
      return category === "constraint" || category === "claim";
    })
  ).join("; ");
  return {
    ...next,
    profile,
    dossier,
    pendingImportReviews,
    resumePacks: next.resumePacks.map((pack) => sanitizePack(pack, dossier, forceReview)),
    resumeVersions: next.resumeVersions.map((version) => sanitizeVersion(version, forceReview))
  };
}
