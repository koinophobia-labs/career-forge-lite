// Server-only license minting. The ECDSA P-256 private key never ships to the
// client; the client verifies with the matching public key (see lib/license).
// Node's crypto must emit IEEE P1363 signatures because that is what browser
// WebCrypto verifies.

import { createPrivateKey, sign } from "node:crypto";
import {
  LEGACY_LICENSE_PREFIX,
  LICENSE_PREFIX,
  AUTHORIZATION_PREFIX,
  type AuthorizationPayload,
  type LegacyLicensePayload,
  type RevocableLicensePayload,
} from "@/lib/license";
import type { PackageTier } from "@/lib/packages";

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getSigningKeyB64(): string | null {
  const configured = process.env.LICENSE_SIGNING_PRIVATE_KEY;
  return configured && configured.trim() ? configured.trim() : null;
}

export function mintLicenseKey(
  tier: PackageTier,
  ref: string,
  issuedAtUnixSeconds: number,
  privateKeyB64: string | null = getSigningKeyB64()
): string | null {
  if (!privateKeyB64) return null;
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyB64, "base64"),
      format: "der",
      type: "pkcs8"
    });
    const payload: LegacyLicensePayload = { v: 1, tier, ref, iat: Math.floor(issuedAtUnixSeconds) };
    const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = sign("sha256", payloadBytes, { key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${LEGACY_LICENSE_PREFIX}.${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`;
  } catch {
    return null;
  }
}

export function mintRevocableLicenseKey(
  tier: PackageTier,
  ref: string,
  issuedAtUnixSeconds: number,
  entitlementId: string,
  privateKeyB64: string | null = getSigningKeyB64()
): string | null {
  if (!privateKeyB64 || !/^[0-9a-f]{32}$/.test(entitlementId)) return null;
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyB64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const payload: RevocableLicensePayload = {
      v: 2,
      tier,
      ref,
      iat: Math.floor(issuedAtUnixSeconds),
      entitlementId,
    };
    const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = sign("sha256", payloadBytes, {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    });
    return `${LICENSE_PREFIX}.${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`;
  } catch {
    return null;
  }
}

export function mintAuthorizationReceipt(
  tier: PackageTier,
  entitlementId: string,
  checkedAt: number,
  expiresAt: number,
  privateKeyB64: string | null = getSigningKeyB64()
): string | null {
  if (
    !privateKeyB64 ||
    !/^[0-9a-f]{32}$/.test(entitlementId) ||
    !Number.isFinite(checkedAt) ||
    expiresAt - checkedAt !== 86_400_000
  ) return null;
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyB64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const payload: AuthorizationPayload = { v: 1, tier, entitlementId, checkedAt, expiresAt };
    const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = sign("sha256", payloadBytes, { key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${AUTHORIZATION_PREFIX}.${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`;
  } catch {
    return null;
  }
}
