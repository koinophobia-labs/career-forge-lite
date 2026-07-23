/**
 * Issuance cap + rate limit for founder invites.
 *
 * Even with the invite enabled and a real per-deployment code, a leaked or
 * shoulder-surfed code must not be able to mint an unbounded number of free
 * paid-tier licenses. This bounds both the lifetime total and the short-window
 * rate, using the same durable store the fulfillment path already relies on so
 * the counter survives cold starts and spans serverless instances.
 *
 * Concurrency note: getDoc/putDoc is read-modify-write, not a server-side atomic
 * increment, so a simultaneous burst could over-issue by a small margin. That is
 * an accepted residual — this cap is defense-in-depth behind two hard gates
 * (explicit opt-in enablement and canSellSafely), not the primary control.
 */

import { getFulfillmentStore, type FulfillmentStore } from "@/lib/server/fulfillment-store";

const LEDGER_DOC_ID = "founder-invite-ledger";
const WINDOW_MS = 60 * 60 * 1000; // one hour

type Ledger = { mints: string[] };

export type QuotaReason = "no_durable_store" | "total_cap_reached" | "rate_limited";
export type QuotaVerdict = { allowed: boolean; reason?: QuotaReason; remaining: number };

function maxTotal(): number {
  const n = Number(process.env.FOUNDER_INVITE_MAX_TOTAL);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25;
}

function maxPerWindow(): number {
  const n = Number(process.env.FOUNDER_INVITE_MAX_PER_HOUR);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

/**
 * Reserve one invite issuance. Records the mint timestamp durably and returns
 * whether the caller is under both the lifetime cap and the per-window rate.
 * Reserve BEFORE minting; a reserved-but-unminted slot fails safe (under-issues,
 * never over-issues).
 */
export async function reserveFounderInvite(
  storeOverride?: FulfillmentStore | null
): Promise<QuotaVerdict> {
  const store = storeOverride !== undefined ? storeOverride : getFulfillmentStore();
  // No durable store => cannot enforce the cap => refuse rather than mint blind.
  if (!store) return { allowed: false, reason: "no_durable_store", remaining: 0 };

  const ledger = (await store.getDoc<Ledger>(LEDGER_DOC_ID).catch(() => null)) ?? { mints: [] };
  const mints = Array.isArray(ledger.mints) ? ledger.mints : [];

  const nowMs = Date.now();
  const windowStart = nowMs - WINDOW_MS;
  const recent = mints.filter((t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) && ms >= windowStart;
  });

  if (mints.length >= maxTotal()) return { allowed: false, reason: "total_cap_reached", remaining: 0 };
  if (recent.length >= maxPerWindow()) return { allowed: false, reason: "rate_limited", remaining: 0 };

  const updated: Ledger = { mints: [...mints, new Date(nowMs).toISOString()] };
  await store.putDoc(LEDGER_DOC_ID, updated);
  return { allowed: true, remaining: Math.max(0, maxTotal() - updated.mints.length) };
}
