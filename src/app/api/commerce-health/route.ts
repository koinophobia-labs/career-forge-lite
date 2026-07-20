import { NextResponse } from "next/server";
import { sellVerdict } from "@/lib/server/fulfillment-readiness";

// Production health check for the paid path.
//
// Reports PRESENCE of configuration and the RESULT of the operational drill.
// It never reads, returns, or logs a secret value — that is what makes it safe
// to expose. The pricing page calls it to decide whether it may show a buy
// button at all.
//
// canSellSafely requires BOTH gates. Environment variables containing text can
// never turn this true on their own.

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const verdict = await sellVerdict();

  return NextResponse.json(
    {
      liveMode: verdict.liveMode,
      canSellSafely: verdict.canSellSafely,
      configurationReady: verdict.configuration.ready,
      operationalReady: verdict.operational.ready,
      missingConfiguration: verdict.configuration.missing,
      operationalChecks: verdict.operational.checks,
      blockers: verdict.blockers,
      blockedBecause: verdict.configuration.requirements
        .filter((r) => !r.present)
        .map((r) => ({ setting: r.name, consequence: r.consequence })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
