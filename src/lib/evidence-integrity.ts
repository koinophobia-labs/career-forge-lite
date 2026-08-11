import { isProfessionalEvidence } from "@/lib/evidence-admissibility";
import { isUsable } from "@/lib/evidence-read";
import type { CareerDossier, DossierEvidenceRecord, ResumeEvidenceReference, ResumeVariant } from "@/types/dossier";

/**
 * Revision v1 canonicalization rules:
 * - normalize CRLF/CR to LF;
 * - trim leading/trailing whitespace on each line;
 * - collapse interior whitespace runs to one space;
 * - preserve case, punctuation, field order, array order and meaningful text;
 * - exclude timestamps and filenames because they do not support a claim.
 *
 * The canonical JSON is stored directly rather than behind a short hash. That
 * avoids making collision resistance part of the truth boundary and remains
 * local-only alongside the source text already present in backups.
 */
function canonicalText(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
}

function canonicalList(values: string[] | undefined): string[] {
  if (!values) return [];
  return values.map(canonicalText).filter(Boolean);
}

function associatedStructure(dossier: CareerDossier, evidenceId: string) {
  return {
    roles: dossier.roles
      .filter((role) => role.evidenceIds.includes(evidenceId))
      .map((role) => ({
        id: role.id,
        title: canonicalText(role.title),
        employer: canonicalText(role.employer),
        startDate: canonicalText(role.startDate),
        endDate: canonicalText(role.endDate),
        current: role.current,
        responsibilities: canonicalList(role.responsibilities),
        tools: canonicalList(role.tools),
        outcomes: canonicalList(role.outcomes)
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    projects: dossier.projects
      .filter((project) => project.evidenceIds.includes(evidenceId))
      .map((project) => ({
        id: project.id,
        name: canonicalText(project.name),
        organization: canonicalText(project.organization),
        dates: canonicalText(project.dates),
        description: canonicalText(project.description),
        responsibilities: canonicalList(project.responsibilities),
        tools: canonicalList(project.tools),
        outcomes: canonicalList(project.outcomes),
        metrics: canonicalList(project.metrics),
        links: canonicalList(project.links),
        defaultPlacement: project.defaultPlacement
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    education: dossier.education
      .filter((education) => education.evidenceIds.includes(evidenceId))
      .map((education) => ({
        id: education.id,
        institution: canonicalText(education.institution),
        credential: canonicalText(education.credential),
        field: canonicalText(education.field),
        dates: canonicalText(education.dates)
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  };
}

export function evidenceRevision(record: DossierEvidenceRecord, dossier: CareerDossier): string {
  return `evidence-revision-v1:${JSON.stringify({
    kind: record.kind,
    label: canonicalText(record.label),
    detail: canonicalText(record.detail),
    roleId: record.roleId ?? null,
    source: record.source,
    sourceText: canonicalText(record.sourceText),
    sourceExcerpts: canonicalList(record.sourceExcerpts),
    confidence: record.confidence,
    approved: record.approved,
    rejected: record.rejected,
    disclosureReview: record.disclosureReview ?? null,
    disclosureReviewedText: canonicalText(record.disclosureReviewedText),
    structure: associatedStructure(dossier, record.id)
  })}`;
}

export function bindEvidenceRevisions(
  references: ResumeEvidenceReference[],
  dossier: CareerDossier
): ResumeEvidenceReference[] {
  const evidence = new Map(dossier.evidence.map((record) => [record.id, record]));
  return references.map((reference) => ({
    ...reference,
    evidenceRevisions: Object.fromEntries(reference.evidenceIds.flatMap((id) => {
      const record = evidence.get(id);
      return record ? [[id, evidenceRevision(record, dossier)]] : [];
    }))
  }));
}

export type EvidenceIntegrityReason =
  | "missing-revision-binding"
  | "evidence-changed"
  | "evidence-ineligible"
  | "evidence-missing"
  | "claim-needs-regeneration"
  | "user-authored-review-required";

export type EvidenceIntegrityIssue = {
  reason: EvidenceIntegrityReason;
  claimPath: string;
  claimText: string;
  evidenceId: string | null;
  evidenceLabel: string;
};

export type EvidenceIntegrityResult =
  | { valid: true; issues: []; checkedClaims: number }
  | { valid: false; issues: EvidenceIntegrityIssue[]; checkedClaims: number };

export function validateVariantEvidenceIntegrity(
  variant: ResumeVariant,
  dossier: CareerDossier
): EvidenceIntegrityResult {
  const evidence = new Map(dossier.evidence.map((record) => [record.id, record]));
  const reviewedUserPaths = new Set(variant.reviewedUserAuthoredPaths ?? []);
  const userPaths = new Set(variant.userAuthoredPaths);
  const issues: EvidenceIntegrityIssue[] = [];

  // Reconciliation intentionally drops a generated evidence reference when a
  // person edits that claim. Check the authored-path ledger independently so
  // losing the old reference cannot also lose the explicit review gate.
  for (const claimPath of userPaths) {
    if (reviewedUserPaths.has(claimPath)) continue;
    const reference = variant.evidenceReferences.find((candidate) => candidate.claimPath === claimPath);
    issues.push({
      reason: "user-authored-review-required",
      claimPath,
      claimText: reference?.claimText ?? "User-edited résumé text",
      evidenceId: null,
      evidenceLabel: "Your edited résumé text"
    });
  }

  for (const reference of variant.evidenceReferences) {
    if (userPaths.has(reference.claimPath)) continue;
    if (!reference.evidenceIds.length) {
      issues.push({ reason: "claim-needs-regeneration", claimPath: reference.claimPath, claimText: reference.claimText, evidenceId: null, evidenceLabel: "No source evidence" });
      continue;
    }
    for (const evidenceId of reference.evidenceIds) {
      const record = evidence.get(evidenceId);
      if (!record) {
        issues.push({ reason: "evidence-missing", claimPath: reference.claimPath, claimText: reference.claimText, evidenceId, evidenceLabel: "Missing evidence" });
        continue;
      }
      if (!isUsable(record) || !isProfessionalEvidence(record)) {
        issues.push({ reason: "evidence-ineligible", claimPath: reference.claimPath, claimText: reference.claimText, evidenceId, evidenceLabel: record.label || record.kind });
        continue;
      }
      const bound = reference.evidenceRevisions?.[evidenceId];
      if (!bound) {
        issues.push({ reason: "missing-revision-binding", claimPath: reference.claimPath, claimText: reference.claimText, evidenceId, evidenceLabel: record.label || record.kind });
        continue;
      }
      if (bound !== evidenceRevision(record, dossier)) {
        issues.push({ reason: "evidence-changed", claimPath: reference.claimPath, claimText: reference.claimText, evidenceId, evidenceLabel: record.label || record.kind });
      }
    }
  }

  // A generated variant with no references is not a trusted empty receipt.
  if (!variant.evidenceReferences.length && !variant.userAuthoredPaths.length) {
    issues.push({ reason: "missing-revision-binding", claimPath: "variant", claimText: variant.title, evidenceId: null, evidenceLabel: "Legacy generated output" });
  }

  return issues.length
    ? { valid: false, issues, checkedClaims: variant.evidenceReferences.length }
    : { valid: true, issues: [], checkedClaims: variant.evidenceReferences.length };
}

export function assertVariantEvidenceIntegrity(variant: ResumeVariant, dossier: CareerDossier): void {
  const result = validateVariantEvidenceIntegrity(variant, dossier);
  if (result.valid) return;
  const first = result.issues[0];
  throw new Error(`Export blocked: ${first.evidenceLabel} ${first.reason.replaceAll("-", " ")}. Regenerate or review this résumé before using it.`);
}

export function evidenceIntegrityMessage(result: EvidenceIntegrityResult): string | null {
  if (result.valid) return null;
  const first = result.issues[0];
  const more = result.issues.length > 1 ? ` ${result.issues.length - 1} additional claim issue(s) are also blocked.` : "";
  if (first.reason === "missing-revision-binding") {
    return `This saved output predates evidence-revision checks. Regenerate it before copying, exporting, printing, or tailoring.${more}`;
  }
  if (first.reason === "user-authored-review-required") {
    return `Review and confirm your edited field (${first.claimPath}) before taking this résumé out of Career Forge.${more}`;
  }
  if (first.reason === "evidence-changed") {
    return `Source evidence changed after generation (${first.evidenceLabel}, used by ${first.claimPath}). Regenerate this résumé before using it.${more}`;
  }
  return `Evidence for ${first.claimPath} is missing or no longer eligible (${first.evidenceLabel}). Regenerate this résumé before using it.${more}`;
}
