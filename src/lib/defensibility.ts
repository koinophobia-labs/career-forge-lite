import type { CareerDossier, PackGenerationReceipt, ResumeVariant } from "@/types/dossier";

export type DefensibilityStatus = "Fully traced" | "Traced with transfers" | "Needs evidence review" | "User-edited, recheck required";

export type DefensibilityReceipt = {
  totalClaims: number;
  directlySupported: number;
  combinedEvidence: number;
  transferred: number;
  missingProvenance: number;
  incompleteProvenance: number;
  verifiedDurations: number;
  unverifiedDurations: number;
  userEditedClaimsNeedingReview: number;
  status: DefensibilityStatus;
};

type Claim = { path: string; text: string };

function claimsForVariant(variant: ResumeVariant): Claim[] {
  const claims: Claim[] = [];
  const add = (path: string, text: string) => { if (text.trim()) claims.push({ path, text }); };
  add("summary", variant.resume.summary);
  variant.resume.coreSkills.forEach((text, index) => add(`coreSkills.${index}`, text));
  variant.resume.experience.forEach((role, roleIndex) => {
    add(`experience.${roleIndex}.heading`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((text, index) => add(`experience.${roleIndex}.bullets.${index}`, text));
  });
  add("education", variant.resume.education);
  add("linkedinHeadline", variant.resume.linkedinHeadline);
  add("linkedinSummary", variant.resume.linkedinSummary);
  return claims;
}

function yearTokens(value: string): string[] {
  return value.match(/(?:19|20)\d{2}|present|current/gi)?.map((item) => item.toLowerCase()) ?? [];
}

export function deriveDefensibilityReceipt(variant: ResumeVariant, dossier: CareerDossier): DefensibilityReceipt {
  const claims = claimsForVariant(variant);
  const approved = new Map(dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => [item.id, item]));
  const incompletePaths = new Set(variant.evidenceReferences.filter((reference) =>
    reference.evidenceIds.length === 0 || reference.evidenceIds.some((id) => !approved.has(id))
  ).map((reference) => reference.claimPath));
  const validReferences = variant.evidenceReferences.filter((reference) =>
    !incompletePaths.has(reference.claimPath) && reference.evidenceIds.length > 0 && reference.evidenceIds.every((id) => approved.has(id))
  );
  const validByPath = new Map(validReferences.map((reference) => [reference.claimPath, reference]));
  const missing = claims.filter((claim) => !validByPath.has(claim.path));
  const incompleteProvenance = missing.filter((claim) => incompletePaths.has(claim.path)).length;
  const durationClaims = claims.filter((claim) => yearTokens(claim.text).length > 0);
  const verifiedDurations = durationClaims.filter((claim) => {
    const reference = validByPath.get(claim.path);
    if (!reference) return false;
    const wanted = yearTokens(claim.text);
    const source = reference.evidenceIds.flatMap((id) => yearTokens(approved.get(id)?.detail ?? ""));
    return wanted.every((token) => source.includes(token));
  }).length;
  const userEditedClaimsNeedingReview = variant.userEdited
    ? Math.max(1, variant.userAuthoredPaths.filter((path) => path !== "undo").length)
    : 0;
  const status: DefensibilityStatus = missing.length
    ? "Needs evidence review"
    : userEditedClaimsNeedingReview
      ? "User-edited, recheck required"
      : validReferences.some((reference) => reference.supportType === "transferred")
        ? "Traced with transfers"
        : "Fully traced";
  return {
    totalClaims: claims.length,
    directlySupported: validReferences.filter((reference) => reference.supportType === "direct").length,
    combinedEvidence: validReferences.filter((reference) => reference.supportType === "combined").length,
    transferred: validReferences.filter((reference) => reference.supportType === "transferred").length,
    missingProvenance: missing.length,
    incompleteProvenance,
    verifiedDurations,
    unverifiedDurations: durationClaims.length - verifiedDurations,
    userEditedClaimsNeedingReview,
    status
  };
}

export function uniqueUnclaimedReceiptItems(receipt: PackGenerationReceipt): string[] {
  return [...new Set([...receipt.gapsLeftUnclaimed, ...receipt.unsupportedClaimsRefused].map((item) => item.trim()).filter(Boolean))];
}
