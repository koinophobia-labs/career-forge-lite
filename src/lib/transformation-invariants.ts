/**
 * DOWNSTREAM TRUTH INVARIANTS.
 *
 * The point-of-read evidence gate decides WHICH of the user's sentences may be
 * used. It says nothing about what happens to a sentence afterwards. Round 9
 * found the gap that leaves: truth was still being changed downstream of the
 * gate, by transformations that were never thinking about truth at all.
 *
 *   "we hit 98% on the audit that year"
 *      -> "Hit 98% on the audit that year."        the team's work, claimed alone
 *   "helped people find stuff on the shop floor"
 *      -> "Helped people find on the shop floor."  the object of the verb, deleted
 *
 * Neither was a fabrication in the usual sense — nothing was invented. A
 * cosmetic rewrite changed WHO did the work, and a filler-word cleanup changed
 * WHAT was done. Both shipped in a DOCX.
 *
 * So the rule is stated once, here, and enforced rather than remembered:
 *
 *   No transformation may change actor/agency, polarity, or accomplishment
 *   status.
 *
 * A transformation may still clean, shorten, reorder, fix spelling and adjust
 * case. If its output would change any of the three, the ORIGINAL sentence is
 * kept instead. Failing closed here means failing toward the user's own words,
 * which is the only safe direction: an unpolished true sentence is publishable,
 * a polished false one is not.
 */

/** WHO did the thing. */
export type Agency = "team" | "self" | "third-party" | "unattributed";

/** WHETHER it happened. */
export type Accomplishment = "stated" | "aspirational" | "hypothetical" | "denied";

export type TruthShape = {
  agency: Agency;
  accomplishment: Accomplishment;
  /** Negated verb count. Polarity is a count, not a boolean: dropping one of two negations flips meaning. */
  negations: number;
};

const TEAM_SUBJECT = /(^|[.;:!?]\s+|\band\s+|\bbut\s+|\bso\s+)(we|our team|the team|us)\b/i;
const SELF_SUBJECT = /(^|[.;:!?]\s+|\band\s+|\bbut\s+|\bso\s+)(i|my|me)\b/i;
const THIRD_PARTY_SUBJECT =
  /(^|[.;:!?]\s+)(he|she|they|the (night crew|day crew|team lead|manager|supervisor|agency|contractor|cleaner|senior [a-z]+)|a (senior|contracted|different) [a-z]+|someone else|my (manager|colleague|supervisor|boss))\b/i;

/**
 * Auxiliary + "not"/"n't" only. An open-ended "ends in nt" test once classified
 * management, equipment, front and different as negations and emptied CORE
 * SKILLS, so the list is closed on purpose.
 */
// The apostrophe is OPTIONAL and may be curly: people type "cant", "didnt",
// "wasn’t". Requiring a straight apostrophe made the guard blind to a complete
// polarity flip. Negative quantifiers are counted too — "nobody did the
// deliveries" is a negation of agency even with no auxiliary in sight.
// The auxiliary list stays CLOSED: an open-ended "ends in nt" test once
// classified management, equipment and different as negations.
const NEGATION =
  /\b(?:do|does|did|is|are|was|were|has|have|had|can|could|will|would|should|must|might|may)\s*n['’]?o?t\b|\b(?:do|does|did|is|are|was|were|has|have|had|ca|could|wo|would|should|must|might)n['’]?t\b|\bnever\b|\bno longer\b|\b(?:nobody|no one|nothing|none of us|not once)\b/gi;

const ASPIRATIONAL =
  /\b(?:i(?:['’]d| would)? (?:like|love|want|hope)|one day|some ?day|in (?:the )?future|hoping to|looking to|planning to|want to (?:get|move|go) into|my goal is|aiming to)\b/i;
const HYPOTHETICAL = /\b(?:if i|would have|could have|should have|were i to|suppose|what if|am i supposed to|do i need to|does this need)\b/i;
// Recall here was measured at 4 of 15 on real phrasings, so the reader leans on
// the polarity count rather than trying to enumerate every way to say "no".
const DENIAL = /\b(?:never (?:did|ran|handled|used|worked|trained|been)|not trained|no experience|wasn['’]?t trained|didn['’]?t (?:do|handle|run|use)|no formal|not qualified|not my job|wasn['’]?t me)\b/i;

function agencyOf(text: string): Agency {
  // Order matters. A sentence naming someone else as the actor is third-party
  // even when the user also appears in it — "the night crew kept the care notes
  // for me" is not the user's accomplishment.
  if (THIRD_PARTY_SUBJECT.test(text)) return "third-party";
  if (TEAM_SUBJECT.test(text)) return "team";
  if (SELF_SUBJECT.test(text)) return "self";
  return "unattributed";
}

function accomplishmentOf(text: string): Accomplishment {
  if (DENIAL.test(text)) return "denied";
  // A first-person sentence carrying a negated verb is a denial even when it
  // matches none of the phrasings above.
  if (SELF_SUBJECT.test(text) && (text.match(NEGATION) ?? []).length > 0) return "denied";
  if (ASPIRATIONAL.test(text)) return "aspirational";
  if (HYPOTHETICAL.test(text)) return "hypothetical";
  return "stated";
}

export function truthShape(text: string): TruthShape {
  return {
    agency: agencyOf(text),
    accomplishment: accomplishmentOf(text),
    negations: (text.match(NEGATION) ?? []).length
  };
}

/**
 * Résumé voice legitimately drops a leading "I" — the actor is unchanged,
 * because an unattributed bullet on someone's own résumé IS them. Dropping a
 * leading "we" is a different act entirely: it moves work from a group to an
 * individual. So self -> unattributed is allowed and team -> anything is not.
 */
function agencyPreserved(before: Agency, after: Agency): boolean {
  if (before === after) return true;
  return before === "self" && after === "unattributed";
}

export type InvariantBreach = { ok: false; reason: "agency" | "polarity" | "accomplishment"; before: TruthShape; after: TruthShape };
export type InvariantResult = { ok: true } | InvariantBreach;

export function checkTruthShape(before: string, after: string): InvariantResult {
  const b = truthShape(before);
  const a = truthShape(after);
  if (!agencyPreserved(b.agency, a.agency)) return { ok: false, reason: "agency", before: b, after: a };
  if (b.negations !== a.negations) return { ok: false, reason: "polarity", before: b, after: a };
  if (b.accomplishment !== a.accomplishment) return { ok: false, reason: "accomplishment", before: b, after: a };
  return { ok: true };
}

/**
 * Run a transformation under the invariant. If the result would change who did
 * it, whether it happened, or whether it is negated, the user's original
 * sentence is returned untouched.
 *
 * This is deliberately a wrapper rather than a lint rule: a future
 * transformation added by someone who has never read this file is still
 * covered, provided it goes through here.
 */
export function transformPreservingTruth(value: string, transform: (input: string) => string): string {
  if (!value || !value.trim()) return value;
  const candidate = transform(value);
  if (!candidate || !candidate.trim()) return value;
  return checkTruthShape(value, candidate).ok ? candidate : value;
}
