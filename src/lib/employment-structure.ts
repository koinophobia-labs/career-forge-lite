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
  /**
   * The parser suspects something is mixed in but could not confidently split
   * it. The value is returned WHOLE and unaltered; this flags it for review.
   * Uncertainty is a reason to ask, never a reason to blank.
   */
  uncertain?: boolean;
};

/**
 * Boundaries where a person appends commentary to a name. Ordered so the
 * earliest genuine split wins.
 */
const TARGETING =
  /^\s*(?:target(?:ed|ing)?|preferred|desired|ideal)\s+roles?\s*:|^\s*(?:seeking|looking for|interested in|targeting|open to|available for)\b|^\s*(?:i(?:'m| am)?\s+)?(?:want|hoping|aiming)\s+to\b/i;

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

  // TARGETING TEXT IS NEVER AN ORGANISATION NAME. "Target roles: driver",
  // "Seeking warehouse work", "Looking for admin roles" typed into the employer
  // box are statements about where the user wants to go, not a record of where
  // they have been. Unlike a disclosure phrase — which can be a genuine part of
  // a real job title, as in "Maternity Leave Cover Teacher" — a targeting
  // statement has no structural identity inside it to preserve.
  if (TARGETING.test(raw)) return { identity: "", narrative: raw };

  // UNCERTAIN STRUCTURE REMAINS USER STRUCTURE.
  //
  // This used to return identity:"" when the whole value tripped the disclosure
  // classifier with no delimiter to split on. That erased real job titles whole
  // — "Maternity Leave Cover Teacher", "Bereavement Leave Administrator",
  // "Sick Leave Cover Supervisor" — because a classifier built to spot personal
  // disclosure cannot tell somebody disclosing their own leave from somebody
  // whose JOB is covering other people's.
  //
  // The parser is allowed to separate identity from narrative when it has
  // evidence to do so: a delimiter with a flagged tail. Without that evidence
  // it has no basis for surgery, so the value comes back whole and carries a
  // flag. Blanking is not the cautious option — it is a silent edit to somebody
  // s employment record.
  if (possibleDisclosure(raw)) return { identity: raw, narrative: "", uncertain: true };

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
const DATE_RANGE = /^(?:[a-z]{3,9}\.?\s*)?\d{4}\s*[-–—]\s*(?:present|current|[a-z]{3,9}\.?\s*)?\d{0,4}$|^\d{4}$/i;

/**
 * Historical structural values, grouped BY SAVED VERSION.
 *
 * Grouping matters. A single saved version records the same job twice — once as
 * a structured snapshot and once as the rendered "Title | Employer | Dates"
 * line — and the pre-fix build damaged those two copies differently, blanking
 * the snapshot's company while leaving the rendered line alone. Treated as two
 * independent sources, one blank and one populated look like a disagreement.
 * Treated as one version, they are one fact with one surviving witness.
 *
 * A conflict is two VERSIONS that disagree, not two representations of one.
 */
export function harvestHistoricalRoles(state: {
  resumeVersions?: Array<{ resumeText?: string; resumeSnapshot?: { resume?: { experience?: HistoricalRole[] } } | null }>;
}): HistoricalRole[][] {
  const versions: HistoricalRole[][] = [];
  for (const version of state.resumeVersions ?? []) {
    const entries: HistoricalRole[] = [];
    for (const role of version.resumeSnapshot?.resume?.experience ?? []) {
      if (role && (role.title || role.company)) entries.push(role);
    }
    for (const line of (version.resumeText ?? "").split(/\r?\n/)) {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      if (/^[-•]/.test(parts[0])) continue;
      // "Title | 2018 - 2024" is a heading whose employer was already destroyed
      // before it was rendered. Reading the date range as the company name
      // would restore "2018 - 2024" as somebody's employer.
      const company = DATE_RANGE.test(parts[1]) ? undefined : parts[1];
      const time = DATE_RANGE.test(parts[1]) ? parts[1] : parts[2];
      entries.push({ title: parts[0], company, time });
    }
    if (entries.length) versions.push(entries);
  }
  return versions;
}

const norm = (value: string | undefined) => (value ?? "").trim().toLowerCase();

/**
 * Historical entries that plausibly describe THIS role. Matched on a surviving
 * structural field only — never on bullet text, which is generated prose and
 * would let a rewritten sentence decide who the user worked for.
 */
function historyFor(role: { title?: string; employer?: string }, versions: HistoricalRole[][]): HistoricalRole[][] {
  const title = norm(role.title);
  const employer = norm(role.employer);
  if (!title && !employer) return [];
  return versions
    .map((entries) =>
      entries.filter((item) => (title && norm(item.title) === title) || (employer && norm(item.company) === employer))
    )
    .filter((entries) => entries.length);
}

/**
 * Decide from the historical values found for one field.
 *
 * `matched` is how many historical entries describe this role; `values` is what
 * they held. When those differ, some entries were BLANKED — and that changes
 * everything, because the pre-fix build damaged saved snapshots by exactly the
 * same mechanism it used on the live record. Real scar tissue proved it:
 *
 *   snapshot 1: company "" (destroyed)
 *   snapshot 2: company "No Boundaries Ltd"
 *
 * Treating that as unanimous silently restored a variant spelling as the
 * confident answer, and the true value — "No Boundaries Training Ltd", which
 * lived in the destroyed snapshot — was gone with nothing to signal it.
 *
 * So unanimity may only be claimed when NO matched entry is missing the field.
 * A survivor among blanks is a candidate to offer, never an answer to apply.
 */
function decide(perVersion: string[][]): { status: RecoveryStatus; value?: string; candidates?: string[] } {
  // One value per version: any surviving witness within a version speaks for it.
  const voices = perVersion.map((values) => values.map((v) => v.trim()).find(Boolean));
  const present = voices.filter((v): v is string => Boolean(v));
  const distinct = [...new Set(present)];
  // A version that records this role but retains NO value for the field had its
  // copy destroyed. It may have held a different employer, so the survivors are
  // candidates to offer rather than an answer to apply.
  const someDestroyed = voices.length > present.length;
  if (distinct.length === 1 && !someDestroyed) return { status: "recovered", value: distinct[0] };
  if (distinct.length >= 1) return { status: "candidate", candidates: distinct };
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
  history: HistoricalRole[][]
): RecoveredRole<T> {
  const candidates = historyFor(role, history);
  const reviews: StructuralReview[] = [];
  const next: Record<string, unknown> = { ...role };

  if (!(role.employer ?? "").trim()) {
    const outcome = decide(candidates.map((entries) => entries.map((item) => item.company ?? "")));
    if (outcome.status === "recovered" && outcome.value) {
      next.employer = outcome.value;
      reviews.push({ field: "employer", status: "recovered", recoveredFrom: "saved résumé version" });
    } else {
      reviews.push({ field: "employer", status: outcome.status, candidates: outcome.candidates });
    }
  }

  if (!(role.title ?? "").trim()) {
    const outcome = decide(candidates.map((entries) => entries.map((item) => item.title ?? ""))); 
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
