import { NextResponse } from "next/server";
import { isPackageTier } from "@/lib/packages";
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
    const paymentLink = getLiveResetPaymentLinkUrl();
    if (!paymentLink) {
      return NextResponse.json(
        { error: "Payments are not configured on this deployment." },
        { status: 503 }
      );
    }
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
