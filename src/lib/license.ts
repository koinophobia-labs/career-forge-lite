// A Career Forge entitlement is a server-signed statement about a purchase.
// The browser may store it, but cannot change its tier or expiration without
// invalidating the signature. No career data, email address, or identity is in
// the payload.
//
// Format: CF1.<base64url payload JSON>.<base64url ECDSA-P256-SHA256 signature>

import {
  isPackageTier,
  normalizePackageTier,
  type PackageTier
} from "@/lib/packages";

export const LICENSE_PREFIX = "CF1";

export type LicensePayload = {
  // v1 is accepted for previously issued $49/$79/$99 keys. New purchases use
  // v2, whose optional expiration is part of the signed statement.
  v: 1 | 2;
  tier: PackageTier;
  ref: string;
  iat: number;
  exp?: number;
};

export type LicenseVerification =
  | { ok: true; payload: LicensePayload }
  | {
      ok: false;
      reason:
        | "malformed"
        | "bad-signature"
        | "bad-payload"
        | "no-public-key"
        | "crypto-unavailable"
        | "expired";
      payload?: LicensePayload;
    };

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

export function parseLicenseKey(key: string): { payloadB64: string; signatureB64: string } | null {
  const trimmed = key.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX || !parts[1] || !parts[2]) return null;
  return { payloadB64: parts[1], signatureB64: parts[2] };
}

function parsePayload(bytes: Uint8Array): LicensePayload | null {
  try {
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || (raw.v !== 1 && raw.v !== 2)) return null;

    const tier = raw.v === 1 ? normalizePackageTier(raw.tier) : isPackageTier(raw.tier) ? raw.tier : null;
    if (!tier) return null;
    if (typeof raw.ref !== "string" || !raw.ref || raw.ref.length > 160) return null;
    if (typeof raw.iat !== "number" || !Number.isFinite(raw.iat) || raw.iat <= 0) return null;

    if (raw.exp !== undefined && (typeof raw.exp !== "number" || !Number.isFinite(raw.exp) || raw.exp <= raw.iat)) {
      return null;
    }
    if (raw.v === 2 && tier === "all-access" && raw.exp === undefined) return null;

    return {
      v: raw.v,
      tier,
      ref: raw.ref,
      iat: Math.floor(raw.iat),
      ...(typeof raw.exp === "number" ? { exp: Math.floor(raw.exp) } : {})
    };
  } catch {
    return null;
  }
}

export function getLicensePublicKeyB64(): string | null {
  const configured = process.env.NEXT_PUBLIC_LICENSE_PUBLIC_KEY;
  return configured && configured.trim() ? configured.trim() : null;
}

export function entitlementIdentity(payload: LicensePayload): string {
  return `${payload.tier}:${payload.ref}:${payload.iat}`;
}

export async function verifyLicenseKey(
  key: string,
  publicKeyB64: string | null = getLicensePublicKeyB64(),
  nowUnixSeconds = Math.floor(Date.now() / 1000)
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

  const payload = parsePayload(payloadBytes);
  if (!payload) return { ok: false, reason: "bad-payload" };
  if (payload.exp !== undefined && nowUnixSeconds >= payload.exp) {
    return { ok: false, reason: "expired", payload };
  }
  return { ok: true, payload };
}
