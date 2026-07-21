import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import {
  REDEMPTION_CODE_ALPHABET,
  REDEMPTION_CODE_CHARACTERS,
  REDEMPTION_CODE_PREFIX,
  formatNormalizedRedemptionCode,
  normalizeRedemptionCode,
} from "@/lib/redemption-code";
import type {
  FulfillmentStore,
  RedemptionRecord,
} from "@/lib/server/fulfillment-store";
import type { PackageTier } from "@/lib/packages";

export function getRedemptionCodePepper(): string | null {
  const configured = process.env.REDEMPTION_CODE_PEPPER;
  return configured?.trim() || null;
}

export function generateRedemptionCode(bytes: Uint8Array = randomBytes(REDEMPTION_CODE_CHARACTERS)): string {
  if (bytes.length < REDEMPTION_CODE_CHARACTERS) {
    throw new Error("redemption_randomness_too_short");
  }
  let body = "";
  for (let index = 0; index < REDEMPTION_CODE_CHARACTERS; index += 1) {
    body += REDEMPTION_CODE_ALPHABET[bytes[index] & 31];
  }
  return formatNormalizedRedemptionCode(`${REDEMPTION_CODE_PREFIX}${body}`)!;
}

export function hashRedemptionCode(normalizedCode: string, pepper: string): string {
  return createHmac("sha256", pepper).update(normalizedCode, "utf8").digest("hex");
}

function encryptionKey(pepper: string): Buffer {
  return createHash("sha256").update(`career-forge-redemption:${pepper}`, "utf8").digest();
}

/** Temporary retry material. It is erased as soon as email delivery is recorded. */
export function encryptPendingRedemptionCode(redemptionCode: string, pepper: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(pepper), iv);
  const ciphertext = Buffer.concat([cipher.update(redemptionCode, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptPendingRedemptionCode(value: string, pepper: string): string | null {
  try {
    const [ivB64, tagB64, ciphertextB64] = value.split(".");
    if (!ivB64 || !tagB64 || !ciphertextB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(pepper), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return normalizeRedemptionCode(plaintext) ? plaintext : null;
  } catch {
    return null;
  }
}

export type RedemptionIssueInput = {
  sessionId: string;
  tier: PackageTier;
  entitlementReference: string;
  purchaseTimestamp: string;
};

export async function issueRedemptionCode(
  store: FulfillmentStore,
  input: RedemptionIssueInput,
  pepper: string,
  generate: () => string = () => generateRedemptionCode()
): Promise<{ redemptionCode: string; record: RedemptionRecord }> {
  const existing = await store.getRedemptionBySession(input.sessionId);
  if (existing) {
    const pending = existing.pendingCodeCiphertext
      ? decryptPendingRedemptionCode(existing.pendingCodeCiphertext, pepper)
      : null;
    if (!pending) throw new Error("redemption_code_no_longer_recoverable");
    return { redemptionCode: pending, record: existing };
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const redemptionCode = generate();
    const normalized = normalizeRedemptionCode(redemptionCode);
    if (!normalized) throw new Error("generated_redemption_code_invalid");
    const record: RedemptionRecord = {
      codeHash: hashRedemptionCode(normalized, pepper),
      sessionId: input.sessionId,
      tier: input.tier,
      entitlementReference: input.entitlementReference,
      purchaseTimestamp: input.purchaseTimestamp,
      createdAt: new Date().toISOString(),
      lastRedeemedAt: null,
      redemptionCount: 0,
      revoked: false,
      revocationReason: null,
      pendingCodeCiphertext: encryptPendingRedemptionCode(redemptionCode, pepper),
    };
    try {
      const created = await store.createRedemption(record);
      const pending = created.record.pendingCodeCiphertext
        ? decryptPendingRedemptionCode(created.record.pendingCodeCiphertext, pepper)
        : null;
      if (!pending) throw new Error("redemption_code_no_longer_recoverable");
      return { redemptionCode: pending, record: created.record };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "redemption_code_collision") throw error;
    }
  }
  throw new Error("redemption_code_collision_budget_exhausted");
}
