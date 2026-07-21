export const REDEMPTION_CODE_PREFIX = "CF";
// 31 unambiguous uppercase letters/digits plus "star" keeps the customer code
// at exactly 12 symbols while providing a full 5 bits per symbol.
export const REDEMPTION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789*";
export const REDEMPTION_CODE_CHARACTERS = 12;
export const REDEMPTION_CODE_ENTROPY_BITS = 60;

const alphabetPattern = new RegExp(
  `^${REDEMPTION_CODE_PREFIX}[${REDEMPTION_CODE_ALPHABET}]{${REDEMPTION_CODE_CHARACTERS}}$`
);

/** Canonical hash input. Spaces and hyphens are presentation only. */
export function normalizeRedemptionCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "");
  return alphabetPattern.test(normalized) ? normalized : null;
}

export function formatNormalizedRedemptionCode(normalized: string): string | null {
  if (!alphabetPattern.test(normalized)) return null;
  const body = normalized.slice(REDEMPTION_CODE_PREFIX.length);
  return `${REDEMPTION_CODE_PREFIX}-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

/** Mobile-friendly display formatting while preserving legacy CF1 keys. */
export function formatAccessCodeInput(value: string): string {
  const trimmedStart = value.trimStart();
  if (/^CF1\./i.test(trimmedStart)) return trimmedStart;

  const compact = value.toUpperCase().replace(/[\s-]+/g, "").replace(/[^A-Z0-9*]/g, "").slice(0, 14);
  if (compact.length <= 2) return compact;
  const prefix = compact.slice(0, 2);
  const body = compact.slice(2);
  return [prefix, body.slice(0, 4), body.slice(4, 8), body.slice(8, 12)]
    .filter(Boolean)
    .join("-");
}

export function isLegacyLicenseKey(value: string): boolean {
  return value.trim().startsWith("CF1.");
}
