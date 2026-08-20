// Minimal Stripe REST client — checkout session create/retrieve and webhook
// signature verification are three small HTTP/HMAC operations, so the full
// SDK is not worth a dependency. Prices always come from the package config
// (server-side); the client never sends an amount.

import { createHmac, timingSafeEqual } from "node:crypto";
import { type PackageTier } from "@/lib/packages";

const STRIPE_API = "https://api.stripe.com/v1";

export function getStripeSecretKey(): string | null {
  const configured = process.env.STRIPE_SECRET_KEY;
  return configured && configured.trim() ? configured.trim() : null;
}

export type CertificationStripeConfig = {
  secretKey: string;
  priceResume: string;
  webhookSecret: string;
  operatorToken: string;
};

/**
 * Short-lived Stripe test configuration used to certify the production host
 * while its live checkout remains behind the human-authorization gate.
 *
 * All four values are required. Removing any one disables the operator route,
 * the test webhook verifier, and test-session license exchange together.
 */
export function getCertificationStripeConfig(): CertificationStripeConfig | null {
  const secretKey = process.env.CERTIFICATION_STRIPE_SECRET_KEY?.trim();
  const priceResume = process.env.CERTIFICATION_STRIPE_PRICE_RESUME?.trim();
  const webhookSecret = process.env.CERTIFICATION_STRIPE_WEBHOOK_SECRET?.trim();
  const operatorToken = process.env.CERTIFICATION_OPERATOR_TOKEN?.trim();
  if (!secretKey || !priceResume || !webhookSecret || !operatorToken) return null;
  if (!/^sk_test_|^rk_test_/.test(secretKey)) return null;
  return { secretKey, priceResume, webhookSecret, operatorToken };
}

export function stripeKeyMode(secretKey: string): "test" | "live" | "unknown" {
  if (/^(?:sk|rk)_test_/.test(secretKey)) return "test";
  if (/^(?:sk|rk)_live_/.test(secretKey)) return "live";
  return "unknown";
}

export function isStripePaymentLinkUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "buy.stripe.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      /^\/[A-Za-z0-9]+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  payment_status: string;
  status: string;
  created: number;
  metadata: Record<string, string>;
  customer_details?: { email?: string | null } | null;
  // Needed to verify a session against Stripe rather than trusting a payload:
  // the amount actually charged, the mode it was charged in, and the price id
  // that identifies which package was bought.
  amount_total?: number | null;
  currency?: string | null;
  livemode?: boolean;
  line_items?: { data?: Array<{ price?: { id?: string; product?: string } | null }> } | null;
};

async function stripeRequest(
  path: string,
  secretKey: string,
  body?: URLSearchParams,
  idempotencyKey?: string
): Promise<Response> {
  return fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });
}

/** Configured Stripe price id for a tier, if one exists. */
export const configuredPriceId = (tier: PackageTier): string | null => {
  const key = {
    resume: "STRIPE_PRICE_RESUME",
    job: "STRIPE_PRICE_JOB",
    career: "STRIPE_PRICE_CAREER",
    "all-access": "STRIPE_PRICE_ALL_ACCESS",
  }[tier];
  return key ? process.env[key]?.trim() || null : null;
};

export async function createCheckoutSession(
  tier: PackageTier,
  origin: string,
  secretKey: string,
  explicitPriceId?: string,
  extraMetadata: Record<string, string> = {},
  customerEmail?: string,
  idempotencyKey?: string
): Promise<{ ok: true; session: CheckoutSession } | { ok: false; status: number; error: string }> {
  const priceId = explicitPriceId?.trim() || configuredPriceId(tier);
  if (!priceId) {
    return { ok: false, status: 503, error: "That package is temporarily unavailable." };
  }

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price]": priceId,
    "metadata[tier]": tier,
    success_url: `${origin}/unlock?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    allow_promotion_codes: "false"
  });
  for (const [key, value] of Object.entries(extraMetadata)) {
    if (key === "tier" || !/^[a-zA-Z0-9_]+$/.test(key)) continue;
    params.set(`metadata[${key}]`, value);
  }
  if (customerEmail?.trim()) params.set("customer_email", customerEmail.trim());

  const response = await stripeRequest("/checkout/sessions", secretKey, params, idempotencyKey);
  if (!response.ok) {
    return { ok: false, status: response.status, error: "Stripe rejected the checkout request." };
  }
  const session = (await response.json()) as CheckoutSession;
  return { ok: true, session };
}

export async function retrieveCheckoutSession(
  sessionId: string,
  secretKey: string
): Promise<{ ok: true; session: CheckoutSession } | { ok: false; status: number; error: string }> {
  if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return { ok: false, status: 400, error: "Invalid session id." };
  }
  // line_items must be expanded explicitly — without it Stripe omits the price
  // id, which is the only authoritative signal of which package was paid for.
  const response = await stripeRequest(
    `/checkout/sessions/${sessionId}?expand[]=line_items`,
    secretKey
  );
  if (!response.ok) {
    return { ok: false, status: response.status === 404 ? 404 : 502, error: "Could not look up that checkout session." };
  }
  const session = (await response.json()) as CheckoutSession;
  return { ok: true, session };
}

// Stripe webhook signatures: header `t=<ts>,v1=<hmac>` where the HMAC-SHA256
// of `${ts}.${rawBody}` is keyed with the endpoint secret.
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  endpointSecret: string,
  toleranceSeconds = 300,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!signatureHeader) return false;
  const parts = new Map<string, string[]>();
  for (const piece of signatureHeader.split(",")) {
    const [key, value] = piece.split("=", 2);
    if (!key || !value) continue;
    const list = parts.get(key.trim()) ?? [];
    list.push(value.trim());
    parts.set(key.trim(), list);
  }
  const timestamp = Number(parts.get("t")?.[0]);
  const candidates = parts.get("v1") ?? [];
  if (!Number.isFinite(timestamp) || candidates.length === 0) return false;
  if (Math.abs(nowUnixSeconds - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", endpointSecret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}
