import type { CommandCenterState } from "@/types/command-center";

// Founding-user pilot summary: timings, counts, and dispositions ONLY.
//
// Hard privacy rule: this summary must never contain résumé content — no
// claim text, no evidence details, no names, employers, dates-of-employment,
// or generated document text. Everything here is a count or a timestamp
// already implied by using the product. The user reviews the JSON before
// sending it; nothing is transmitted automatically.

export type PilotSummary = {
  schema: "career-forge-pilot-summary-v1";
  generatedAt: string;
  consent: true;
  journey: {
    dossierStartedAt: string | null;
    firstEvidenceApprovedAt: string | null;
    firstPackGeneratedAt: string | null;
    firstExportAt: string | null;
    minutesFromStartToFirstApprovedEvidence: number | null;
    minutesFromStartToFirstExport: number | null;
  };
  counts: {
    approvedEvidence: number;
    rejectedEvidence: number;
    activeLanes: number;
    generatedVariants: number;
    userEditedVariants: number;
    userEditedFieldPaths: number;
    savedVersions: number;
    exports: number;
    exportedFiles: number;
    applicationsTracked: number;
    outreachContacts: number;
  };
  integrity: {
    packsNeedingReview: number;
    claimsRefusedByGenerator: number;
    wrongCategoryItemsCaught: number;
  };
};

const MIN_REAL_TIMESTAMP = Date.UTC(2000, 0, 1);
const INTEGRITY_MARKER = /^Career Forge integrity metric: imported ([^;]+); (\d+) context-only imported item\(s\)/;

function validTimestamp(value: string | null | undefined): value is string {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= MIN_REAL_TIMESTAMP;
}

function minutesBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const minutes = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000;
  return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null;
}

function earliest(values: Array<string | null | undefined>): string | null {
  const valid = values.filter(validTimestamp).sort();
  return valid[0] ?? null;
}

function durableIntegrity(state: CommandCenterState): { importedAt: string[]; wrongCategoryItemsCaught: number } {
  const markers = state.dossier.migrationReview.flatMap((item) => {
    const match = item.match(INTEGRITY_MARKER);
    return match ? [{ importedAt: match[1], count: Number(match[2]) }] : [];
  });
  const pendingCaught = state.pendingImportReviews.reduce(
    (total, batch) => total + batch.proposals.filter((proposal) =>
      proposal.status !== "proposed" && proposal.group === "other" && (proposal.kind === "goal" || proposal.kind === "constraint")
    ).length,
    0
  );
  return {
    importedAt: markers.map((item) => item.importedAt),
    wrongCategoryItemsCaught: markers.reduce((total, item) => total + item.count, 0) + pendingCaught
  };
}

export function buildPilotSummary(state: CommandCenterState, nowIso: string): PilotSummary {
  const evidence = state.dossier.evidence;
  const approved = evidence.filter((item) => item.approved && !item.rejected);
  const integrity = durableIntegrity(state);
  const dossierStartedAt = earliest([
    state.dossier.createdAt,
    ...integrity.importedAt,
    ...evidence.map((item) => item.createdAt),
    ...state.pendingImportReviews.map((item) => item.importedAt),
    state.activeGoal?.selectedAt,
    ...state.lanes.map((item) => item.createdAt),
    ...state.resumePacks.map((item) => item.createdAt),
    ...state.resumeVersions.map((item) => item.createdAt),
    ...state.exports.map((item) => item.exportedAt)
  ]);
  // Evidence records are created when a Truth Inbox decision is committed or a
  // manual fact is approved. createdAt is immutable; updatedAt is not, so a
  // later edit can never rewrite the pilot's first-approval milestone.
  const firstEvidenceApprovedAt = earliest(approved.map((item) => item.createdAt));
  const firstPackGeneratedAt = earliest(state.resumePacks.map((pack) => pack.createdAt));
  const firstExportAt = earliest(state.exports.map((item) => item.exportedAt));
  const variants = state.resumePacks.flatMap((pack) => pack.variants);

  return {
    schema: "career-forge-pilot-summary-v1",
    generatedAt: nowIso,
    consent: true,
    journey: {
      dossierStartedAt,
      firstEvidenceApprovedAt,
      firstPackGeneratedAt,
      firstExportAt,
      minutesFromStartToFirstApprovedEvidence: minutesBetween(dossierStartedAt, firstEvidenceApprovedAt),
      minutesFromStartToFirstExport: minutesBetween(dossierStartedAt, firstExportAt)
    },
    counts: {
      approvedEvidence: approved.length,
      rejectedEvidence: evidence.filter((item) => item.rejected).length,
      activeLanes: state.lanes.filter((lane) => lane.status === "active").length,
      generatedVariants: variants.length,
      userEditedVariants: variants.filter((variant) => variant.userEdited).length,
      userEditedFieldPaths: variants.reduce((total, variant) => total + variant.userAuthoredPaths.length, 0),
      savedVersions: state.resumeVersions.length,
      exports: state.exports.length,
      exportedFiles: state.exports.reduce((total, item) => total + item.filenames.length, 0),
      applicationsTracked: state.applications.length,
      outreachContacts: state.outreach.length
    },
    integrity: {
      packsNeedingReview: state.resumePacks.filter((pack) => pack.status === "needs-review").length,
      claimsRefusedByGenerator: state.resumePacks.reduce((total, pack) => total + pack.receipt.unsupportedClaimsRefused.length, 0),
      wrongCategoryItemsCaught: integrity.wrongCategoryItemsCaught
    }
  };
}

// Guard used by tests and the settings UI: fails closed if any résumé-content
// field ever leaks into the summary shape.
const FORBIDDEN_SUMMARY_KEYS = ["detail", "claimText", "resume", "summary", "bullets", "fullName", "email", "evidence", "title", "company"];
export function pilotSummaryContainsContent(summary: PilotSummary): boolean {
  const check = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(check);
    if (value && typeof value === "object") {
      return Object.entries(value).some(([key, child]) => FORBIDDEN_SUMMARY_KEYS.includes(key) || check(child));
    }
    return false;
  };
  return check(summary);
}
