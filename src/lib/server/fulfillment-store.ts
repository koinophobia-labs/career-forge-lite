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
  /**
   * Small JSON documents that are not fulfillment records — certification
   * evidence and the live-commerce approval. Kept separate from the session
   * namespace so nothing in the payment path can write them by accident.
   */
  getDoc<T>(id: string): Promise<T | null>;
  putDoc<T>(id: string, doc: T): Promise<void>;
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
  private docs = new Map<string, string>();

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

  async getDoc<T>(id: string): Promise<T | null> {
    const raw = this.docs.get(id);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async putDoc<T>(id: string, doc: T): Promise<void> {
    this.docs.set(id, JSON.stringify(doc));
  }

  async healthy() {
    return true;
  }

  /** Test seam. */
  reset() {
    this.records.clear();
    this.docs.clear();
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

  async getDoc<T>(id: string): Promise<T | null> {
    const raw = await this.command(["GET", `cf:doc:${id}`]);
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async putDoc<T>(id: string, doc: T): Promise<void> {
    await this.command(["SET", `cf:doc:${id}`, JSON.stringify(doc)]);
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


/* ------------------------------------------------------------- postgres */

const PG_URL = () =>
  process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();

export const postgresConfigured = () => Boolean(PG_URL());

/**
 * Neon Postgres — the database already provisioned on this project.
 *
 * Chosen over Vercel KV because it is already here. The readiness gate used to
 * demand KV specifically, which made "provision another storage product" a
 * blocker to selling when durable storage had been sitting in the project's own
 * environment for ten days. Any durable store satisfies the guarantee; the
 * guarantee was never "KV".
 *
 * `claim` uses INSERT ... ON CONFLICT DO NOTHING and reports whether a row was
 * actually inserted. That is atomic server-side, so two concurrent webhook
 * deliveries cannot both win — the property in-memory dedupe could never give.
 *
 * The schema is created lazily on first use so there is no migration step to
 * forget and no credential to materialize locally.
 */
export class PostgresFulfillmentStore implements FulfillmentStore {
  readonly kind = "neon-postgres";
  private ready: Promise<void> | null = null;

  private async sql() {
    const { neon } = await import("@neondatabase/serverless");
    return neon(PG_URL()!);
  }

  private async ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        const sql = await this.sql();
        await sql`CREATE TABLE IF NOT EXISTS cf_fulfillment (
          session_id     TEXT PRIMARY KEY,
          last_event_id  TEXT,
          payment_status TEXT NOT NULL DEFAULT 'unknown',
          tier           TEXT,
          status         TEXT NOT NULL,
          license_minted BOOLEAN NOT NULL DEFAULT FALSE,
          email_sent     BOOLEAN NOT NULL DEFAULT FALSE,
          attempts       INTEGER NOT NULL DEFAULT 1,
          last_error     TEXT NOT NULL DEFAULT 'none',
          created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
        await sql`CREATE TABLE IF NOT EXISTS cf_docs (
          id         TEXT PRIMARY KEY,
          doc        JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      })().catch((error) => {
        // Reset so a transient failure doesn't poison every later call.
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }

  /** No customer identity is stored — only what reconciliation needs. */
  private toRecord(row: Record<string, unknown>): FulfillmentRecord {
    return {
      sessionId: String(row.session_id),
      lastEventId: row.last_event_id ? String(row.last_event_id) : null,
      paymentStatus: String(row.payment_status),
      tier: row.tier ? String(row.tier) : null,
      status: String(row.status) as FulfillmentStatus,
      licenseMinted: Boolean(row.license_minted),
      emailSent: Boolean(row.email_sent),
      attempts: Number(row.attempts),
      lastError: String(row.last_error) as ErrorCategory,
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async claim(sessionId: string, eventId: string | null, seed: Partial<FulfillmentRecord>) {
    await this.ensure();
    const sql = await this.sql();
    const fresh = seedRecord(sessionId, eventId, seed);

    const inserted = await sql`
      INSERT INTO cf_fulfillment
        (session_id, last_event_id, payment_status, tier, status)
      VALUES
        (${sessionId}, ${eventId}, ${fresh.paymentStatus}, ${fresh.tier}, ${fresh.status})
      ON CONFLICT (session_id) DO NOTHING
      RETURNING *`;

    if (inserted.length > 0) {
      return { record: this.toRecord(inserted[0]), won: true };
    }

    // Someone else holds the claim. Count the retry so reconciliation can see
    // how many times Stripe re-delivered, then hand back the existing state.
    const existing = await sql`
      UPDATE cf_fulfillment
         SET attempts = attempts + 1,
             last_event_id = COALESCE(${eventId}, last_event_id),
             updated_at = NOW()
       WHERE session_id = ${sessionId}
      RETURNING *`;
    return { record: this.toRecord(existing[0]), won: false };
  }

  async get(sessionId: string): Promise<FulfillmentRecord | null> {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`SELECT * FROM cf_fulfillment WHERE session_id = ${sessionId}`;
    return rows.length ? this.toRecord(rows[0]) : null;
  }

  async update(sessionId: string, patch: Partial<FulfillmentRecord>): Promise<FulfillmentRecord | null> {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`
      UPDATE cf_fulfillment SET
        payment_status = COALESCE(${patch.paymentStatus ?? null}, payment_status),
        tier           = COALESCE(${patch.tier ?? null}, tier),
        status         = COALESCE(${patch.status ?? null}, status),
        license_minted = COALESCE(${patch.licenseMinted ?? null}, license_minted),
        email_sent     = COALESCE(${patch.emailSent ?? null}, email_sent),
        last_error     = COALESCE(${patch.lastError ?? null}, last_error),
        last_event_id  = COALESCE(${patch.lastEventId ?? null}, last_event_id),
        updated_at     = NOW()
      WHERE session_id = ${sessionId}
      RETURNING *`;
    return rows.length ? this.toRecord(rows[0]) : null;
  }

  async listUnfulfilled(): Promise<FulfillmentRecord[]> {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`
      SELECT * FROM cf_fulfillment
       WHERE payment_status = 'paid'
         AND (license_minted IS NOT TRUE OR email_sent IS NOT TRUE)
       ORDER BY created_at DESC LIMIT 500`;
    return rows.map((row) => this.toRecord(row));
  }

  async getDoc<T>(id: string): Promise<T | null> {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`SELECT doc FROM cf_docs WHERE id = ${id}`;
    return rows.length ? (rows[0].doc as T) : null;
  }

  async putDoc<T>(id: string, doc: T): Promise<void> {
    await this.ensure();
    const sql = await this.sql();
    await sql`
      INSERT INTO cf_docs (id, doc) VALUES (${id}, ${JSON.stringify(doc)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = NOW()`;
  }

  async healthy(): Promise<boolean> {
    try {
      await this.ensure();
      const sql = await this.sql();
      const probe = `__probe_${Math.random().toString(36).slice(2)}`;
      await sql`INSERT INTO cf_docs (id, doc) VALUES (${probe}, '{"probe":true}'::jsonb)
                ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`;
      const read = await sql`SELECT doc FROM cf_docs WHERE id = ${probe}`;
      await sql`DELETE FROM cf_docs WHERE id = ${probe}`;
      return read.length === 1;
    } catch {
      return false;
    }
  }
}

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
  // Postgres first: it is already provisioned on this project. KV remains
  // supported so an existing deployment configured that way keeps working.
  if (postgresConfigured()) {
    cached = new PostgresFulfillmentStore();
    return cached;
  }
  if (kvConfigured()) {
    cached = new KvFulfillmentStore();
    return cached;
  }
  return null;
}

/** Any durable store satisfies the guarantee. The guarantee was never "KV". */
export const durableStoreConfigured = () => postgresConfigured() || kvConfigured();

/** Test seam. */
export function __setFulfillmentStoreForTests(store: FulfillmentStore | null): void {
  cached = store;
}
