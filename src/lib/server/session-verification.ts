/**
 * Verify a Checkout Session against Stripe itself.
 *
 * The loophole this closes
 * ------------------------
 * A valid webhook signature proves only that the sender holds the endpoint
 * secret. It says nothing about whether a Checkout Session ever existed, a
 * payment completed, or the tier claimed in `metadata` is the tier that was
 * actually paid for. Anyone with the secret — including our own drill script —
 * could fabricate a "paid" event and have it believed.
 *
 * So the signature is now only the gate that says "this is worth looking up".
 * Everything load-bearing is re-read from Stripe:
 *
 *   - the Session must EXIST in the account our key belongs to
 *   - `payment_status` must be `paid` per Stripe, not per the payload
 *   - the amount and currency must match the package
 *   - the TIER is derived from the line item's price, never from metadata
 *
 * That last one matters most. Metadata is caller-controlled; a price id is not.
 */

import { getPackage, isPackageTier, PACKAGE_ORDER, type PackageTier } from "@/lib/packages";

export type VerifiedSession = {
  sessionId: string;
  tier: PackageTier;
  amountTotal: number;
  currency: string;
  livemode: boolean;
  customerEmail: string | null;
  stripeAccountId: string | null;
  priceId: string | null;
  created: number;
};

export type VerificationFailure = {
  ok: false;
  /** Machine-readable so the webhook can log a category, not a sentence. */
  reason:
    | "session_not_found"
    | "session_id_mismatch"
    | "not_paid"
    | "amount_mismatch"
    | "currency_mismatch"
    | "unknown_price"
    | "tier_mismatch"
    | "no_email"
    | "lookup_failed";
  detail: string;
};

export type VerificationResult = { ok: true; session: VerifiedSession } | VerificationFailure;

/**
 * Authoritative price → tier mapping.
 *
 * Configured server-side. A price id present here is the ONLY thing that can
 * establish which package was bought. `STRIPE_PRICE_<TIER>` env entries let a
 * test-mode deployment map its own price ids without touching code.
 */
export function priceTierMap(): Map<string, PackageTier> {
  const map = new Map<string, PackageTier>();
  const envKey: Record<PackageTier, string> = {
    reset: "STRIPE_PRICE_RESET",
    "job-search": "STRIPE_PRICE_JOB_SEARCH",
    "career-switch": "STRIPE_PRICE_CAREER_SWITCH",
  };
  for (const tier of PACKAGE_ORDER) {
    const configured = process.env[envKey[tier]]?.trim();
    if (configured) map.set(configured, tier);
  }
  return map;
}

/** Tier from an authoritative price id. Never from metadata. */
export function tierForPriceId(priceId: string | null | undefined): PackageTier | null {
  if (!priceId) return null;
  return priceTierMap().get(priceId) ?? null;
}

type StripeSessionShape = {
  id?: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  livemode?: boolean;
  created?: number;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: string | null } | null;
  line_items?: { data?: Array<{ price?: { id?: string; product?: string } | null }> } | null;
};

/**
 * Re-read a session from Stripe and decide whether it is real paid evidence.
 *
 * `fetchSession` is injected so tests can drive every failure branch without a
 * network or a live key.
 */
export async function verifyPaidSession(
  claimedSessionId: string,
  fetchSession: (id: string) => Promise<
    { ok: true; session: unknown; accountId?: string | null } | { ok: false; status: number }
  >,
  authoritativePrices: Map<string, PackageTier> = priceTierMap()
): Promise<VerificationResult> {
  let looked;
  try {
    looked = await fetchSession(claimedSessionId);
  } catch {
    return { ok: false, reason: "lookup_failed", detail: "Stripe lookup threw." };
  }

  if (!looked.ok) {
    return looked.status === 404
      ? { ok: false, reason: "session_not_found", detail: "Stripe has no such Checkout Session." }
      : { ok: false, reason: "lookup_failed", detail: `Stripe lookup failed (${looked.status}).` };
  }

  const session = looked.session as StripeSessionShape;

  // The payload could name one session and the lookup return another.
  if (!session.id || session.id !== claimedSessionId) {
    return {
      ok: false,
      reason: "session_id_mismatch",
      detail: "Retrieved session id does not match the event payload.",
    };
  }

  // Stripe's word on payment, not the payload's.
  if (session.payment_status !== "paid") {
    return {
      ok: false,
      reason: "not_paid",
      detail: `Stripe reports payment_status="${session.payment_status ?? "unknown"}".`,
    };
  }

  const priceId = session.line_items?.data?.[0]?.price?.id ?? null;
  const tier = priceId ? authoritativePrices.get(priceId) ?? null : null;
  if (!tier) {
    return {
      ok: false,
      reason: "unknown_price",
      detail: priceId
        ? `Price ${priceId} is not a known Career Forge package.`
        : "Session has no line-item price to identify the package.",
    };
  }

  // If metadata disagrees with the price, the price wins and we say so loudly.
  const claimedTier = session.metadata?.tier;
  if (claimedTier && isPackageTier(claimedTier) && claimedTier !== tier) {
    return {
      ok: false,
      reason: "tier_mismatch",
      detail: `metadata.tier="${claimedTier}" contradicts the paid price (${tier}).`,
    };
  }

  const pack = getPackage(tier);
  const expectedAmount = pack.priceUsd * 100;
  if (typeof session.amount_total !== "number" || session.amount_total !== expectedAmount) {
    return {
      ok: false,
      reason: "amount_mismatch",
      detail: `Expected ${expectedAmount}, Stripe reports ${session.amount_total ?? "none"}.`,
    };
  }

  if ((session.currency ?? "").toLowerCase() !== "usd") {
    return {
      ok: false,
      reason: "currency_mismatch",
      detail: `Expected usd, Stripe reports ${session.currency ?? "none"}.`,
    };
  }

  const customerEmail = session.customer_details?.email?.trim() || null;
  if (!customerEmail) {
    return { ok: false, reason: "no_email", detail: "Retrieved session carries no customer email." };
  }

  return {
    ok: true,
    session: {
      sessionId: session.id,
      tier,
      amountTotal: session.amount_total,
      currency: session.currency!.toLowerCase(),
      livemode: session.livemode === true,
      customerEmail,
      stripeAccountId: looked.accountId ?? null,
      priceId,
      created: session.created ?? 0,
    },
  };
}
