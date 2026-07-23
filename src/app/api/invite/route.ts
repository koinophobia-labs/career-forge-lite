import { NextResponse } from "next/server";
import { getPackage } from "@/lib/packages";
import {
  FOUNDER_INVITE_TIER,
  founderInviteCodeMatches,
  mintFounderInviteLicense
} from "@/lib/server/founder-invite";
import { getSigningKeyB64 } from "@/lib/server/license-mint";
import { sellVerdict } from "@/lib/server/fulfillment-readiness";
import { reserveFounderInvite } from "@/lib/server/founder-invite-quota";
import { logCommerceEvent } from "@/lib/server/commerce-log";

export const runtime = "nodejs";

function json(payload: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

// Redeems a founder invite into a fresh signed license. The shared invite code
// never becomes the license itself, so every recipient gets a distinct key.
export async function POST(request: Request): Promise<NextResponse> {
  let code: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    code = body.code;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  // Fails closed by default: with no FOUNDER_INVITE_ENABLED=true and no
  // configured per-deployment code hash, getFounderInviteHash() is null and
  // every code — including the old guessable brand word — is rejected here.
  if (!founderInviteCodeMatches(code)) {
    return json({ error: "That founder code is not valid." }, 403);
  }

  // A founder invite grants a REAL paid entitlement, so it is bound to the same
  // human sell-approval + fulfillment gate as a purchase. Technical readiness
  // alone never hands out entitlements; Blake's recorded approval does.
  const verdict = await sellVerdict();
  if (!verdict.canSellSafely) {
    logCommerceEvent("founder_invite_blocked", { reason: "not_sell_safe", blockers: verdict.blockers });
    return json(
      { error: "Founder invites are closed on this deployment.", code: "not_sell_safe" },
      503
    );
  }

  const signingKey = getSigningKeyB64();
  if (!signingKey) {
    return json({ error: "Founder invites are not configured on this deployment." }, 503);
  }

  // Durable issuance cap + short-window rate limit. A leaked or guessed code
  // cannot mint an unbounded number of free licenses.
  const quota = await reserveFounderInvite();
  if (!quota.allowed) {
    logCommerceEvent("founder_invite_blocked", { reason: quota.reason });
    return json(
      { error: "Founder invites are temporarily unavailable. Please reach out to support.", code: quota.reason },
      429
    );
  }

  const signedEntitlement = mintFounderInviteLicense(signingKey);
  if (!signedEntitlement) {
    return json({ error: "Could not issue the founder license." }, 500);
  }

  logCommerceEvent("founder_invite_minted", { tier: FOUNDER_INVITE_TIER, remaining: quota.remaining });
  return json({
    signedEntitlement,
    tier: FOUNDER_INVITE_TIER,
    packageName: getPackage(FOUNDER_INVITE_TIER).name
  });
}
