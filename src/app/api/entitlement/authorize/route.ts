import { NextResponse } from "next/server";
import { verifyLicenseKey } from "@/lib/license";
import { getPackage, isPackageTier } from "@/lib/packages";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import { getFulfillmentStore } from "@/lib/server/fulfillment-store";
import { getSigningKeyB64, mintAuthorizationReceipt, mintRevocableLicenseKey } from "@/lib/server/license-mint";
import { deriveEntitlementId, getRedemptionCodePepper } from "@/lib/server/redemption-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const AUTHORIZATION_WINDOW_MS = 24 * 60 * 60 * 1000;

const response = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });

export async function POST(request: Request): Promise<NextResponse> {
  let signedEntitlement: unknown;
  try {
    signedEntitlement = ((await request.json()) as Record<string, unknown>).signedEntitlement;
  } catch {
    return response({ authorized: false, error: "Invalid request body." }, 400);
  }
  if (typeof signedEntitlement !== "string" || signedEntitlement.length > 4096) {
    return response({ authorized: false, error: "Invalid entitlement." }, 400);
  }

  const verified = await verifyLicenseKey(signedEntitlement);
  if (!verified.ok) return response({ authorized: false, error: "Invalid entitlement." }, 403);

  const store = getFulfillmentStore();
  if (!store) return response({ authorized: false, error: "Authorization service unavailable." }, 503);

  let record =
    verified.payload.v === 2
      ? await store.getRedemptionByEntitlementId(verified.payload.entitlementId)
      : await store.getRedemptionByReference(verified.payload.ref);

  if (
    !record ||
    record.revoked ||
    !isPackageTier(record.tier) ||
    record.tier !== verified.payload.tier ||
    record.entitlementReference !== verified.payload.ref
  ) {
    logCommerceEvent("entitlement_authorization_denied", {
      entitlementId: verified.payload.v === 2 ? verified.payload.entitlementId : null,
      reason: record?.revoked ? "revoked" : "unmapped",
    });
    return response({ authorized: false, revoked: record?.revoked === true }, 403);
  }

  let currentEntitlement = signedEntitlement;
  if (verified.payload.v === 1) {
    const signingKey = getSigningKeyB64();
    const pepper = getRedemptionCodePepper();
    if (!signingKey || !pepper) return response({ authorized: false, error: "Exchange service unavailable." }, 503);
    const expectedIssuedAt = Math.floor(new Date(record.purchaseTimestamp).getTime() / 1000);
    if (!Number.isFinite(expectedIssuedAt) || verified.payload.iat !== expectedIssuedAt) {
      return response({ authorized: false, error: "Legacy entitlement is not mapped to its issuance." }, 403);
    }
    const entitlementId = record.entitlementId ?? deriveEntitlementId(record.sessionId, pepper);
    if (!record.entitlementId) {
      record = await store.updateRedemptionIdentity(record.sessionId, {
        entitlementId,
        paymentIntentId: record.paymentIntentId,
        amountTotal: record.amountTotal,
        currency: record.currency,
      });
    }
    if (!record?.entitlementId) return response({ authorized: false, error: "Exchange could not be persisted." }, 503);
    currentEntitlement =
      mintRevocableLicenseKey(
        verified.payload.tier,
        record.entitlementReference,
        expectedIssuedAt,
        record.entitlementId,
        signingKey
      ) ?? "";
    if (!currentEntitlement) return response({ authorized: false, error: "Exchange could not be signed." }, 503);
  }

  const checkedAt = Date.now();
  const expiresAt = checkedAt + AUTHORIZATION_WINDOW_MS;
  const authorizationReceipt = mintAuthorizationReceipt(
    verified.payload.tier,
    record.entitlementId!,
    checkedAt,
    expiresAt
  );
  if (!authorizationReceipt) {
    return response({ authorized: false, error: "Authorization could not be signed." }, 503);
  }
  logCommerceEvent("entitlement_authorized", {
    entitlementId: record.entitlementId,
    tier: verified.payload.tier,
    legacyExchanged: verified.payload.v === 1,
  });
  return response({
    authorized: true,
    signedEntitlement: currentEntitlement,
    tier: verified.payload.tier,
    packageName: getPackage(verified.payload.tier).name,
    entitlementId: record.entitlementId,
    checkedAt,
    expiresAt,
    authorizationReceipt,
  });
}
