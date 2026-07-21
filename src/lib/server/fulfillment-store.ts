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
  /** Resend's provider-side acceptance id. It contains no customer identity. */
  emailProviderMessageId: string | null;
  attempts: number;
  lastError: ErrorCategory;
  createdAt: string;
  updatedAt: string;
};

export type RedemptionRecord = {
  /** HMAC-SHA256 of the normalized customer-facing redemption code. */
  codeHash: string;
  sessionId: string;
  tier: string;
  entitlementReference: string;
  purchaseTimestamp: string;
  createdAt: string;
  lastRedeemedAt: string | null;
  redemptionCount: number;
  revoked: boolean;
  revocationReason: string | null;
  /** AES-GCM retry material, erased immediately after delivery is recorded. */
  pendingCodeCiphertext: string | null;
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
  createRedemption(record: RedemptionRecord): Promise<{ record: RedemptionRecord; created: boolean }>;
  getRedemptionByHash(codeHash: string): Promise<RedemptionRecord | null>;
  getRedemptionBySession(sessionId: string): Promise<RedemptionRecord | null>;
  markRedemptionDelivered(sessionId: string): Promise<void>;
  markRedemptionRedeemed(codeHash: string): Promise<RedemptionRecord | null>;
  revokeRedemption(codeHash: string, reason: string): Promise<RedemptionRecord | null>;
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
  emailProviderMessageId: null,
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
  private redemptionsByHash = new Map<string, RedemptionRecord>();
  private redemptionHashBySession = new Map<string, string>();

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

  async createRedemption(record: RedemptionRecord) {
    const existingHash = this.redemptionHashBySession.get(record.sessionId);
    if (existingHash) {
      return { record: this.redemptionsByHash.get(existingHash)!, created: false };
    }
    if (this.redemptionsByHash.has(record.codeHash)) throw new Error("redemption_code_collision");
    const stored = { ...record };
    this.redemptionsByHash.set(record.codeHash, stored);
    this.redemptionHashBySession.set(record.sessionId, record.codeHash);
    return { record: { ...stored }, created: true };
  }

  async getRedemptionByHash(codeHash: string) {
    const record = this.redemptionsByHash.get(codeHash);
    return record ? { ...record } : null;
  }

  async getRedemptionBySession(sessionId: string) {
    const hash = this.redemptionHashBySession.get(sessionId);
    return hash ? this.getRedemptionByHash(hash) : null;
  }

  async markRedemptionDelivered(sessionId: string) {
    const record = await this.getRedemptionBySession(sessionId);
    if (!record) return;
    record.pendingCodeCiphertext = null;
    this.redemptionsByHash.set(record.codeHash, record);
  }

  async markRedemptionRedeemed(codeHash: string) {
    const record = await this.getRedemptionByHash(codeHash);
    if (!record) return null;
    record.lastRedeemedAt = now();
    record.redemptionCount += 1;
    this.redemptionsByHash.set(codeHash, record);
    return { ...record };
  }

  async revokeRedemption(codeHash: string, reason: string) {
    const record = await this.getRedemptionByHash(codeHash);
    if (!record) return null;
    record.revoked = true;
    record.revocationReason = reason;
    this.redemptionsByHash.set(codeHash, record);
    return { ...record };
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
    this.redemptionsByHash.clear();
    this.redemptionHashBySession.clear();
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
  private redemptionKey = (codeHash: string) => `cf:redemption:${codeHash}`;
  private redemptionSessionKey = (sessionId: string) => `cf:redemption-session:${sessionId}`;

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

  async createRedemption(record: RedemptionRecord) {
    const existing = await this.getRedemptionBySession(record.sessionId);
    if (existing) return { record: existing, created: false };
    const inserted = await this.command([
      "SET",
      this.redemptionKey(record.codeHash),
      JSON.stringify(record),
      "NX",
    ]);
    if (inserted !== "OK") throw new Error("redemption_code_collision");
    const linked = await this.command([
      "SET",
      this.redemptionSessionKey(record.sessionId),
      record.codeHash,
      "NX",
    ]);
    if (linked !== "OK") {
      await this.command(["DEL", this.redemptionKey(record.codeHash)]);
      const raced = await this.getRedemptionBySession(record.sessionId);
      if (raced) return { record: raced, created: false };
      throw new Error("redemption_session_link_failed");
    }
    return { record, created: true };
  }

  async getRedemptionByHash(codeHash: string) {
    const raw = await this.command(["GET", this.redemptionKey(codeHash)]);
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw) as RedemptionRecord;
    } catch {
      return null;
    }
  }

  async getRedemptionBySession(sessionId: string) {
    const hash = await this.command(["GET", this.redemptionSessionKey(sessionId)]);
    return typeof hash === "string" ? this.getRedemptionByHash(hash) : null;
  }

  private async putRedemption(record: RedemptionRecord) {
    await this.command(["SET", this.redemptionKey(record.codeHash), JSON.stringify(record)]);
  }

  async markRedemptionDelivered(sessionId: string) {
    const record = await this.getRedemptionBySession(sessionId);
    if (!record) return;
    await this.putRedemption({ ...record, pendingCodeCiphertext: null });
  }

  async markRedemptionRedeemed(codeHash: string) {
    const record = await this.getRedemptionByHash(codeHash);
    if (!record) return null;
    const updated = {
      ...record,
      lastRedeemedAt: now(),
      redemptionCount: record.redemptionCount + 1,
    };
    await this.putRedemption(updated);
    return updated;
  }

  async revokeRedemption(codeHash: string, reason: string) {
    const record = await this.getRedemptionByHash(codeHash);
    if (!record) return null;
    const updated = { ...record, revoked: true, revocationReason: reason };
    await this.putRedemption(updated);
    return updated;
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
          email_provider_message_id TEXT,
          attempts       INTEGER NOT NULL DEFAULT 1,
          last_error     TEXT NOT NULL DEFAULT 'none',
          created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
        await sql`ALTER TABLE cf_fulfillment
          ADD COLUMN IF NOT EXISTS email_provider_message_id TEXT`;
        await sql`CREATE TABLE IF NOT EXISTS cf_docs (
          id         TEXT PRIMARY KEY,
          doc        JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
        await sql`CREATE TABLE IF NOT EXISTS cf_redemptions (
          code_hash                TEXT PRIMARY KEY,
          session_id               TEXT UNIQUE NOT NULL,
          tier                     TEXT NOT NULL,
          entitlement_reference    TEXT NOT NULL,
          purchase_timestamp       TIMESTAMPTZ NOT NULL,
          created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_redeemed_at         TIMESTAMPTZ,
          redemption_count         INTEGER NOT NULL DEFAULT 0,
          revoked                  BOOLEAN NOT NULL DEFAULT FALSE,
          revocation_reason        TEXT,
          pending_code_ciphertext  TEXT
        )`;
        await sql`CREATE INDEX IF NOT EXISTS cf_redemptions_session_idx
          ON cf_redemptions (session_id)`;
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
      emailProviderMessageId: row.email_provider_message_id
        ? String(row.email_provider_message_id)
        : null,
      attempts: Number(row.attempts),
      lastError: String(row.last_error) as ErrorCategory,
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }

  private toRedemption(row: Record<string, unknown>): RedemptionRecord {
    return {
      codeHash: String(row.code_hash),
      sessionId: String(row.session_id),
      tier: String(row.tier),
      entitlementReference: String(row.entitlement_reference),
      purchaseTimestamp: new Date(String(row.purchase_timestamp)).toISOString(),
      createdAt: new Date(String(row.created_at)).toISOString(),
      lastRedeemedAt: row.last_redeemed_at
        ? new Date(String(row.last_redeemed_at)).toISOString()
        : null,
      redemptionCount: Number(row.redemption_count),
      revoked: Boolean(row.revoked),
      revocationReason: row.revocation_reason ? String(row.revocation_reason) : null,
      pendingCodeCiphertext: row.pending_code_ciphertext
        ? String(row.pending_code_ciphertext)
        : null,
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
        email_provider_message_id = COALESCE(
          ${patch.emailProviderMessageId ?? null},
          email_provider_message_id
        ),
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

  async createRedemption(record: RedemptionRecord) {
    await this.ensure();
    const sql = await this.sql();
    const existing = await sql`SELECT * FROM cf_redemptions WHERE session_id = ${record.sessionId}`;
    if (existing.length) return { record: this.toRedemption(existing[0]), created: false };

    const inserted = await sql`
      INSERT INTO cf_redemptions
        (code_hash, session_id, tier, entitlement_reference, purchase_timestamp,
         created_at, pending_code_ciphertext)
      VALUES
        (${record.codeHash}, ${record.sessionId}, ${record.tier},
         ${record.entitlementReference}, ${record.purchaseTimestamp},
         ${record.createdAt}, ${record.pendingCodeCiphertext})
      ON CONFLICT DO NOTHING
      RETURNING *`;
    if (inserted.length) return { record: this.toRedemption(inserted[0]), created: true };

    const raced = await sql`SELECT * FROM cf_redemptions WHERE session_id = ${record.sessionId}`;
    if (raced.length) return { record: this.toRedemption(raced[0]), created: false };
    throw new Error("redemption_code_collision");
  }

  async getRedemptionByHash(codeHash: string) {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`SELECT * FROM cf_redemptions WHERE code_hash = ${codeHash}`;
    return rows.length ? this.toRedemption(rows[0]) : null;
  }

  async getRedemptionBySession(sessionId: string) {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`SELECT * FROM cf_redemptions WHERE session_id = ${sessionId}`;
    return rows.length ? this.toRedemption(rows[0]) : null;
  }

  async markRedemptionDelivered(sessionId: string) {
    await this.ensure();
    const sql = await this.sql();
    await sql`UPDATE cf_redemptions
                 SET pending_code_ciphertext = NULL
               WHERE session_id = ${sessionId}`;
  }

  async markRedemptionRedeemed(codeHash: string) {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`
      UPDATE cf_redemptions
         SET last_redeemed_at = NOW(),
             redemption_count = redemption_count + 1
       WHERE code_hash = ${codeHash}
      RETURNING *`;
    return rows.length ? this.toRedemption(rows[0]) : null;
  }

  async revokeRedemption(codeHash: string, reason: string) {
    await this.ensure();
    const sql = await this.sql();
    const rows = await sql`
      UPDATE cf_redemptions
         SET revoked = TRUE,
             revocation_reason = ${reason}
       WHERE code_hash = ${codeHash}
      RETURNING *`;
    return rows.length ? this.toRedemption(rows[0]) : null;
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
