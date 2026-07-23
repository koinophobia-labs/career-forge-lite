/**
 * Per-code activation cap for redemption codes (CF-03).
 *
 * The gap this closes
 * -------------------
 * /api/redeem minted a fresh, valid entitlement on every call, checking only
 * `revoked`. The `redemptionCount` the store already tracks was never read as a
 * cap, so a single $49 code could activate an unbounded number of browsers.
 *
 * What this is — and deliberately is NOT
 * --------------------------------------
 * Career Forge is an accountless, PERPETUAL, BEARER-license product: the code,
 * and the license it mints, are intentionally shareable. So this cap is NOT an
 * anti-sharing or anti-piracy control — a determined sharer redeems once and
 * passes the minted key along regardless. Its only job is to put a generous
 * ceiling on how many times ONE code can mint a fresh entitlement, turning
 * "unbounded" into "a sensible number", while never turning away a real buyer
 * who reinstalls, clears a browser, or activates a second device.
 *
 * The counter is `RedemptionRecord.redemptionCount`, which
 * `markRedemptionRedeemed` already increments after every successful activation.
 *
 * Fail-open by design
 * -------------------
 * Every ambiguous input resolves in the paying customer's favour, matching the
 * codebase's "never silently lose a paying customer" philosophy: a missing or
 * nonsensical `REDEMPTION_MAX_ACTIVATIONS` falls back to a generous default, and
 * a count the store cannot express as a real number is treated as "not capped".
 * Abuse still has the failure rate-limiter and manual `revokeRedemption` behind
 * this.
 */

/**
 * Generous on purpose. A genuine bearer reinstalling or switching browsers over
 * the life of a perpetual license stays comfortably under this; it exists only
 * to bound the pathological "one code, unlimited activations" case.
 */
export const DEFAULT_REDEMPTION_MAX_ACTIVATIONS = 10;

/** Env override for the activation cap. Value is a positive integer count. */
export const REDEMPTION_MAX_ACTIVATIONS_ENV = "REDEMPTION_MAX_ACTIVATIONS";

/**
 * Resolve the configured activation cap.
 *
 * Fails OPEN to the generous default on anything that is not a positive integer
 * (unset, blank, "abc", "0", "-3", "2.5", "Infinity") so a mis-set env can never
 * lock a paying bearer out — only an operator deliberately setting a valid
 * integer changes the ceiling.
 */
export function resolveRedemptionMaxActivations(
  raw: string | undefined = process.env[REDEMPTION_MAX_ACTIVATIONS_ENV]
): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    return DEFAULT_REDEMPTION_MAX_ACTIVATIONS;
  }
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_REDEMPTION_MAX_ACTIVATIONS;
  }
  return parsed;
}

/**
 * Has this code already been activated the maximum number of times?
 *
 * `priorCount` is the number of successful activations recorded BEFORE this
 * attempt. With a cap of N the first N activations pass (priorCount 0..N-1) and
 * the (N+1)-th is refused — the code activates exactly N times.
 *
 * A non-finite or negative count means the store handed back something that is
 * not a real activation total; treat that as "not capped" (fail-open) so a data
 * anomaly never refuses a legitimate buyer.
 */
export function redemptionCapReached(priorCount: number, cap: number): boolean {
  if (!Number.isFinite(priorCount) || priorCount < 0) return false;
  return priorCount >= cap;
}
