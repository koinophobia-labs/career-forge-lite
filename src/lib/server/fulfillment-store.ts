/**
 * Durable fulfillment state.
 *
 * Why the previous approach was not enough
 * ----------------------------------------
 * event-dedupe.ts was a bounded in-memory Set. It stops a duplicate delivery
 * that lands on the same warm serverless instance, and nothing else. It does not
 * survive a cold start, does not span instances, and is wiped by every redeploy.
 * Stripe retries a failed webhook over hours — exactly the window an in-memory
 * cache cannot cover. Calling that "idempotency" would be a category error.
 *
 * What this replaces it with
 * --------------------------
 * A record per Checkout Session, written before fulfillment is attempted and
 * updated as it progresses, so that:
 *
 *   - an event can be CLAIMED atomically before any side effect,
 *   - a completed session is recognised and never re-emailed,
 *   - an interrupted fulfillment can be RESUMED rather than restarted,
 *   - Stripe's payment list can be reconciled against what we actually did.
 *
 * Personal data
 * -------------
 * Deliberately absent. No name, no email address, no card data. The record
 * holds operational state and Stripe identifiers only. Recovery works by
 * looking the session up in Stripe, where the customer's details already live —
 * duplicating them here would create a second place to leak them from.
 */

export type FulfillmentStatus =
  | "claimed"
  | "license_minted"
  | "email_sent"
  | "failed"
  | "manual_recovery";

export type ErrorCategory =
  | "none"
  | "missing_tier_metadata"
  | "license_mint_failed"
  | "email_provider_rejected"
  | "email_network_error"
  | "unknown";

export type FulfillmentRecord = {
  /** Checkout Session id — the entitlement key. One session, one license. */
  sessionId: string;
  /** The Stripe event that most recently advanced this record. */
  lastEventId: string | null;
  paymentStatus: string;
  tier: string | null;
  status: FulfillmentStatus;
  licenseMinted: boolean;
  emailSent: boolean;
  attempts: number;
  lastError: ErrorCategory;
  createdAt: string;
  updatedAt: string;
};

export interface FulfillmentStore {
  readonly kind: string;
  /**
   * Atomically claim a session for fulfillment.
   * Returns the existing record if one is already present (already claimed or
   * completed), or a fresh claimed record if this caller won the race.
   */
  claim(sessionId: string, eventId: string | null, seed: Partial<FulfillmentRecord>): Promise<{ record: FulfillmentRecord; won: boolean }>;
  get(sessionId: string): Promise<FulfillmentRecord | null>;
  update(sessionId: string, patch: Partial<FulfillmentRecord>): Promise<FulfillmentRecord | null>;
  /** Sessions that took money but never completed. Drives reconciliation. */
  listUnfulfilled(): Promise<FulfillmentRecord[]>;
  /** Round-trip probe. Operational readiness depends on this passing. */
  healthy(): Promise<boolean>;
}

const now = () => new Date().toISOString();

const seedRecord = (
  sessionId: string,
  eventId: string | null,
  seed: Partial<FulfillmentRecord>
): FulfillmentRecord => ({
  sessionId,
  lastEventId: eventId,
  paymentStatus: seed.paymentStatus ?? "unknown",
  tier: seed.tier ?? null,
  status: "claimed",
  licenseMinted: false,
  emailSent: false,
  attempts: 1,
  lastError: "none",
  createdAt: now(),
  updatedAt: now(),
});

/* ------------------------------------------------------------------ memory */

/**
 * Test and local-development implementation. NOT durable — deliberately
 * reports kind "memory" so readiness refuses to treat it as production-safe.
 */
export class MemoryFulfillmentStore implements FulfillmentStore {
  readonly kind = "memory";
  private records = new Map<string, FulfillmentRecord>();

  async claim(sessionId: string, eventId: string | null, seed: Partial<FulfillmentRecord>) {
    const existing = this.records.get(sessionId);
    if (existing) {
      existing.attempts += 1;
      existing.lastEventId = eventId ?? existing.lastEventId;
      existing.updatedAt = now();
      return { record: existing, won: false };
    }
    const record = seedRecord(sessionId, eventId, seed);
    this.records.set(sessionId, record);
    return { record, won: true };
  }

  async get(sessionId: string) {
    return this.records.get(sessionId) ?? null;
  }

  async update(sessionId: string, patch: Partial<FulfillmentRecord>) {
    const existing = this.records.get(sessionId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, sessionId, updatedAt: now() };
    this.records.set(sessionId, updated);
    return updated;
  }

  async listUnfulfilled() {
    return [...this.records.values()].filter((r) => !r.emailSent || !r.licenseMinted);
  }

  async healthy() {
    return true;
  }

  /** Test seam. */
  reset() {
    this.records.clear();
  }
}

/* --------------------------------------------------------------- vercel kv */

const KV_URL = () => process.env.KV_REST_API_URL?.trim();
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN?.trim();

export const kvConfigured = () => Boolean(KV_URL() && KV_TOKEN());

/**
 * Vercel KV over its REST API — no new dependency, just fetch.
 *
 * `claim` uses SET ... NX, which is atomic server-side. Two concurrent webhook
 * deliveries cannot both win, which is the property in-memory dedupe could
 * never provide.
 */
export class KvFulfillmentStore implements FulfillmentStore {
  readonly kind = "vercel-kv";
  private key = (sessionId: string) => `cf:fulfillment:${sessionId}`;
  private indexKey = "cf:fulfillment:index";

  private async command(body: unknown[]): Promise<unknown> {
    const res = await fetch(KV_URL()!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`kv command failed: ${res.status}`);
    const json = (await res.json()) as { result?: unknown };
    return json.result;
  }

  async claim(sessionId: string, eventId: string | null, seed: Partial<FulfillmentRecord>) {
    const record = seedRecord(sessionId, eventId, seed);
    // NX = only set if absent. This is the atomic claim.
    const result = await this.command(["SET", this.key(sessionId), JSON.stringify(record), "NX"]);
    if (result === "OK") {
      await this.command(["SADD", this.indexKey, sessionId]);
      return { record, won: true };
    }
    const existing = await this.get(sessionId);
    if (!existing) {
      // Vanishingly unlikely (set failed and read found nothing). Treat as a
      // loss rather than inventing a claim we do not hold.
      return { record, won: false };
    }
    const bumped = await this.update(sessionId, {
      attempts: existing.attempts + 1,
      lastEventId: eventId ?? existing.lastEventId,
    });
    return { record: bumped ?? existing, won: false };
  }

  async get(sessionId: string) {
    const raw = await this.command(["GET", this.key(sessionId)]);
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw) as FulfillmentRecord;
    } catch {
      return null;
    }
  }

  async update(sessionId: string, patch: Partial<FulfillmentRecord>) {
    const existing = await this.get(sessionId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, sessionId, updatedAt: now() };
    await this.command(["SET", this.key(sessionId), JSON.stringify(updated)]);
    return updated;
  }

  async listUnfulfilled() {
    const ids = (await this.command(["SMEMBERS", this.indexKey])) as string[] | null;
    if (!Array.isArray(ids)) return [];
    const records = await Promise.all(ids.map((id) => this.get(id)));
    return records.filter(
      (r): r is FulfillmentRecord => Boolean(r) && (!r!.emailSent || !r!.licenseMinted)
    );
  }

  async healthy() {
    try {
      const probe = `cf:health:${Math.random().toString(36).slice(2)}`;
      await this.command(["SET", probe, "1", "EX", "30"]);
      const value = await this.command(["GET", probe]);
      await this.command(["DEL", probe]);
      return value === "1";
    } catch {
      return false;
    }
  }
}

/* ----------------------------------------------------------------- factory */

let cached: FulfillmentStore | null = null;

/**
 * The production store, or null when none is provisioned.
 *
 * Returning null is meaningful: readiness treats "no durable store" as a hard
 * blocker, so checkout stays closed rather than silently falling back to a
 * cache that cannot keep its promise.
 */
export function getFulfillmentStore(): FulfillmentStore | null {
  if (cached) return cached;
  if (kvConfigured()) {
    cached = new KvFulfillmentStore();
    return cached;
  }
  return null;
}

/** Test seam. */
export function __setFulfillmentStoreForTests(store: FulfillmentStore | null): void {
  cached = store;
}
