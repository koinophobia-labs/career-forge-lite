/**
 * The ONLY writer of live-commerce approvals — and it is not part of the runtime.
 *
 * The application store (`FulfillmentStore`) can read an approval but has no
 * method to write one. Writing lives here, in a Postgres-only module used
 * exclusively by scripts/authorize-live-commerce.mjs, and it connects with the
 * OFFLINE APPROVER credential (`APPROVAL_DATABASE_URL`) — never the application
 * DATABASE_URL, never KV, never memory.
 *
 * Two things must both be true for a write to land in cf_approvals:
 *   1. the connection is the approver role (this module refuses anything that is
 *      not a Postgres URL, and the database rejects the INSERT unless the role
 *      holds write — the app role is granted SELECT only);
 *   2. the row is an owner-signed approval (verified separately by the runtime).
 *
 * A leaked application DATABASE_URL cannot be used here: it is not the approver
 * credential, so even if passed, Postgres denies the INSERT.
 */

const APPROVER_URL = () => process.env.APPROVAL_DATABASE_URL?.trim();

/** Human-readable reason the signer must refuse, or null if the config is usable. */
export function approverConfigError(): string | null {
  const url = APPROVER_URL();
  if (!url) {
    return "APPROVAL_DATABASE_URL is not set. The signer requires the offline approver credential, never the application DATABASE_URL, KV, or memory.";
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return "APPROVAL_DATABASE_URL must be a Postgres connection string. KV and memory cannot isolate approval writes from the payment path.";
  }
  return null;
}

async function sql() {
  const err = approverConfigError();
  if (err) throw new Error(err);
  const { neon } = await import("@neondatabase/serverless");
  return neon(APPROVER_URL()!);
}

/** Read certification evidence so the signer can bind the correct evidence id. */
export async function readApproverDoc<T>(id: string): Promise<T | null> {
  const q = await sql();
  const rows = await q`SELECT doc FROM cf_docs WHERE id = ${id}`;
  return rows.length ? (rows[0].doc as T) : null;
}

/**
 * Write a signed approval. Throws if the connected role lacks write on
 * cf_approvals (Postgres "permission denied") — that is the database lock, and
 * it is why an application credential cannot record an approval even by mistake.
 */
export async function recordApproval<T>(id: string, signedApproval: T): Promise<void> {
  const q = await sql();
  await q`
    INSERT INTO cf_approvals (id, approval)
    VALUES (${id}, ${JSON.stringify(signedApproval)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET approval = EXCLUDED.approval, created_at = NOW()`;
}
