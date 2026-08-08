/**
 * EMPLOYMENT STRUCTURE — identity is not a claim.
 *
 * Cluster C of the verified census: 9 findings, 5 of them P0, all one mistake.
 * Employer names, job titles and date ranges were being run through
 * `sanitizeProfessionalLine` — a classifier built to judge whether a RÉSUMÉ
 * CLAIM is defensible. It is the wrong instrument for the question:
 *
 *   "No Boundaries Training Ltd"  -> classified "gap" -> blanked
 *   "Parenta"                     -> blanked
 *   "Recovery Support Worker"     -> blanked
 *
 * Worse, `sanitizeCareerDossier` runs on every state READ and the result is
 * persisted, so the employer name was not merely withheld from one export — it
 * was destroyed on disk, and the next read had nothing left to recover from.
 *
 * The rule this module encodes:
 *
 *   Metadata that preserves the historical structure of employment must never
 *   be subjected to evidence admissibility as though it were a résumé claim.
 *
 * But "never classify these fields" is equally wrong in the other direction.
 * People type narrative into them:
 *
 *   currentCompany = "Wincanton (agency, until my position was cut)"
 *
 * Blessing that whole string because of the field it sits in prints a
 * separation reason as an employer name. Blanking it destroys the fact that
 * they worked at Wincanton. Neither is acceptable, so the field is not one
 * trusted-or-rejected blob. It is:
 *
 *   organization identity  +  optional user narrative
 *
 * The identity is structural and survives byte-for-byte. The narrative is
 * separated and handled by the disclosure lifecycle like any other thing the
 * user wrote about themselves — flagged, reviewable, never printed unresolved.
 * Structural parsing, not admissibility.
 */
import { possibleDisclosure } from "@/lib/truth-guards";

export type OrganizationField = {
  /** The structural fact: the employer, the job title, the dates. Never blanked by a classifier. */
  identity: string;
  /** Narrative the user appended to it, if any. Enters the disclosure lifecycle; never printed unresolved. */
  narrative: string;
};

/**
 * Boundaries where a person appends commentary to a name. Ordered so the
 * earliest genuine split wins.
 */
const BOUNDARIES = [
  /\s*\(([^)]*)\)\s*$/, // Wincanton (agency, until my position was cut)
  /\s+[—–-]\s+(.+)$/, //   DHL — laid off when the site shut
  /\s*,\s*(.+)$/ //        DHL, laid off when the site shut
];

/**
 * Split a structural field into identity and narrative.
 *
 * Deliberately conservative: a split happens ONLY when the trailing fragment is
 * flagged as a possible personal disclosure. "Marks & Spencer, Leeds" keeps its
 * comma — a location is part of the identity, and guessing otherwise would
 * quietly rewrite employer names. When in doubt the whole value is identity,
 * because the cost of an unsplit narrative is a review prompt while the cost of
 * an over-eager split is a corrupted employment record.
 */
export function parseOrganizationField(value: string): OrganizationField {
  const raw = (value ?? "").trim();
  if (!raw) return { identity: "", narrative: "" };

  for (const boundary of BOUNDARIES) {
    const match = raw.match(boundary);
    if (!match) continue;
    const tail = (match[1] ?? "").trim();
    const head = raw.slice(0, match.index).trim();
    if (!head || !tail) continue;
    if (!possibleDisclosure(tail)) continue;
    return { identity: head, narrative: tail };
  }

  // No narrative boundary found. If the WHOLE value reads as a disclosure there
  // is no identity to keep — that is a review state, not a licence to invent
  // one. The caller surfaces it; nothing is deleted.
  if (possibleDisclosure(raw)) return { identity: "", narrative: raw };

  return { identity: raw, narrative: "" };
}

/** The structural identity only. This is what a document may print. */
export function organizationIdentity(value: string): string {
  return parseOrganizationField(value).identity;
}

type RoleLike = { title?: string; employer?: string; startDate?: string; endDate?: string };

/**
 * C2 — THE PERSISTENCE INVARIANT.
 *
 * Saving, editing, generating, rejecting evidence or resolving a review can
 * never erase an employment container. A role may legitimately have zero usable
 * bullets and still be a job the person held. It survives as long as ANY
 * structural field identifies it.
 */
export function roleHasStructure(role: RoleLike): boolean {
  return Boolean(
    (role.title ?? "").trim() ||
      (role.employer ?? "").trim() ||
      (role.startDate ?? "").trim() ||
      (role.endDate ?? "").trim()
  );
}

/* ------------------------------------------------------------------------- *
 * C3 — RECOVERY MIGRATION
 *
 * Structural fields were destroyed on disk by earlier reads. This recovers what
 * can be recovered from authoritative history that already exists, and refuses
 * to guess the rest.
 *
 * The refusal is the important half. If the product knows
 *
 *   employer = ""
 *   bullets  = ["Managed inventory for a regional gym chain"]
 *
 * it cannot conclude the company was No Boundaries Training Ltd. Reconstructing
 * an employer from generated text would be the same fabrication the whole audit
 * exists to prevent, arriving through the back door of a repair. So recovery
 * draws ONLY on preserved historical records of the field itself, and anything
 * else becomes a question for the user.
 * ------------------------------------------------------------------------- */

export type StructuralField = "title" | "employer" | "dates";
export type RecoveryStatus = "recovered" | "candidate" | "unrecoverable";

export type StructuralReview = {
  field: StructuralField;
  status: RecoveryStatus;
  /** Where an automatically restored value came from. */
  recoveredFrom?: string;
  /** Conflicting historical values, for the user to choose between. */
  candidates?: string[];
};

type HistoricalRole = { title?: string; company?: string; time?: string };

/**
 * Historical structural values, harvested from saved résumé snapshots. These
 * are records of what the field HELD, not text generated about it.
 */
export function harvestHistoricalRoles(state: {
  resumeVersions?: Array<{ resumeSnapshot?: { resume?: { experience?: HistoricalRole[] } } | null }>;
}): HistoricalRole[] {
  const out: HistoricalRole[] = [];
  for (const version of state.resumeVersions ?? []) {
    for (const role of version.resumeSnapshot?.resume?.experience ?? []) {
      if (role && (role.title || role.company)) out.push(role);
    }
  }
  return out;
}

const norm = (value: string | undefined) => (value ?? "").trim().toLowerCase();

/**
 * Historical entries that plausibly describe THIS role. Matched on a surviving
 * structural field only — never on bullet text, which is generated prose and
 * would let a rewritten sentence decide who the user worked for.
 */
function historyFor(role: { title?: string; employer?: string }, history: HistoricalRole[]): HistoricalRole[] {
  const title = norm(role.title);
  const employer = norm(role.employer);
  if (!title && !employer) return [];
  return history.filter(
    (item) => (title && norm(item.title) === title) || (employer && norm(item.company) === employer)
  );
}

function decide(values: string[]): { status: RecoveryStatus; value?: string; candidates?: string[] } {
  const distinct = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (distinct.length === 1) return { status: "recovered", value: distinct[0] };
  if (distinct.length > 1) return { status: "candidate", candidates: distinct };
  return { status: "unrecoverable" };
}

export type RecoveredRole<T> = T & { structuralReview?: StructuralReview[] };

/**
 * Restore destroyed structural fields where history is unambiguous, mark them
 * for the user where it is not, and never invent one.
 *
 * IDEMPOTENT BY CONSTRUCTION: recovery is a pure function of the current state.
 * A field that has been restored is no longer empty, so the second run finds
 * nothing to do; review markers are REPLACED rather than appended, so they
 * cannot accumulate. Running the migration twice changes nothing the second
 * time — no progressively "cleaner" dossier, no repeated rewriting.
 */
export function recoverRoleStructure<T extends { title?: string; employer?: string; startDate?: string; endDate?: string }>(
  role: T,
  history: HistoricalRole[]
): RecoveredRole<T> {
  const candidates = historyFor(role, history);
  const reviews: StructuralReview[] = [];
  const next: Record<string, unknown> = { ...role };

  if (!(role.employer ?? "").trim()) {
    const outcome = decide(candidates.map((item) => item.company ?? ""));
    if (outcome.status === "recovered" && outcome.value) {
      next.employer = outcome.value;
      reviews.push({ field: "employer", status: "recovered", recoveredFrom: "saved résumé version" });
    } else {
      reviews.push({ field: "employer", status: outcome.status, candidates: outcome.candidates });
    }
  }

  if (!(role.title ?? "").trim()) {
    const outcome = decide(candidates.map((item) => item.title ?? ""));
    if (outcome.status === "recovered" && outcome.value) {
      next.title = outcome.value;
      reviews.push({ field: "title", status: "recovered", recoveredFrom: "saved résumé version" });
    } else {
      reviews.push({ field: "title", status: outcome.status, candidates: outcome.candidates });
    }
  }

  // Idempotency, carefully. The first run restores a field AND records that it
  // did so; the second run sees an intact field, computes no reviews, and would
  // delete that record — which is a change, and loses the user's only trace
  // that the product edited their employment history.
  //
  // So a prior "recovered" note is CARRIED FORWARD, and reviews are keyed by
  // field rather than appended. Run two is then a genuine no-op: nothing
  // rewritten, nothing accumulated, nothing quietly tidied away.
  const prior = ((role as { structuralReview?: StructuralReview[] }).structuralReview ?? []).filter(
    (entry) => entry.status === "recovered"
  );
  const byField = new Map<StructuralField, StructuralReview>();
  for (const entry of [...prior, ...reviews]) byField.set(entry.field, entry);
  const merged = [...byField.values()];
  if (merged.length) next.structuralReview = merged;
  else delete next.structuralReview;

  return next as RecoveredRole<T>;
}
