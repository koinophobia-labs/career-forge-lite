import { completeRoleSprint, syncRoleSprintsWithEvidence } from "@/lib/role-sprint";
import type { CommandCenterState } from "@/types/command-center";

export function submitRoleSprintForReview(
  state: CommandCenterState,
  sprintId: string,
  userWork: string,
  nowIso: string
): ReturnType<typeof completeRoleSprint> {
  const previousSprint = state.roleSprints.find((item) => item.id === sprintId);
  const previousEvidence = previousSprint?.evidenceId
    ? state.dossier.evidence.find((item) => item.id === previousSprint.evidenceId)
    : null;
  const result = completeRoleSprint(state, sprintId, userWork, nowIso);
  if (!result.ok || !previousEvidence?.rejected) return result;

  // A revised rejected submission is a new review attempt, even when its stable
  // evidence ID matches the earlier excerpt. It must return to pending.
  const evidenceList = result.state.dossier.evidence
    .filter((item) => item.id !== previousEvidence.id || item.id === result.evidence.id)
    .map((item) => item.id === result.evidence.id
      ? { ...item, approved: false, rejected: false, updatedAt: nowIso }
      : item);
  const stateWithPending = {
    ...result.state,
    dossier: { ...result.state.dossier, evidence: evidenceList },
    roleSprints: syncRoleSprintsWithEvidence(result.state.roleSprints, evidenceList, nowIso)
  };
  return {
    ...result,
    state: stateWithPending,
    sprint: stateWithPending.roleSprints.find((item) => item.id === sprintId) ?? result.sprint,
    evidence: evidenceList.find((item) => item.id === result.evidence.id) ?? result.evidence
  };
}

export function reviewRoleSprintEvidence(
  state: CommandCenterState,
  sprintId: string,
  approved: boolean,
  nowIso: string
): CommandCenterState {
  const sprint = state.roleSprints.find((item) => item.id === sprintId);
  if (!sprint?.evidenceId) return state;
  const evidenceList = state.dossier.evidence.map((item) => item.id === sprint.evidenceId
    ? { ...item, approved, rejected: !approved, updatedAt: nowIso }
    : item);
  const approvedClaims = [...new Set(evidenceList.filter((item) => item.approved && !item.rejected).map((item) => item.detail))];

  if (!approved) {
    // Rejecting a pending item does not change the evidence that existing résumé
    // packs were built from, so it must not mark those packs stale.
    return {
      ...state,
      dossier: { ...state.dossier, evidence: evidenceList, approvedClaims },
      roleSprints: syncRoleSprintsWithEvidence(state.roleSprints, evidenceList, nowIso)
    };
  }

  const dossier = { ...state.dossier, evidence: evidenceList, approvedClaims, updatedAt: nowIso };
  const resumePacks = state.resumePacks.map((pack) => {
    if (pack.dossierId !== dossier.id || pack.updatedAt >= dossier.updatedAt) return pack;
    return {
      ...pack,
      status: "out-of-date" as const,
      variants: pack.variants.map((variant) => variant.sourceDossierUpdatedAt < dossier.updatedAt
        ? { ...variant, status: "out-of-date" as const }
        : variant)
    };
  });
  return {
    ...state,
    dossier,
    resumePacks,
    roleSprints: syncRoleSprintsWithEvidence(state.roleSprints, evidenceList, nowIso)
  };
}
