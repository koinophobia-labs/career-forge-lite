import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PackageTier } from "@/lib/packages";
import { mintLicenseKey } from "@/lib/server/license-mint";

// A founder invite comps the entry ("reset") tier — the same tier the live paid
// beta actually sells. An invite must never grant a HIGHER tier than a real
// purchase can buy.
export const FOUNDER_INVITE_TIER: PackageTier = "reset";

// The founder invite is OFF unless a deployment explicitly opts in AND supplies
// its own per-deployment code hash. There is deliberately NO shipped default
// hash: a code baked into the public client bundle is a backdoor, not a
// credential. With neither env var set, getFounderInviteHash() returns null and
// every submitted code is rejected (fail-closed).
export function getFounderInviteHash(): string | null {
  if (process.env.FOUNDER_INVITE_ENABLED?.trim().toLowerCase() !== "true") return null;
  const configured = process.env.FOUNDER_INVITE_CODE_SHA256?.trim().toLowerCase();
  if (!configured) return null;
  return /^[a-f0-9]{64}$/.test(configured) ? configured : null;
}

export function founderInviteCodeMatches(code: unknown, expectedHash: string | null = getFounderInviteHash()): boolean {
  if (typeof code !== "string" || !expectedHash) return false;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return false;

  const actual = createHash("sha256").update(normalized, "utf8").digest();
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function mintFounderInviteLicense(
  privateKeyB64: string | null,
  issuedAtUnixSeconds: number = Math.floor(Date.now() / 1000),
  reference: string = `founder-${randomBytes(6).toString("hex")}`
): string | null {
  if (!privateKeyB64) return null;
  return mintLicenseKey(FOUNDER_INVITE_TIER, reference, issuedAtUnixSeconds, privateKeyB64);
}
