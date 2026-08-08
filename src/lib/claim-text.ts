/**
 * THE CLAIM/STRUCTURE TYPE BARRIER.
 *
 * Cluster C's certification failed on six P0s that were all the same mistake:
 * the rule "structural career metadata is not a résumé claim" was enforced at
 * ONE call site and five others carried on handing employer names, job titles
 * and education rows to the claim-admissibility classifier.
 *
 * That is the third time this shape of failure has happened here — occupation
 * templates, then the intake exemption list, now this. Every time the fix was
 * applied to the site that had been named, and every time another site was
 * found later. The conclusion is not "be more careful". It is that a rule
 * enforced by remembering is not enforced.
 *
 * So the rule becomes a type:
 *
 *   Employer, title, dates and education containers must never be accepted as
 *   input to claim-admissibility code.
 *
 * `sanitizeProfessionalLine`, `sanitizeProfessionalParagraph` and
 * `classifyEvidenceAdmissibility` no longer accept `string`. They accept
 * `ClaimText`, which only `asClaimText()` can mint — and `asClaimText()` will
 * not accept a `StructuralText`. Passing a job title to the classifier is a
 * compile error, not a code review someone has to remember to do.
 *
 * This is the same device that closed the evidence gate: `UsableEvidence` made
 * ungated evidence unpassable, and it caught a live P0 at the exact line before
 * any test ran. Conventions decay; types do not.
 */

declare const CLAIM_TEXT: unique symbol;
declare const STRUCTURAL_TEXT: unique symbol;

/** Prose that may be judged for whether it is a defensible résumé claim. */
export type ClaimText = string & { readonly [CLAIM_TEXT]: true };

/**
 * A structural career fact — an employer, a job title, a date range, a
 * credential, an institution. A record of where somebody worked or studied.
 * Never judged, never blanked by a classifier.
 */
export type StructuralText = string & { readonly [STRUCTURAL_TEXT]: true };

/** Resolves to `never` for structural values, which is what makes the barrier bite. */
export type NotStructural<T> = T extends { readonly [STRUCTURAL_TEXT]: true } ? never : T;

/**
 * Mint claim text. Deliberately explicit and greppable: every call is a place
 * where somebody decided this string is a claim about what the user did, rather
 * than a fact about where they did it.
 *
 * A `StructuralText` argument resolves to `never`, so the call will not compile.
 */
export function asClaimText<T extends string>(value: NotStructural<T>): ClaimText {
  return value as unknown as ClaimText;
}

/**
 * Mark a value as structural. Applied where employment and education records
 * are built, so the barrier follows the data instead of depending on which
 * function happens to be reading it.
 */
export function structural(value: string): StructuralText {
  return value as StructuralText;
}

/** Read a structural value as a plain string, for rendering and comparison. */
export function structuralText(value: StructuralText | string | undefined): string {
  return (value ?? "") as string;
}
