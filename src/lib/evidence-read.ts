/**
 * THE CANONICAL EVIDENCE READ LAYER.
 *
 * Why this module exists
 * ----------------------
 * Eligibility used to be enforced at INTAKE: one function narrowed three named
 * strings for three evidence kinds on the way into generation. Round 8 proved
 * that shape cannot hold. The same user evidence is reachable through several
 * different representations, and each one was its own tunnel under the fence:
 *
 *   selected* arrays refilled from storage on every mount  -> generator
 *   the global proofPoints / unstructuredNotes pools       -> pack builder
 *   evidence kinds outside responsibility|proof|metric     -> resume.education
 *   pack-export's own `approved && !rejected` filter       -> cover-letter facts
 *   the outcomes lane, which had no filter at all          -> bullets
 *
 * Patching an exit only relocates the leak. So eligibility moved to the point
 * of READ, and this module is that point:
 *
 *   No generation, transformation, résumé surface, or export code may consume
 *   user evidence except through an eligibility-aware read.
 *
 * Three properties make that rule stick
 * -------------------------------------
 * 1. FAIL CLOSED. A record is usable only if it affirmatively passes every
 *    rule. Anything unknown, unreviewed, stale, or ambiguous is withheld.
 *
 * 2. DERIVED, NOT STORED. Eligibility is recomputed from the text on every
 *    read. Two Round 8 defects were fail-OPEN precisely because eligibility
 *    was trusted from stored fields: `reviveDossier` dropped the reviewed-text
 *    fingerprint, silently upgrading a stale resolution into a live approval;
 *    and every dossier written before the lifecycle existed had no review
 *    state at all, so it sailed through. Deriving at read time means a dropped
 *    field or a legacy record degrades to "ask the user", never to "publish".
 *
 * 3. UNFORGEABLE. `UsableEvidence` is a branded type only this module can
 *    mint. A builder that declares `UsableEvidence[]` cannot be handed
 *    `dossier.evidence` — the bypass is a compile error rather than a code
 *    review someone has to remember to do.
 *
 * RAW EVIDENCE IS NOT DELETED EVIDENCE. "Not usable for generation right now"
 * never means "gone". `getEvidence` returns the authoritative store untouched
 * for the surfaces that must show the user their own words — review cards,
 * evidence editors, provenance trails. Those surfaces are allowed, expected,
 * and deliberately not gated.
 */
import { possibleDisclosure } from "@/lib/truth-guards";
import type { CareerDossier, DossierEvidenceRecord, EvidenceKind } from "@/types/dossier";

/**
 * Kinds that can carry a personal disclosure and therefore participate in the
 * review lifecycle. Deliberately broader than the three kinds the old intake
 * gate covered: `education` was outside it, which is how "Dropped out of the
 * plumbing diploma after the first term." reached resume.education after the
 * user had explicitly excluded it.
 */
const REVIEWABLE_KINDS = new Set<EvidenceKind>([
  "responsibility",
  "proof",
  "metric",
  "education",
  "story",
  "project",
  "role",
  "skill",
  "tool"
]);

export type EligibilityReason =
  | "ok"
  | "not_approved"
  | "rejected"
  | "awaiting_review"
  | "excluded_by_user"
  | "stale_resolution"
  | "unreviewed_disclosure"
  | "wrong_role";

export type Eligibility = { usable: boolean; reason: EligibilityReason };

/**
 * A record that has passed the eligibility gate. The brand is structural but
 * unforgeable outside this module: nothing else can produce the symbol, so
 * `UsableEvidence[]` in a builder's signature is a real barrier rather than a
 * naming convention.
 */
declare const USABLE_BRAND: unique symbol;
export type UsableEvidence = DossierEvidenceRecord & { readonly [USABLE_BRAND]: true };

type EvidenceLike = Pick<DossierEvidenceRecord, "approved" | "rejected"> &
  Partial<Pick<DossierEvidenceRecord, "kind" | "detail" | "disclosureReview" | "disclosureReviewedText" | "roleId">>;

/**
 * A resolution is STALE when the reviewed text no longer matches the current
 * text — the decision belonged to the words that were on screen.
 *
 * The missing-fingerprint case is the subtle one. It used to return false
 * ("not stale"), which is fail-open: `reviveDossier` did not carry
 * disclosureReviewedText across a page load, so one refresh turned a stale
 * keep into a live approval and the edited sentence printed. A resolution we
 * cannot verify against its text is treated as stale, because the fingerprint
 * IS the proof that the decision matches the words.
 */
export function resolutionIsStale(item: EvidenceLike): boolean {
  if (item.disclosureReview !== "keep" && item.disclosureReview !== "exclude") return false;
  if (item.disclosureReviewedText === undefined) return true;
  return item.disclosureReviewedText !== (item.detail ?? "");
}

/**
 * Would this text be flagged if it were typed today? Asked on every read so
 * that records stored before the review lifecycle existed — i.e. every dossier
 * belonging to an existing user — are held for review rather than published
 * unexamined.
 */
function carriesUnreviewedDisclosure(item: EvidenceLike): boolean {
  if (item.disclosureReview) return false;
  if (item.kind && !REVIEWABLE_KINDS.has(item.kind)) return false;
  return Boolean(possibleDisclosure(item.detail ?? ""));
}

/**
 * The single definition of eligibility. Returns WHY, not just whether, so the
 * receipt can report an omission with its true reason and never invent one.
 */
export function evidenceEligibility(item: EvidenceLike, options: { roleId?: string } = {}): Eligibility {
  if (!item.approved) return { usable: false, reason: "not_approved" };
  if (item.rejected) return { usable: false, reason: "rejected" };
  if (item.disclosureReview === "needs_review") return { usable: false, reason: "awaiting_review" };
  if (item.disclosureReview === "exclude") return { usable: false, reason: "excluded_by_user" };
  if (resolutionIsStale(item)) return { usable: false, reason: "stale_resolution" };
  if (carriesUnreviewedDisclosure(item)) return { usable: false, reason: "unreviewed_disclosure" };
  // Ownership only constrains when the caller asked for a specific role. An
  // ownerless legacy record is not silently adopted by whichever role asks.
  if (options.roleId !== undefined && item.roleId !== options.roleId) {
    return { usable: false, reason: "wrong_role" };
  }
  return { usable: true, reason: "ok" };
}

/** Convenience predicate. Same rules, no reason. */
export function isUsable(item: EvidenceLike, options: { roleId?: string } = {}): boolean {
  return evidenceEligibility(item, options).usable;
}

/**
 * RAW read. The authoritative store, ungated, for surfaces that show the user
 * their own evidence. Named explicitly so that reading raw is a visible,
 * greppable decision rather than an accident of reaching for `.evidence`.
 */
export function getEvidence(dossier: Pick<CareerDossier, "evidence">): DossierEvidenceRecord[] {
  return dossier.evidence;
}

/**
 * ELIGIBLE read. Every generation, transformation, résumé surface and export
 * consumer goes through here or through one of the narrowing helpers below.
 */
export function getUsableEvidence(
  dossier: Pick<CareerDossier, "evidence">,
  options: { roleId?: string; kinds?: EvidenceKind[] } = {}
): UsableEvidence[] {
  const kinds = options.kinds ? new Set(options.kinds) : null;
  return dossier.evidence.filter((item) => {
    if (kinds && !kinds.has(item.kind)) return false;
    return evidenceEligibility(item, { roleId: options.roleId }).usable;
  }) as UsableEvidence[];
}

/** Eligible evidence OWNED BY a specific role. One employer's duties can never print under another. */
export function getUsableEvidenceForRole(
  dossier: Pick<CareerDossier, "evidence">,
  roleId: string,
  options: { kinds?: EvidenceKind[] } = {}
): UsableEvidence[] {
  return getUsableEvidence(dossier, { ...options, roleId });
}

/**
 * Eligible evidence for document generation. Kind-restricted to the facts a
 * résumé may assert; preferences, targeting statements and gap notes are not
 * career facts and never become résumé content.
 */
export function getUsableEvidenceForGeneration(
  dossier: Pick<CareerDossier, "evidence">,
  options: { roleId?: string; kinds?: EvidenceKind[] } = {}
): UsableEvidence[] {
  // Deliberately NOT kind-restricted. An earlier version defaulted to
  // REVIEWABLE_KINDS, conflating "kinds that participate in disclosure review"
  // with "kinds a document may draw on" — which silently dropped the
  // work-authorization, clearance, availability and compensation evidence that
  // exists precisely to answer employer questions. Eligibility is about review
  // state; which KINDS suit a given surface is the consumer's business, and
  // consumers say so with isProfessionalEvidence or an explicit kinds option.
  return getUsableEvidence(dossier, options);
}

/** The user's words from an item that has passed the gate. */
export function usableText(item: UsableEvidence): string {
  return item.detail;
}

/** Same, for a whole set — the common shape builders actually want. */
export function usableTexts(items: UsableEvidence[]): string[] {
  return items.map((item) => item.detail).filter((text) => text.trim().length > 0);
}

/**
 * Everything the user still has to decide, derived rather than stored — so a
 * legacy record with no review state, or one whose fingerprint was dropped in
 * transit, appears in the queue instead of quietly publishing.
 */
export function getPendingReviews(dossier: Pick<CareerDossier, "evidence">): DossierEvidenceRecord[] {
  return dossier.evidence.filter((item) => {
    if (!item.approved || item.rejected) return false;
    const reason = evidenceEligibility(item).reason;
    return reason === "awaiting_review" || reason === "stale_resolution" || reason === "unreviewed_disclosure";
  });
}

/**
 * Items the user actively chose to leave off. Reported separately from
 * withheld-pending-review so a receipt states the true reason for an omission.
 */
export function getUserExcludedEvidence(dossier: Pick<CareerDossier, "evidence">): DossierEvidenceRecord[] {
  return dossier.evidence.filter((item) => item.disclosureReview === "exclude" && !resolutionIsStale(item));
}

/**
 * Escape hatch for the ONE legitimate case: code that already holds records it
 * proved eligible via evidenceEligibility and needs the branded type. Loud on
 * purpose — it should be rare, and every call is a grep target in review.
 */
export function assertUsable(items: DossierEvidenceRecord[]): UsableEvidence[] {
  const ineligible = items.filter((item) => !evidenceEligibility(item).usable);
  if (ineligible.length) {
    throw new Error(
      `assertUsable received ${ineligible.length} ineligible record(s): ${ineligible
        .map((item) => `${item.id}=${evidenceEligibility(item).reason}`)
        .join(", ")}`
    );
  }
  return items as UsableEvidence[];
}

/* ------------------------------------------------------------------------- *
 * The TEXT representation.
 *
 * Evidence also reaches generation as bare strings on IntakeData — the guided
 * textarea, and the selected* arrays the UI refills from storage. Those
 * strings carry no record and therefore no resolution state, so the reader
 * cannot look one up. It can still fail closed: a sentence that would be
 * flagged if typed today is withheld unless the user has explicitly approved
 * it.
 *
 * This is applied ONCE, at the boundary where intake enters generation, rather
 * than at each of the 22 sites inside the generator that read these fields.
 * Round 8's B1 and B2 were both "one more field nobody filtered" — so the
 * filter is exhaustive by construction: every string and string[] on the
 * object is gated EXCEPT an explicit list of fields that are not career facts.
 * A field added tomorrow is gated by default. That inverts the failure
 * direction: forgetting costs a withheld sentence the user can restore, not a
 * disclosure printed on a résumé.
 * ------------------------------------------------------------------------- */

/**
 * Not career facts: identity, contact details, the target job, and the
 * approval list itself. Everything else on the intake is treated as something
 * the user said about their working life.
 */
const NON_EVIDENCE_INTAKE_FIELDS = new Set([
  // NOT exempt, though an earlier version of this list wrongly exempted them:
  // `education` prints as resume.education, and the *Time fields print as the
  // dates beside each employer. Both carry user prose and both leaked while a
  // byte-identical sentence in customRoleNotes was correctly withheld in the
  // SAME generation call — "Dropped out of the plumbing diploma after the
  // first term." reached the document, and "2019-2023, until my position was
  // cut because I flagged the billing error" printed as an employment date.
  // `withGuards` nets only summary/linkedinSummary/linkedinHeadline, so there
  // was no second chance to catch either.
  "sourceRoleId",
  "fullName",
  "email",
  "phone",
  "website",
  "targetJobTitle",
  "disclosureApproved",
  "roleFamily",
  "template",
  "currentTitle",
  "currentCompany",
  "previousTitle",
  "previousCompany",
  "additionalTitle",
  "additionalCompany"
]);

/** Split that keeps ellipses intact — "Closed, counted, locked up... every night." is ONE claim. */
function splitSentences(value: string): string[] {
  return value.split(/(?<!\.\.)(?<=[.!?])\s+/);
}

function approvalKey(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/^(i|we)\s+(also\s+)?/i, "")
    .replace(/^(and|or|plus|also)\s+/i, "")
    .toLowerCase();
}

/**
 * Withhold flagged-but-unapproved sentences from a single value. Whole
 * sentences only — never a clause. Partial stripping was retired because it
 * could not tell a bounded accomplishment from a pre-empted one, and traded
 * fabrication for silent résumé amputation.
 */
export function eligibleUserText(value: string, approved: Set<string>): string {
  if (!value) return value;
  return value
    .split(/\n/)
    .map((line) =>
      splitSentences(line)
        .filter((sentence) => !possibleDisclosure(sentence) || approved.has(approvalKey(sentence)))
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * One eligibility-aware read of everything the generator is about to consume.
 * The user's stored intake is NOT modified — this returns a narrowed copy, and
 * a withheld sentence stays in their record, visible and restorable.
 */
declare const USABLE_INTAKE_BRAND: unique symbol;
/** An intake that has passed the eligibility read. Only this module mints it. */
export type UsableIntake<T> = T & { readonly [USABLE_INTAKE_BRAND]: true };

export function getUsableIntake<T extends Record<string, unknown>>(intake: T): UsableIntake<T> {
  const approved = new Set(
    (Array.isArray(intake.disclosureApproved) ? (intake.disclosureApproved as string[]) : []).map(approvalKey)
  );
  const out: Record<string, unknown> = { ...intake };
  for (const [key, value] of Object.entries(intake)) {
    if (NON_EVIDENCE_INTAKE_FIELDS.has(key)) continue;
    if (typeof value === "string") {
      out[key] = eligibleUserText(value, approved);
    } else if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      out[key] = (value as string[])
        .map((entry) => eligibleUserText(entry, approved))
        .filter((entry) => entry.trim().length > 0);
    }
  }
  return out as UsableIntake<T>;
}
