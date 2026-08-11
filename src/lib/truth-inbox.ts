import { withUpdatedDossier } from "@/lib/dossier";
import { mergeSafeImportProposals, normalizeImportProposal } from "@/lib/evidence-admissibility";
import type { CommandCenterState } from "@/types/command-center";
import type { ImportProposalRecord, PendingImportReview } from "@/types/dossier";

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

const clearPreselectKinds = new Set<ImportProposalRecord["kind"]>([
  "identity",
  "role",
  "project",
  "education",
  "responsibility",
  "tool",
  "skill"
]);

export function isClearImportProposal(proposal: ImportProposalRecord): boolean {
  return proposal.status === "proposed" &&
    proposal.confidence === "high" &&
    proposal.group !== "other" &&
    proposal.group !== "identity" &&
    proposal.validation === "valid" &&
    proposal.reviewRequired !== true &&
    !proposal.conflictGroup &&
    clearPreselectKinds.has(proposal.kind) &&
    !proposal.edited &&
    !proposal.likelyDuplicateOf &&
    proposal.detail.trim().length >= 2 &&
    proposal.sourceExcerpts.some((excerpt) => excerpt.trim().length > 0);
}

export function preselectClearImportProposals(proposals: ImportProposalRecord[]): ImportProposalRecord[] {
  return proposals.map((proposal) => isClearImportProposal(proposal)
    ? { ...proposal, status: "approved" as const }
    : proposal);
}

export type TruthInboxCounts = {
  approved: number;
  rejected: number;
  proposed: number;
  total: number;
};

export function truthInboxCounts(batch: PendingImportReview): TruthInboxCounts {
  return {
    approved: batch.proposals.filter((item) => item.status === "approved").length,
    rejected: batch.proposals.filter((item) => item.status === "rejected").length,
    proposed: batch.proposals.filter((item) => item.status === "proposed").length,
    total: batch.proposals.length
  };
}

export function createPendingImportReview(
  id: string,
  proposals: ImportProposalRecord[],
  nowIso: string,
  retainSourceFilenames: boolean
): PendingImportReview {
  const normalizedProposals = preselectClearImportProposals(
    proposals.map(normalizeImportProposal).filter((proposal) =>
      proposal.proposedField !== "structure" &&
      proposal.validation !== "structural" &&
      proposal.validation !== "noise"
    )
  );
  const sourceFileCount = unique(normalizedProposals.flatMap((item) => item.sourceFilenames)).length;
  // Filenames stay available while conflicts are being reviewed. The privacy
  // choice controls durable dossier evidence at commit time, not whether the
  // user can tell two pending source values apart.
  const storedProposals = normalizedProposals;
  return {
    version: 1,
    id,
    proposals: storedProposals,
    sourceFilenames: unique(storedProposals.flatMap((item) => item.sourceFilenames)),
    sourceFileCount,
    retainSourceFilenames,
    importedAt: nowIso,
    updatedAt: nowIso
  };
}

export function addProposalsToReview(
  batch: PendingImportReview,
  additions: ImportProposalRecord[],
  nowIso: string
): PendingImportReview {
  const normalizedAdditions = additions.map(normalizeImportProposal);
  const addedSourceFileCount = unique(normalizedAdditions.flatMap((item) => item.sourceFilenames)).length;
  const safeAdditions = normalizedAdditions.filter((proposal) =>
    proposal.proposedField !== "structure" &&
    proposal.validation !== "structural" &&
    proposal.validation !== "noise"
  );
  const byKey = new Map(batch.proposals.map((item) => [`${item.proposedField ?? item.group}|${normalized(item.candidateValue ?? item.detail)}`, item]));
  for (const addition of safeAdditions) {
    const key = `${addition.proposedField ?? addition.group}|${normalized(addition.candidateValue ?? addition.detail)}`;
    const previous = byKey.get(key);
    if (previous) {
      byKey.set(key, {
        ...previous,
        sourceFilenames: unique([...previous.sourceFilenames, ...addition.sourceFilenames]),
        sourceExcerpts: unique([...previous.sourceExcerpts, ...addition.sourceExcerpts]),
        sourcePositions: [...new Set([...(previous.sourcePositions ?? []), ...(addition.sourcePositions ?? [])])],
        occurrenceCount: (previous.occurrenceCount ?? 1) + (addition.occurrenceCount ?? 1),
        disposition: previous.validation === "valid" ? "duplicate-candidate" : previous.disposition
      });
    } else {
      byKey.set(key, addition);
    }
  }
  const proposals = [...byKey.values()];
  for (const field of ["identity.fullName", "identity.email", "identity.phone", "identity.location"] as const) {
    const conflicts = proposals.filter((proposal) => proposal.proposedField === field);
    if (conflicts.length <= 1) continue;
    conflicts.forEach((proposal) => {
      proposal.validation = "conflicting";
      proposal.disposition = "conflicting-candidate";
      proposal.conflictGroup = `conflict-${field}`;
      proposal.reviewRequired = true;
      proposal.status = "proposed";
      proposal.classificationReasons = unique([...(proposal.classificationReasons ?? []), `Multiple different ${field.replace("identity.", "")} values require an explicit choice.`]);
    });
  }
  const roleGroups = new Map<string, ImportProposalRecord[]>();
  proposals.filter((proposal) => proposal.roleCandidate).forEach((proposal) => {
    const role = proposal.roleCandidate!;
    const key = `${normalized(role.title)}|${normalized(role.employer)}`;
    roleGroups.set(key, [...(roleGroups.get(key) ?? []), proposal]);
  });
  for (const [key, roles] of roleGroups) {
    if (roles.length <= 1 || new Set(roles.map((proposal) => normalized(proposal.roleCandidate?.dates ?? ""))).size <= 1) continue;
    roles.forEach((proposal) => {
      proposal.validation = "conflicting";
      proposal.disposition = "conflicting-candidate";
      proposal.conflictGroup = `conflict-role-${key}`;
      proposal.reviewRequired = true;
      proposal.status = "proposed";
      proposal.classificationReasons = unique([...(proposal.classificationReasons ?? []), "The same employer/title appears with different chronology."]);
    });
  }
  const preselected = preselectClearImportProposals(proposals);
  return {
    ...batch,
    proposals: preselected,
    sourceFilenames: unique(preselected.flatMap((item) => item.sourceFilenames)),
    sourceFileCount: unique(preselected.flatMap((item) => item.sourceFilenames)).length || batch.sourceFileCount + addedSourceFileCount,
    updatedAt: nowIso
  };
}

export type TruthInboxCommit = {
  state: CommandCenterState;
  approved: number;
  rejected: number;
  remaining: number;
  completed: boolean;
  changed: boolean;
};

export function commitTruthInboxReview(
  state: CommandCenterState,
  batchId: string,
  nowIso: string
): TruthInboxCommit {
  const batch = state.pendingImportReviews.find((item) => item.id === batchId);
  if (!batch) return { state, approved: 0, rejected: 0, remaining: 0, completed: false, changed: false };
  const decided = batch.proposals.filter((item) => item.status !== "proposed");
  const remaining = batch.proposals.filter((item) => item.status === "proposed");
  if (!decided.length) {
    return { state, approved: 0, rejected: 0, remaining: remaining.length, completed: false, changed: false };
  }

  const mergedDossier = mergeSafeImportProposals(state.dossier, decided, nowIso, batch.retainSourceFilenames);
  const contextOnlyCaught = decided.filter((item) =>
    item.group === "other" && (item.kind === "goal" || item.kind === "constraint")
  ).length;
  // The completed queue is removed, so preserve only a content-free aggregate
  // and the import-start timestamp. This keeps pilot metrics durable without
  // retaining résumé text or a shadow analytics database.
  const integrityMarker = contextOnlyCaught > 0
    ? `Career Forge integrity metric: imported ${batch.importedAt}; ${contextOnlyCaught} context-only imported item(s) separated from professional evidence in review ${batch.id}.`
    : "";
  const dossier = integrityMarker
    ? { ...mergedDossier, migrationReview: unique([...mergedDossier.migrationReview, integrityMarker]) }
    : mergedDossier;
  const nextWithDossier = withUpdatedDossier(state, dossier);
  const completed = remaining.length === 0;
  const pendingImportReviews = completed
    ? state.pendingImportReviews.filter((item) => item.id !== batchId)
    : state.pendingImportReviews.map((item) => item.id === batchId
      ? { ...item, proposals: remaining, updatedAt: nowIso }
      : item);
  return {
    state: { ...nextWithDossier, pendingImportReviews },
    approved: decided.filter((item) => item.status === "approved").length,
    rejected: decided.filter((item) => item.status === "rejected").length,
    remaining: remaining.length,
    completed,
    changed: true
  };
}

export function discardTruthInboxReview(state: CommandCenterState, batchId: string): CommandCenterState {
  return { ...state, pendingImportReviews: state.pendingImportReviews.filter((item) => item.id !== batchId) };
}
