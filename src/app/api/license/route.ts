import { NextResponse } from "next/server";
import { getPackage, isPackageTier } from "@/lib/packages";
import { getSigningKeyB64, mintLicenseKey } from "@/lib/server/license-mint";
import { getStripeSecretKey, retrieveCheckoutSession } from "@/lib/server/stripe";

// Exchanges a completed checkout session for a license key. The session id is
// an unguessable secret that only the buyer's browser receives from Stripe, so
// possessing it proves the purchase — no account or database needed. Calling
// this again with the same session always yields a valid key for the same
// tier, which makes fulfillment safely retryable.

export async function GET(request: Request): Promise<NextResponse> {
  const secretKey = getStripeSecretKey();
  const signingKey = getSigningKeyB64();
  if (!secretKey || !signingKey) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 }
    );
  }

  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const result = await retrieveCheckoutSession(sessionId, secretKey);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const session = result.session;
  if (session.payment_status !== "paid") {
    // Delayed payment methods land here until they settle; the unlock page
    // tells the buyer to retry from their receipt link.
    return NextResponse.json(
      { error: "This purchase has not finished processing yet. Try again in a few minutes.", pending: true },
      { status: 409 }
    );
  }

  const tier = session.metadata?.tier;
  if (!isPackageTier(tier)) {
    return NextResponse.json({ error: "This checkout session is not a Career Forge package." }, { status: 400 });
  }

  const license = mintLicenseKey(tier, session.id.slice(-10), session.created, signingKey);
  if (!license) {
    return NextResponse.json({ error: "License minting is misconfigured on this deployment." }, { status: 500 });
  }

  return NextResponse.json({ license, tier, packageName: getPackage(tier).name });
}
