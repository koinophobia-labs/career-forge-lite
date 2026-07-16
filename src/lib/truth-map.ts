import type { CommandCenterState } from "@/types/command-center";
import type { DossierEvidenceRecord, ResumeEvidenceReference, ResumeVariant } from "@/types/dossier";

export type EvidenceTruthMapEntry = {
  evidence: DossierEvidenceRecord;
  linkedRecords: string[];
  laneTitles: string[];
  resumeClaims: Array<{ variantTitle: string; claimText: string; supportType: ResumeEvidenceReference["supportType"]; stale: boolean }>;
  applicationAnswers: Array<{ applicationLabel: string; prompt: string }>;
  unused: boolean;
  stale: boolean;
};

export type ClaimTruthMapEntry = {
  variantId: string;
  variantTitle: string;
  laneTitle: string;
  kind: ResumeVariant["kind"];
  claimPath: string;
  claimText: string;
  supportType: ResumeEvidenceReference["supportType"];
  evidence: DossierEvidenceRecord[];
  userEdited: boolean;
  stale: boolean;
};

export type TruthMap = {
  evidenceFirst: EvidenceTruthMapEntry[];
  outputFirst: ClaimTruthMapEntry[];
  applicationAnswerCount: number;
};

export function deriveTruthMap(state: CommandCenterState): TruthMap {
  const approved = new Map(state.dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => [item.id, item]));
  const laneById = new Map(state.lanes.map((lane) => [lane.id, lane.title]));
  const allVariants = state.resumePacks.flatMap((pack) => pack.variants.map((variant) => ({
    variant,
    stale: pack.status === "out-of-date" || variant.status === "out-of-date" || variant.sourceDossierUpdatedAt < state.dossier.updatedAt
  })));
  const outputFirst = allVariants.flatMap(({ variant, stale }): ClaimTruthMapEntry[] => variant.evidenceReferences.map((reference) => ({
    variantId: variant.id,
    variantTitle: variant.title,
    laneTitle: laneById.get(variant.laneId) ?? "Unknown lane",
    kind: variant.kind,
    claimPath: reference.claimPath,
    claimText: reference.claimText,
    supportType: reference.supportType,
    evidence: reference.evidenceIds.flatMap((id) => approved.get(id) ? [approved.get(id)!] : []),
    userEdited: variant.userEdited && (variant.userAuthoredPaths.includes(reference.claimPath) || variant.userAuthoredPaths.includes("document")),
    stale: stale || reference.evidenceIds.some((id) => !approved.has(id))
  })));
  const answers = state.applications.flatMap((application) => application.applicationQuestions.flatMap((answer) => answer.evidenceIds
    .filter((id) => approved.has(id))
    .map((evidenceId) => ({ evidenceId, applicationLabel: [application.roleTitle, application.company].filter(Boolean).join(" · ") || "Saved application", prompt: answer.prompt }))));
  const evidenceFirst = [...approved.values()].map((evidence): EvidenceTruthMapEntry => {
    const linkedRecords = [
      ...state.dossier.roles.filter((role) => role.evidenceIds.includes(evidence.id)).map((role) => [role.title, role.employer].filter(Boolean).join(" · ")),
      ...state.dossier.projects.filter((project) => project.evidenceIds.includes(evidence.id)).map((project) => project.name)
    ];
    const claims = outputFirst.filter((claim) => claim.evidence.some((item) => item.id === evidence.id));
    const applicationAnswers = answers.filter((answer) => answer.evidenceId === evidence.id).map(({ applicationLabel, prompt }) => ({ applicationLabel, prompt }));
    return {
      evidence,
      linkedRecords,
      laneTitles: [...new Set(claims.map((claim) => claim.laneTitle))],
      resumeClaims: claims.map((claim) => ({ variantTitle: claim.variantTitle, claimText: claim.claimText, supportType: claim.supportType, stale: claim.stale })),
      applicationAnswers,
      unused: claims.length === 0 && applicationAnswers.length === 0,
      stale: claims.some((claim) => claim.stale)
    };
  });
  return { evidenceFirst, outputFirst, applicationAnswerCount: answers.length };
}
