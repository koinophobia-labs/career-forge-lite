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
/**
 * Does this fragment denote a period of time rather than an organisation?
 *
 * The previous test recognised only dash-separated numeric years, so every
 * other way a person writes dates — "Jan 2018 to present", "2019 until 2021",
 * "Sept 2015 – Dec 2017" — fell through and was restored as a COMPANY NAME.
 * The question is asked positively now: a fragment made of date words, months,
 * years and separators is a date, whatever punctuation joins them.
 */
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";
const DATE_JOINER = "(?:-|–|—|to|until|through|thru)";
function looksLikeDates(value: string): boolean {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return false;
  if (!/\d{4}|present|current|ongoing/.test(v)) return false;
  const token = `(?:(?:${MONTHS})\\.?\\s*)?(?:\\d{1,2}[/.])?\\d{4}|present|current|ongoing`;
  return new RegExp(`^(?:${token})(?:\\s*${DATE_JOINER}\\s*(?:${token}))?$`, "i").test(v);
}

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
    entries.push(...headingsInRenderedText(version.resumeText ?? ""));
    if (entries.length) versions.push(entries);
  }
  return versions;
}

const EXPERIENCE_SECTION = /^(?:experience|work experience|employment|employment history|professional experience|career history)\b/i;
const OTHER_SECTION = /^(?:education|skills|core skills|projects|summary|profile|contact|certifications?|references?|interests|volunteering|awards)\b/i;
// Deliberately NOT a phone-number pattern. The obvious one — a digit followed
// by seven or more digits, spaces, brackets or dashes — matches "2018 - 2024",
// so every real employment heading was discarded as a contact line. The shape
// gate below already rejects contact rows: they carry no date segment.
const CONTACT_LIKE = /@|https?:|www\./;

/**
 * A rendered saved résumé is plain text, and the only thing marking an
 * employment heading is convention. Reading every line containing a "|" as one
 * was how a user's own summary line became their employer.
 *
 * A HISTORICAL REPRESENTATION IS EVIDENCE ONLY IF WE CAN IDENTIFY WHAT FIELD IT
 * REPRESENTS. So a line must earn the interpretation: it must sit under the
 * experience heading, not be a bullet, not look like contact details, and have
 * the shape of a heading — two or three segments, none of them a sentence, with
 * a recognisable date where a date belongs. Anything else is skipped. Skipping
 * costs a recovery the user can still make by hand; guessing writes a fiction
 * into their employment record.
 */
function headingsInRenderedText(text: string): HistoricalRole[] {
  const out: HistoricalRole[] = [];
  let inExperience = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (EXPERIENCE_SECTION.test(line)) { inExperience = true; continue; }
    if (OTHER_SECTION.test(line)) { inExperience = false; continue; }
    if (!inExperience) continue;
    if (/^[-•*\u2013\u2014]/.test(line)) continue;
    if (CONTACT_LIKE.test(line)) continue;

    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 2 || parts.length > 3) continue;
    if (parts.some((part) => !part)) continue;
    // A heading segment is a label, not prose. Anything sentence-shaped is
    // somebody's summary or a bullet that lost its marker.
    if (parts.some((part) => part.split(/\s+/).length > 8 || /[.!?]\s/.test(part))) continue;

    const dateIndex = parts.findIndex((part) => looksLikeDates(part));
    // Every real heading carries its dates. Without one we cannot tell
    // "Title | Employer" from "Skill | Skill", so we do not guess.
    if (dateIndex < 1) continue;
    const time = parts[dateIndex];
    const rest = parts.filter((_, i) => i !== dateIndex);
    out.push({ title: rest[0], company: rest[1], time });
  }
  return out;
}

const norm = (value: string | undefined) => (value ?? "").trim().toLowerCase();

/**
 * Historical entries that plausibly describe THIS role. Matched on a surviving
 * structural field only — never on bullet text, which is generated prose and
 * would let a rewritten sentence decide who the user worked for.
 */
function historyFor(
  role: { title?: string; employer?: string; startDate?: string; endDate?: string },
  versions: HistoricalRole[][]
): HistoricalRole[][] {
  const title = norm(role.title);
  const employer = norm(role.employer);
  if (!title && !employer) return [];
  const period = [role.startDate, role.endDate].filter(Boolean).map((v) => norm(v));

  const matches = (item: HistoricalRole) =>
    (title && norm(item.title) === title) || (employer && norm(item.company) === employer);

  return versions
    .map((entries) => {
      const hit = entries.filter(matches);
      if (hit.length < 2 || !period.length) return hit;
      // Two entries in one version both answer to this role's surviving field —
      // most often two spells at the same employer, or the same job title held
      // at two places. Dates are the disambiguator the record already carries;
      // using them prevents a sibling's history from being read as this job's.
      // If they do not separate the entries, all of them stay and `decide`
      // treats the disagreement as a conflict rather than picking one.
      const byPeriod = hit.filter((item) => period.some((p) => p && norm(item.time).includes(p)));
      return byPeriod.length ? byPeriod : hit;
    })
    .filter((entries) => entries.length);
}

function decide(perVersion: string[][]): { status: RecoveryStatus; value?: string; candidates?: string[] } {
  // WITHIN a version, take the DISTINCT non-empty values — not the first one.
  //
  // This used to collapse a version with `find(Boolean)`, which was written to
  // merge the two representations of ONE job: the structured snapshot whose
  // company the old build blanked, and the rendered heading it left alone. It
  // also merged two genuinely DIFFERENT jobs that appeared in the same saved
  // résumé, so array order silently became the confidently-applied answer and
  // one employer's name was written into another job.
  //
  // Distinct values handle both. One job recorded twice, once blank: a single
  // distinct value, still one voice. Two different jobs: two distinct values,
  // which is a disagreement inside the version and cannot be unanimity.
  const voices = perVersion.map((values) => [...new Set(values.map((v) => v.trim()).filter(Boolean))]);
  const conflictedWithin = voices.some((distinct) => distinct.length > 1);
  const present = voices.flat();
  const distinct = [...new Set(present)];
  // A version that records this role but retains NO value for the field had its
  // copy destroyed. It may have held a different employer, so the survivors are
  // candidates to offer rather than an answer to apply.
  const someDestroyed = voices.some((d) => d.length === 0);
  if (distinct.length === 1 && !someDestroyed && !conflictedWithin) {
    return { status: "recovered", value: distinct[0] };
  }
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
