import { NextResponse } from "next/server";
import { getPackage } from "@/lib/packages";
import {
  FOUNDER_INVITE_TIER,
  founderInviteCodeMatches,
  mintFounderInviteLicense
} from "@/lib/server/founder-invite";
import { getSigningKeyB64 } from "@/lib/server/license-mint";

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

  if (!founderInviteCodeMatches(code)) {
    return json({ error: "That founder code is not valid." }, 403);
  }

  const signingKey = getSigningKeyB64();
  if (!signingKey) {
    return json({ error: "Founder invites are not configured on this deployment." }, 503);
  }

  const license = mintFounderInviteLicense(signingKey);
  if (!license) {
    return json({ error: "Could not issue the founder license." }, 500);
  }

  return json({
    license,
    tier: FOUNDER_INVITE_TIER,
    packageName: getPackage(FOUNDER_INVITE_TIER).name
  });
}
