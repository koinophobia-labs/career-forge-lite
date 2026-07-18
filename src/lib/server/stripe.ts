// Minimal Stripe REST client — checkout session create/retrieve and webhook
// signature verification are three small HTTP/HMAC operations, so the full
// SDK is not worth a dependency. Prices always come from the package config
// (server-side); the client never sends an amount.

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPackage, type PackageTier } from "@/lib/packages";

const STRIPE_API = "https://api.stripe.com/v1";

export function getStripeSecretKey(): string | null {
  const configured = process.env.STRIPE_SECRET_KEY;
  return configured && configured.trim() ? configured.trim() : null;
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

export function getLiveResetPaymentLinkUrl(): string | null {
  const configured = process.env.STRIPE_LIVE_RESET_PAYMENT_LINK;
  return isStripePaymentLinkUrl(configured) ? configured.trim() : null;
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  payment_status: string;
  status: string;
  created: number;
  metadata: Record<string, string>;
  customer_details?: { email?: string | null } | null;
};

async function stripeRequest(path: string, secretKey: string, body?: URLSearchParams): Promise<Response> {
  return fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });
}

export async function createCheckoutSession(
  tier: PackageTier,
  origin: string,
  secretKey: string
): Promise<{ ok: true; session: CheckoutSession } | { ok: false; status: number; error: string }> {
  const pack = getPackage(tier);
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(pack.priceUsd * 100),
    "line_items[0][price_data][product_data][name]": `Career Forge — ${pack.name}`,
    "line_items[0][price_data][product_data][description]": pack.summary,
    "metadata[tier]": tier,
    success_url: `${origin}/unlock?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    allow_promotion_codes: "true"
  });

  const response = await stripeRequest("/checkout/sessions", secretKey, params);
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
  const response = await stripeRequest(`/checkout/sessions/${sessionId}`, secretKey);
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
