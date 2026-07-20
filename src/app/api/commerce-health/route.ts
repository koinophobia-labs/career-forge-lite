import { NextResponse } from "next/server";
import { fulfillmentReadiness, isLiveCommerce } from "@/lib/server/fulfillment-readiness";

// Production health check for the paid path.
//
// Reports only PRESENCE of configuration and the consequence of each gap. It
// never reads, returns, or logs a secret value — that is the whole reason this
// is safe to expose. The pricing page calls it to decide whether it may show a
// buy button at all.

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const liveMode = isLiveCommerce();
  const readiness = fulfillmentReadiness();

  return NextResponse.json(
    {
      liveMode,
      // Can this deployment take money AND deliver? Only true when both.
      canSellSafely: liveMode && readiness.ready,
      fulfillmentReady: readiness.ready,
      missing: readiness.missing,
      blockedBecause: readiness.requirements
        .filter((r) => !r.present)
        .map((r) => ({ setting: r.name, consequence: r.consequence })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
