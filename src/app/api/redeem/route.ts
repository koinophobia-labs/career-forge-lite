import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeRedemptionCode } from "@/lib/redemption-code";
import { getPackage, isPackageTier } from "@/lib/packages";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import { getFulfillmentStore } from "@/lib/server/fulfillment-store";
import { getSigningKeyB64, mintLicenseKey } from "@/lib/server/license-mint";
import {
  getRedemptionCodePepper,
  hashRedemptionCode,
} from "@/lib/server/redemption-code";
import {
  clearRedemptionFailures,
  rateLimitBlocked,
  recordRedemptionFailure,
  type RedemptionRateState,
} from "@/lib/server/redemption-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const genericError = () =>
  NextResponse.json(
    { error: "That access code could not be activated. Check the code and try again." },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );

function clientFingerprint(request: Request, pepper: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHmac("sha256", pepper).update(`redemption-client:${address}`).digest("hex");
}

export async function POST(request: Request): Promise<NextResponse> {
  const store = getFulfillmentStore();
  const pepper = getRedemptionCodePepper();
  const signingKey = getSigningKeyB64();
  if (!store || !pepper || !signingKey) {
    return NextResponse.json(
      { error: "Access-code activation is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const fingerprint = clientFingerprint(request, pepper);
  const rateDocumentId = `redemption-rate:${fingerprint}`;
  const now = Date.now();
  const rateState = await store.getDoc<RedemptionRateState>(rateDocumentId).catch(() => null);
  if (rateLimitBlocked(rateState, now)) {
    logCommerceEvent("redemption_rate_limited", { clientFingerprint: fingerprint.slice(0, 12) });
    return NextResponse.json(
      { error: "Too many activation attempts. Wait a moment and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
    );
  }

  let submitted: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    submitted = body.code;
  } catch {
    submitted = null;
  }

  const fail = async (reason: string) => {
    const next = recordRedemptionFailure(rateState, Date.now());
    await store.putDoc(rateDocumentId, next).catch(() => undefined);
    logCommerceEvent("redemption_failed", {
      clientFingerprint: fingerprint.slice(0, 12),
      reason,
    });
    return genericError();
  };

  const normalized = normalizeRedemptionCode(submitted);
  if (!normalized) return fail("malformed");

  const codeHash = hashRedemptionCode(normalized, pepper);
  const redemption = await store.getRedemptionByHash(codeHash).catch(() => null);
  if (!redemption || redemption.revoked || !isPackageTier(redemption.tier)) {
    return fail(redemption?.revoked ? "revoked" : "not_found");
  }

  const issuedAt = Math.floor(new Date(redemption.purchaseTimestamp).getTime() / 1000);
  if (!Number.isFinite(issuedAt)) return fail("bad_entitlement_timestamp");

  const signedEntitlement = mintLicenseKey(
    redemption.tier,
    redemption.entitlementReference,
    issuedAt,
    signingKey
  );
  if (!signedEntitlement) {
    logCommerceEvent("license_mint_failed", { sessionId: redemption.sessionId, via: "redemption" });
    return NextResponse.json(
      { error: "Access-code activation is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const updated = await store.markRedemptionRedeemed(codeHash);
  if (!updated) return fail("redemption_update_failed");
  await store.putDoc(rateDocumentId, clearRedemptionFailures(Date.now())).catch(() => undefined);
  logCommerceEvent("redemption_succeeded", {
    sessionId: redemption.sessionId,
    tier: redemption.tier,
  });
  return NextResponse.json(
    {
      signedEntitlement,
      tier: redemption.tier,
      packageName: getPackage(redemption.tier).name,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
