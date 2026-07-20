import { NextResponse } from "next/server";
import { isPackageTier } from "@/lib/packages";
import { fulfillmentReadiness } from "@/lib/server/fulfillment-readiness";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import { createCheckoutSession, getLiveResetPaymentLinkUrl, getStripeSecretKey } from "@/lib/server/stripe";

// Starts a one-time-purchase checkout for a package tier. The only client
// input is the tier name; the price comes from the server-side package config.
// No career data is ever sent here.

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim()) return configured.trim().replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function POST(request: Request): Promise<NextResponse> {
  let tier: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    tier = body.tier;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isPackageTier(tier)) {
    return NextResponse.json({ error: "Unknown package." }, { status: 400 });
  }
  const liveMode = process.env.NEXT_PUBLIC_COMMERCE_MODE === "live";
  if (liveMode && process.env.PAID_BETA_TIER !== "reset") {
    return NextResponse.json({ error: "Live commerce is not safely configured." }, { status: 503 });
  }
  if (liveMode && tier !== "reset") {
    return NextResponse.json({ error: "That package is not open in the founding paid beta yet." }, { status: 403 });
  }

  if (liveMode) {
    // A deployment may not take money unless it can deliver without depending
    // on the customer's browser surviving the round trip. See
    // lib/server/fulfillment-readiness.ts for why this gate exists.
    const readiness = fulfillmentReadiness();
    if (!readiness.ready) {
      logCommerceEvent("checkout_blocked_unsafe", {
        reason: "fulfillment_not_ready",
        missing: readiness.missing,
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

    const paymentLink = getLiveResetPaymentLinkUrl();
    if (!paymentLink) {
      return NextResponse.json(
        { error: "Payments are not configured on this deployment." },
        { status: 503 }
      );
    }
    logCommerceEvent("checkout_opened", { tier, mode: "live" });
    return NextResponse.json({ url: paymentLink });
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 }
    );
  }

  const result = await createCheckoutSession(tier, requestOrigin(request), secretKey);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (!result.session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }
  return NextResponse.json({ url: result.session.url });
}
