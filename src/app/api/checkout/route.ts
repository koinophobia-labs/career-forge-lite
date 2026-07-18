import { NextResponse } from "next/server";
import { isPackageTier } from "@/lib/packages";
import { getFoundingPaymentLink } from "@/lib/server/founding-payment-link";
import { createCheckoutSession, getStripeSecretKey } from "@/lib/server/stripe";

// Starts a one-time-purchase checkout for a package tier. The only client
// input is the tier name; the price comes from the server-side package config.
// No career data is ever sent here.

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim()) return configured.trim().replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 }
    );
  }

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
  const configuredTier = process.env.PAID_BETA_TIER;
  const paidBetaTier = configuredTier === "job-search" || configuredTier === "career-switch" ? configuredTier : "reset";
  if (process.env.NEXT_PUBLIC_COMMERCE_MODE === "live" && tier !== paidBetaTier) {
    return NextResponse.json({ error: "That package is not open in the founding paid beta yet." }, { status: 403 });
  }

  // The founding cohort uses a Stripe Payment Link capped at five completed
  // sessions. Returning it from the normal checkout endpoint keeps every client
  // surface on the same path while Stripe enforces the cohort capacity.
  const foundingPaymentLink = process.env.NEXT_PUBLIC_COMMERCE_MODE === "live"
    ? getFoundingPaymentLink()
    : null;
  if (foundingPaymentLink && tier === paidBetaTier) {
    return NextResponse.json({ url: foundingPaymentLink });
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
