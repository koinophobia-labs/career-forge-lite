import { NextResponse } from "next/server";
import { isPackageTier } from "@/lib/packages";
import { sellVerdict } from "@/lib/server/fulfillment-readiness";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import {
  configuredPriceId,
  createCheckoutSession,
  getStripeSecretKey,
  stripeKeyMode
} from "@/lib/server/stripe";

// Starts a one-time-purchase checkout for a package tier. The only client
// input is the tier name; the price comes from the server-side package config.
// No career data is ever sent here.

function requestOrigin(request: Request, liveMode: boolean): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const candidate = configured?.trim() || new URL(request.url).origin;
  try {
    const url = new URL(candidate);
    if (url.username || url.password || url.search || url.hash) return null;
    if (liveMode && url.protocol !== "https:") return null;
    if (!liveMode && url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let tier: unknown;
  let requestId: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    tier = body.tier;
    requestId = body.requestId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isPackageTier(tier)) {
    return NextResponse.json({ error: "Unknown package." }, { status: 400 });
  }
  const commerceMode = process.env.NEXT_PUBLIC_COMMERCE_MODE?.trim() ?? "off";
  if (commerceMode !== "live" && commerceMode !== "test") {
    return NextResponse.json(
      { error: "Automated checkout is not available on this deployment. Free tools remain open.", code: "commerce_off" },
      { status: 403 }
    );
  }
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
  const liveMode = commerceMode === "live";
  const origin = requestOrigin(request, liveMode);
  if (!origin) {
    return NextResponse.json({ error: "Checkout return URLs are not safely configured." }, { status: 503 });
  }
  if (!configuredPriceId(tier)) {
    return NextResponse.json({ error: "That package is temporarily unavailable." }, { status: 503 });
  }

  if (liveMode) {
    // A deployment may not take money unless it can deliver without depending
    // on the customer's browser surviving the round trip. See
    // lib/server/fulfillment-readiness.ts for why this gate exists.
    const verdict = await sellVerdict();
    if (!verdict.canSellSafely) {
      logCommerceEvent("checkout_blocked_unsafe", {
        reason: "fulfillment_not_ready",
        blockers: verdict.blockers,
        tier,
      });
      return NextResponse.json(
        {
          error:
            "Checkout is temporarily closed. This deployment cannot guarantee delivery of a purchase yet, so it will not take payment.",
          code: "fulfillment_not_ready",
        },
        { status: 503 }
      );
    }

    // Live mode now creates a real Checkout Session rather than handing out a
    // static Payment Link. The Payment Link was fire-and-forget: the server
    // never learned the session id, so it could not verify payment, record it,
    // or notice a purchase that was never delivered.
    const liveSecret = getStripeSecretKey();
    if (!liveSecret) {
      return NextResponse.json(
        { error: "Payments are not configured on this deployment." },
        { status: 503 }
      );
    }
    if (stripeKeyMode(liveSecret) !== "live") {
      return NextResponse.json({ error: "Live payments are not safely configured." }, { status: 503 });
    }
    const created = await createCheckoutSession(
      tier,
      origin,
      liveSecret,
      undefined,
      {},
      undefined,
      `career-forge/${tier}/${requestId}`
    );
    if (!created.ok) {
      logCommerceEvent("checkout_blocked_unsafe", { reason: "stripe_rejected", tier });
      return NextResponse.json({ error: created.error }, { status: created.status });
    }
    logCommerceEvent("checkout_opened", { tier, mode: "live", sessionId: created.session.id });
    if (!created.session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }
    return NextResponse.json(
      { url: created.session.url },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 }
    );
  }
  if (stripeKeyMode(secretKey) !== "test") {
    return NextResponse.json(
      { error: "Test payments are not safely configured." },
      { status: 503 }
    );
  }

  const result = await createCheckoutSession(
    tier,
    origin,
    secretKey,
    undefined,
    {},
    undefined,
    `career-forge/${tier}/${requestId}`
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (!result.session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }
  return NextResponse.json(
    { url: result.session.url },
    { headers: { "Cache-Control": "no-store" } }
  );
}
