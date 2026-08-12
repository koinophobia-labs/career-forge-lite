// License keys are signed purchase statements, not standalone paid authority.
// CF1 is the legacy offline format. CF2 adds a stable entitlement id that must
// receive a current online revocation authorization before paid access opens.
// No career data, email, or identity is inside a key. A buyer can restore it
// from the dedicated Career Forge license email or through verified support.
//
// Formats: CF1 (legacy exchange input) and CF2 (revocable entitlement).
// ECDSA P-256 is used (not Ed25519) because it has been universally supported
// in browser WebCrypto for years.

import { isPackageTier, type PackageTier } from "@/lib/packages";

export const LEGACY_LICENSE_PREFIX = "CF1";
export const LICENSE_PREFIX = "CF2";
export const AUTHORIZATION_PREFIX = "CFA1";

export type LegacyLicensePayload = {
  v: 1;
  tier: PackageTier;
  // Opaque purchase reference (e.g. tail of the checkout session id) so a key
  // can be matched to a receipt in support conversations. Never identity.
  ref: string;
  // Unix seconds at mint. Perpetual license: no expiry field exists.
  iat: number;
};

export type RevocableLicensePayload = {
  v: 2;
  tier: PackageTier;
  ref: string;
  iat: number;
  /** Opaque durable identity. Never an email address or a Stripe object id. */
  entitlementId: string;
};

export type LicensePayload = LegacyLicensePayload | RevocableLicensePayload;

export type AuthorizationPayload = {
  v: 1;
  tier: PackageTier;
  entitlementId: string;
  checkedAt: number;
  expiresAt: number;
};

export type LicenseVerification =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "bad-payload" | "no-public-key" | "crypto-unavailable" };

export type AuthorizationVerification =
  | { ok: true; payload: AuthorizationPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "bad-payload" | "no-public-key" | "crypto-unavailable" };

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function parseLicenseKey(key: string): { prefix: typeof LEGACY_LICENSE_PREFIX | typeof LICENSE_PREFIX; payloadB64: string; signatureB64: string } | null {
  const trimmed = key.trim();
  const parts = trimmed.split(".");
  if (
    parts.length !== 3 ||
    (parts[0] !== LEGACY_LICENSE_PREFIX && parts[0] !== LICENSE_PREFIX) ||
    !parts[1] ||
    !parts[2]
  ) return null;
  return { prefix: parts[0], payloadB64: parts[1], signatureB64: parts[2] };
}

export function parseAuthorizationReceipt(value: string): { payloadB64: string; signatureB64: string } | null {
  const parts = value.trim().split(".");
  if (parts.length !== 3 || parts[0] !== AUTHORIZATION_PREFIX || !parts[1] || !parts[2]) return null;
  return { payloadB64: parts[1], signatureB64: parts[2] };
}

function parsePayload(bytes: Uint8Array, prefix: typeof LEGACY_LICENSE_PREFIX | typeof LICENSE_PREFIX): LicensePayload | null {
  try {
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (!raw || typeof raw !== "object") return null;
    if (!isPackageTier(raw.tier)) return null;
    if (typeof raw.ref !== "string" || !raw.ref) return null;
    if (typeof raw.iat !== "number" || !Number.isFinite(raw.iat)) return null;
    if (prefix === LEGACY_LICENSE_PREFIX && raw.v === 1) {
      return { v: 1, tier: raw.tier, ref: raw.ref, iat: raw.iat };
    }
    if (
      prefix === LICENSE_PREFIX &&
      raw.v === 2 &&
      typeof raw.entitlementId === "string" &&
      /^[0-9a-f]{32}$/.test(raw.entitlementId)
    ) {
      return {
        v: 2,
        tier: raw.tier,
        ref: raw.ref,
        iat: raw.iat,
        entitlementId: raw.entitlementId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// The verifying public key ships with the app (it is public by definition).
// Provided via env so deployments can rotate it without a code change.
export function getLicensePublicKeyB64(): string | null {
  const configured = process.env.NEXT_PUBLIC_LICENSE_PUBLIC_KEY;
  return configured && configured.trim() ? configured.trim() : null;
}

export async function verifyLicenseKey(
  key: string,
  publicKeyB64: string | null = getLicensePublicKeyB64()
): Promise<LicenseVerification> {
  const parts = parseLicenseKey(key);
  if (!parts) return { ok: false, reason: "malformed" };
  if (!publicKeyB64) return { ok: false, reason: "no-public-key" };

  const payloadBytes = base64UrlToBytes(parts.payloadB64);
  const signatureBytes = base64UrlToBytes(parts.signatureB64);
  const publicKeyBytes = base64UrlToBytes(publicKeyB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (!payloadBytes || !signatureBytes) return { ok: false, reason: "malformed" };
  if (!publicKeyBytes) return { ok: false, reason: "no-public-key" };

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, reason: "crypto-unavailable" };

  try {
    const publicKey = await subtle.importKey(
      "spki",
      publicKeyBytes.buffer.slice(publicKeyBytes.byteOffset, publicKeyBytes.byteOffset + publicKeyBytes.byteLength) as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const valid = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes.buffer.slice(signatureBytes.byteOffset, signatureBytes.byteOffset + signatureBytes.byteLength) as ArrayBuffer,
      payloadBytes.buffer.slice(payloadBytes.byteOffset, payloadBytes.byteOffset + payloadBytes.byteLength) as ArrayBuffer
    );
    if (!valid) return { ok: false, reason: "bad-signature" };
  } catch {
    return { ok: false, reason: "bad-signature" };
  }

  const payload = parsePayload(payloadBytes, parts.prefix);
  if (!payload) return { ok: false, reason: "bad-payload" };
  return { ok: true, payload };
}

export async function verifyAuthorizationReceipt(
  receipt: string,
  publicKeyB64: string | null = getLicensePublicKeyB64()
): Promise<AuthorizationVerification> {
  const parts = parseAuthorizationReceipt(receipt);
  if (!parts) return { ok: false, reason: "malformed" };
  if (!publicKeyB64) return { ok: false, reason: "no-public-key" };
  const payloadBytes = base64UrlToBytes(parts.payloadB64);
  const signatureBytes = base64UrlToBytes(parts.signatureB64);
  const publicKeyBytes = base64UrlToBytes(publicKeyB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (!payloadBytes || !signatureBytes) return { ok: false, reason: "malformed" };
  if (!publicKeyBytes) return { ok: false, reason: "no-public-key" };
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, reason: "crypto-unavailable" };
  try {
    const publicKey = await subtle.importKey(
      "spki",
      publicKeyBytes.buffer.slice(publicKeyBytes.byteOffset, publicKeyBytes.byteOffset + publicKeyBytes.byteLength) as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const valid = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes.buffer.slice(signatureBytes.byteOffset, signatureBytes.byteOffset + signatureBytes.byteLength) as ArrayBuffer,
      payloadBytes.buffer.slice(payloadBytes.byteOffset, payloadBytes.byteOffset + payloadBytes.byteLength) as ArrayBuffer
    );
    if (!valid) return { ok: false, reason: "bad-signature" };
  } catch {
    return { ok: false, reason: "bad-signature" };
  }
  try {
    const raw = JSON.parse(new TextDecoder().decode(payloadBytes)) as Record<string, unknown>;
    if (
      raw.v !== 1 ||
      !isPackageTier(raw.tier) ||
      typeof raw.entitlementId !== "string" ||
      !/^[0-9a-f]{32}$/.test(raw.entitlementId) ||
      typeof raw.checkedAt !== "number" ||
      !Number.isFinite(raw.checkedAt) ||
      typeof raw.expiresAt !== "number" ||
      !Number.isFinite(raw.expiresAt) ||
      raw.expiresAt - raw.checkedAt !== 86_400_000
    ) return { ok: false, reason: "bad-payload" };
    return {
      ok: true,
      payload: {
        v: 1,
        tier: raw.tier,
        entitlementId: raw.entitlementId,
        checkedAt: raw.checkedAt,
        expiresAt: raw.expiresAt,
      },
    };
  } catch {
    return { ok: false, reason: "bad-payload" };
  }
}
