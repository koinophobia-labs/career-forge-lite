/**
 * Cryptographic authorization for live commerce.
 *
 * The boundary this replaces
 * --------------------------
 * Live-checkout approval used to be a plain JSON document in `cf_docs`. Anything
 * holding the application's DATABASE_URL — the deployed app, the certification
 * route, the webhook, the Vercel runtime, or an agent session that had exported
 * the connection string — could `INSERT INTO cf_docs` an approval that named
 * "Blake Taylor" as actor and declared itself valid. On 2026-07-21 exactly that
 * happened: a raw SQL insert opened the shop without any human act. Possession
 * of database write access was equivalent to impersonating the owner.
 *
 * The fix
 * -------
 * An approval is now a statement SIGNED by the release owner's private key,
 * which lives only offline — never in Vercel, the repository, or any automation
 * environment. The runtime verifies that signature with a PUBLIC key, which
 * grants no power to create approvals. Writing a row to the database is no
 * longer sufficient: without the private signing key, no forged row verifies,
 * so the gate rejects it however it arrived.
 *
 * The actor string inside a payload is informational only. The signature is the
 * proof. A row that says "Blake Taylor" but is unsigned, wrongly signed, or
 * bound to a different commit/surface/host/environment/evidence is refused.
 */

import { createPublicKey, verify as edVerify, type KeyObject } from "node:crypto";

/**
 * The fields an owner signs over. Each one scopes the approval so it cannot be
 * lifted onto anything it was not granted for.
 */
export type ApprovalPayload = {
  /** Exact deployed commit the approval covers. */
  approvedCommitSha: string;
  /** Fingerprint of the certified payment surface at approval time. */
  approvedSurfaceHash: string;
  /** Production hostname the approval covers. */
  approvedHost: string;
  /** Deployment environment the approval covers. */
  approvedEnvironment: string;
  /** Ties the approval to one specific certification evidence document. */
  evidenceId: string;
  /** Informational only. NEVER used as proof of authorization. */
  approvalActor: string;
  /** When the owner signed. */
  approvedAt: string;
  /** Random, unique per approval — prevents a byte-for-byte replay. */
  nonce: string;
};

/** What is stored: the signed statement plus its detached signature. */
export type SignedApproval = {
  payload: ApprovalPayload;
  /** base64 Ed25519 signature over the canonical payload bytes. */
  signature: string;
  /** Signature scheme identifier; only "ed25519" is accepted. */
  alg: string;
};

const REQUIRED_FIELDS: Array<keyof ApprovalPayload> = [
  "approvedCommitSha",
  "approvedSurfaceHash",
  "approvedHost",
  "approvedEnvironment",
  "evidenceId",
  "approvalActor",
  "approvedAt",
  "nonce",
];

/**
 * Deterministic bytes for signing/verifying. Keys are emitted in a fixed order
 * so the signer and verifier always hash the same message regardless of object
 * key order in transit or storage.
 */
export function canonicalApprovalMessage(payload: ApprovalPayload): Buffer {
  const ordered: Record<string, string> = {};
  for (const key of [...REQUIRED_FIELDS].sort()) {
    ordered[key] = payload[key];
  }
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

/** Load a base64 SPKI Ed25519 public key, or null if absent/malformed. */
export function loadApprovalPublicKey(base64Spki: string | null | undefined): KeyObject | null {
  const trimmed = base64Spki?.trim();
  if (!trimmed) return null;
  try {
    const key = createPublicKey({
      key: Buffer.from(trimmed, "base64"),
      format: "der",
      type: "spki",
    });
    return key.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

export type SignatureCheck = { valid: boolean; reason: string | null };

/**
 * Is this a well-formed approval genuinely signed by the given public key?
 *
 * Fails closed: a missing key, missing signature, wrong algorithm, structurally
 * incomplete payload, or a signature that does not verify all return invalid.
 * No branch here trusts a field's contents — only the mathematics of the
 * signature decides.
 */
export function verifyApprovalSignature(
  approval: SignedApproval | null | undefined,
  publicKey: KeyObject | null
): SignatureCheck {
  if (!publicKey) {
    return { valid: false, reason: "No approval public key is installed; nothing can be verified." };
  }
  if (!approval || typeof approval !== "object") {
    return { valid: false, reason: "No approval is recorded." };
  }
  if (approval.alg !== "ed25519") {
    return { valid: false, reason: `Unsupported approval signature algorithm "${approval.alg}".` };
  }
  if (typeof approval.signature !== "string" || !approval.signature.trim()) {
    return { valid: false, reason: "Approval carries no signature." };
  }
  const payload = approval.payload;
  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "Approval has no signed payload." };
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof payload[field] !== "string" || !payload[field]) {
      return { valid: false, reason: `Approval payload is missing "${field}".` };
    }
  }
  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(approval.signature, "base64");
  } catch {
    return { valid: false, reason: "Approval signature is not valid base64." };
  }
  let ok = false;
  try {
    ok = edVerify(null, canonicalApprovalMessage(payload), publicKey, signatureBytes);
  } catch {
    ok = false;
  }
  return ok
    ? { valid: true, reason: null }
    : { valid: false, reason: "Approval signature does not verify against the installed owner key." };
}
