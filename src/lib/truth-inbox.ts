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
  const normalizedProposals = preselectClearImportProposals(proposals.map(normalizeImportProposal));
  const sourceFileCount = unique(normalizedProposals.flatMap((item) => item.sourceFilenames)).length;
  const storedProposals = normalizedProposals.map((proposal) => retainSourceFilenames ? proposal : { ...proposal, sourceFilenames: [] });
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
  const safeAdditions = normalizedAdditions.map((proposal) => batch.retainSourceFilenames ? proposal : { ...proposal, sourceFilenames: [] });
  const byKey = new Map(batch.proposals.map((item) => [`${item.group}|${normalized(item.detail)}`, item]));
  for (const addition of safeAdditions) {
    const key = `${addition.group}|${normalized(addition.detail)}`;
    const previous = byKey.get(key);
    if (previous) {
      byKey.set(key, {
        ...previous,
        sourceFilenames: unique([...previous.sourceFilenames, ...addition.sourceFilenames]),
        sourceExcerpts: unique([...previous.sourceExcerpts, ...addition.sourceExcerpts])
      });
    } else {
      byKey.set(key, addition);
    }
  }
  const proposals = preselectClearImportProposals([...byKey.values()]);
  return {
    ...batch,
    proposals,
    sourceFilenames: unique(proposals.flatMap((item) => item.sourceFilenames)),
    sourceFileCount: batch.retainSourceFilenames
      ? unique(proposals.flatMap((item) => item.sourceFilenames)).length
      : batch.sourceFileCount + addedSourceFileCount,
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
