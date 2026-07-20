/**
 * Best-effort webhook idempotency.
 *
 * Honest about what this is: a bounded in-memory set, per serverless instance.
 * It stops the common case — Stripe delivering the same event twice in quick
 * succession to a warm instance — and it does NOT survive a cold start or span
 * multiple instances.
 *
 * That limitation is acceptable here only because the thing being deduplicated
 * is a fulfillment email carrying a DETERMINISTIC license key: the same session
 * always mints the same key, so a duplicate delivery is a duplicate email, not a
 * second entitlement. A duplicate receipt is a much smaller failure than a
 * missing one, which is why retries are still allowed to proceed on error.
 *
 * If this product ever grows a real store, replace this with a persisted
 * event-id table and delete the file. Do not extend it — an in-memory cache
 * that looks like a database is worse than one that admits it isn't.
 */

const MAX_TRACKED = 500;

/** Insertion-ordered; oldest evicted first once MAX_TRACKED is exceeded. */
const seen = new Set<string>();

/**
 * Returns true the first time an event id is seen, false on repeats.
 * Untracked/blank ids always return true — we would rather send a duplicate
 * email than drop a real fulfillment.
 */
export function markEventProcessed(eventId: string | undefined | null): boolean {
  if (!eventId || !eventId.trim()) return true;
  const id = eventId.trim();

  if (seen.has(id)) return false;

  seen.add(id);
  if (seen.size > MAX_TRACKED) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  return true;
}

/** Test seam only. */
export function __resetDedupeForTests(): void {
  seen.clear();
}
