import { NextResponse } from "next/server";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import { getPackage } from "@/lib/packages";
import { getSigningKeyB64, mintLicenseKey } from "@/lib/server/license-mint";
import {
  getCertificationStripeConfig,
  getStripeSecretKey,
  retrieveCheckoutSession,
  stripeKeyMode,
} from "@/lib/server/stripe";
import { verifyPaidSession } from "@/lib/server/session-verification";

// Exchanges a completed checkout session for a signed entitlement. The session id is
// an unguessable secret that only the buyer's browser receives from Stripe, so
// possessing it proves the purchase — no account or database needed. Calling
// this again with the same session always yields the same entitlement. ECDSA
// signature bytes may differ, but every valid result activates the same tier.

export async function GET(request: Request): Promise<NextResponse> {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const primaryKey = getStripeSecretKey();
  const certification = getCertificationStripeConfig();
  const useCertificationKey =
    sessionId.startsWith("cs_test_") &&
    Boolean(certification) &&
    (!primaryKey || stripeKeyMode(primaryKey) !== "test");
  const secretKey = useCertificationKey ? certification!.secretKey : primaryKey;
  const signingKey = getSigningKeyB64();
  if (!secretKey || !signingKey) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 }
    );
  }

  const verification = await verifyPaidSession(sessionId, async (id) => {
    const result = await retrieveCheckoutSession(id, secretKey);
    return result.ok
      ? { ok: true as const, session: result.session, accountId: null }
      : { ok: false as const, status: result.status };
  }, useCertificationKey
    ? new Map([[certification!.priceReset, "reset" as const]])
    : undefined);
  if (!verification.ok) {
    if (verification.reason === "not_paid") {
      // Delayed payment methods land here until they settle.
      return NextResponse.json(
        { error: "This purchase has not finished processing yet. Try again in a few minutes.", pending: true },
        { status: 409 }
      );
    }
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId,
      reason: verification.reason,
    });
    return NextResponse.json(
      { error: "This checkout session is not a verified Career Forge purchase." },
      { status: verification.reason === "lookup_failed" ? 502 : 400 }
    );
  }

  const tier = verification.session.tier;

  const signedEntitlement = mintLicenseKey(
    tier,
    verification.session.sessionId.slice(-10),
    verification.session.created,
    signingKey
  );
  if (!signedEntitlement) {
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: verification.session.sessionId,
      reason: "license_mint_returned_null",
      tier,
    });
    return NextResponse.json({ error: "License minting is misconfigured on this deployment." }, { status: 500 });
  }

  // The entitlement is deterministic per session; signature bytes need not be.
  logCommerceEvent("license_minted", {
    sessionId: verification.session.sessionId,
    tier,
    via: "unlock_page",
  });
  return NextResponse.json({ signedEntitlement, tier, packageName: getPackage(tier).name });
}
