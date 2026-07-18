import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PackageTier } from "@/lib/packages";
import { mintLicenseKey } from "@/lib/server/license-mint";

export const FOUNDER_INVITE_TIER: PackageTier = "job-search";

// SHA-256("lazyboikoi"). The public repository never needs the plaintext code,
// and production can replace or disable it without changing the client bundle.
const DEFAULT_FOUNDER_INVITE_CODE_SHA256 = "5216551874a15fa31d3f90385cde3755058a97ac8df1a94e5f9e2fda3251e1cf";

export function getFounderInviteHash(): string | null {
  if (process.env.FOUNDER_INVITE_ENABLED?.trim().toLowerCase() === "false") return null;
  const configured = process.env.FOUNDER_INVITE_CODE_SHA256?.trim().toLowerCase();
  const candidate = configured || DEFAULT_FOUNDER_INVITE_CODE_SHA256;
  return /^[a-f0-9]{64}$/.test(candidate) ? candidate : null;
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
