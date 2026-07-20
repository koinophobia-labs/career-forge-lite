/**
 * Can this deployment actually deliver what it sells?
 *
 * Why this exists
 * ---------------
 * In live mode the checkout route returned a static Stripe Payment Link and the
 * server's involvement ended there. The ONLY fulfillment path ran in the
 * buyer's browser: Stripe redirects to /unlock?session_id=…, the page fetches
 * /api/license, the key is minted. If the buyer closed the tab, lost signal, or
 * came back through a bank's in-app browser that dropped the redirect, the
 * license was never minted — and because no route logged or persisted anything,
 * nothing recorded that a paying customer got nothing.
 *
 * TWO KINDS OF READY
 * ------------------
 * The first version of this file checked whether six environment variables
 * contained text and called that ready. That is necessary and nowhere near
 * sufficient: a present STRIPE_WEBHOOK_SECRET does not mean an endpoint is
 * registered, a present RESEND_API_KEY does not mean the sender domain is
 * verified, and nothing at all proved that Payment Link metadata reaches the
 * Checkout Session — an assumption every fulfillment path depends on.
 *
 *   CONFIGURATION READINESS — the required settings are present.
 *   OPERATIONAL READINESS   — the whole path has been DEMONSTRATED end to end
 *                             in this environment, and the proof is a durable
 *                             record, not a string someone typed.
 *
 * Checkout may open only when both pass. Because the operational proof lives in
 * the durable store and is written by the drill itself, `canSellSafely` cannot
 * be turned on by editing environment variables.
 */

import {
  getFulfillmentStore,
  kvConfigured,
  type FulfillmentStore,
} from "@/lib/server/fulfillment-store";

/** Session id under which the end-to-end drill records its proof. */
export const DRILL_RECORD_ID = "drill:test-mode-e2e";

export type ReadinessRequirement = {
  name: string;
  /** What breaks for a paying customer when this is missing. */
  consequence: string;
  present: boolean;
};

export type ConfigurationReadiness = {
  ready: boolean;
  requirements: ReadinessRequirement[];
  missing: string[];
};

export type OperationalReadiness = {
  ready: boolean;
  /** Each demonstrated step of the real journey. */
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  blockers: string[];
};

const present = (name: string) => Boolean(process.env[name]?.trim());

/* ------------------------------------------------- configuration readiness */

export function configurationReadiness(): ConfigurationReadiness {
  const requirements: ReadinessRequirement[] = [
    {
      name: "STRIPE_SECRET_KEY",
      consequence: "The license endpoint cannot verify the paid session, so no key can be minted.",
      present: present("STRIPE_SECRET_KEY"),
    },
    {
      name: "LICENSE_SIGNING_PRIVATE_KEY",
      consequence: "No license can be signed at all — every purchase fails after payment.",
      present: present("LICENSE_SIGNING_PRIVATE_KEY"),
    },
    {
      name: "STRIPE_LIVE_RESET_PAYMENT_LINK",
      consequence: "There is no checkout to send the customer to.",
      present: present("STRIPE_LIVE_RESET_PAYMENT_LINK"),
    },
    {
      name: "STRIPE_WEBHOOK_SECRET",
      consequence:
        "No server-side fulfillment. If the customer's browser does not return from Stripe, the purchase is lost silently and nothing records it.",
      present: present("STRIPE_WEBHOOK_SECRET"),
    },
    {
      name: "RESEND_API_KEY",
      consequence: "The license key cannot be emailed, so a lost redirect cannot be recovered.",
      present: present("RESEND_API_KEY"),
    },
    {
      name: "LICENSE_EMAIL_FROM",
      consequence: "No verified sender, so fulfillment email will not send.",
      present: present("LICENSE_EMAIL_FROM"),
    },
    {
      name: "KV_REST_API_URL / KV_REST_API_TOKEN",
      consequence:
        "No durable fulfillment state. Duplicate webhooks cannot be deduplicated across instances or retries, and a paid-but-unfulfilled purchase cannot be reconciled.",
      present: kvConfigured(),
    },
  ];

  const missing = requirements.filter((r) => !r.present).map((r) => r.name);
  return { ready: missing.length === 0, requirements, missing };
}

/* --------------------------------------------------- operational readiness */

/**
 * Has the complete journey actually been demonstrated here?
 *
 * The proof is a durable record written by the test-mode drill — signature
 * verified, tier resolved without guessing, license minted server-side, email
 * accepted by the provider, duplicate delivery suppressed. No environment
 * variable can fake it.
 */
export async function operationalReadiness(
  storeOverride?: FulfillmentStore | null
): Promise<OperationalReadiness> {
  const store = storeOverride !== undefined ? storeOverride : getFulfillmentStore();
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  const blockers: string[] = [];

  if (!store) {
    return {
      ready: false,
      checks: [
        {
          name: "durable_store",
          passed: false,
          detail: "No durable fulfillment store is provisioned.",
        },
      ],
      blockers: ["No durable fulfillment store (Vercel KV) is provisioned."],
    };
  }

  const durable = store.kind !== "memory";
  checks.push({
    name: "durable_store",
    passed: durable,
    detail: durable
      ? `Durable store: ${store.kind}.`
      : "In-memory store cannot survive a cold start; it is not durable.",
  });
  if (!durable) blockers.push("Fulfillment store is in-memory, not durable.");

  let healthy = false;
  try {
    healthy = await store.healthy();
  } catch {
    healthy = false;
  }
  checks.push({
    name: "store_reachable",
    passed: healthy,
    detail: healthy ? "Round-trip write/read/delete succeeded." : "Store did not answer a probe.",
  });
  if (!healthy) blockers.push("Durable store failed its round-trip probe.");

  const drill = healthy ? await store.get(DRILL_RECORD_ID).catch(() => null) : null;
  const drillPassed = Boolean(drill && drill.licenseMinted && drill.emailSent && drill.status === "email_sent");
  checks.push({
    name: "end_to_end_drill",
    passed: drillPassed,
    detail: drillPassed
      ? `Test-mode journey demonstrated and recorded (${drill!.updatedAt}).`
      : "No recorded end-to-end fulfillment drill for this environment.",
  });
  if (!drillPassed) {
    blockers.push(
      "The complete test-mode journey (checkout → signed webhook → tier → license → accepted email → duplicate suppressed) has not been demonstrated and recorded here."
    );
  }

  const unfulfilled = healthy ? await store.listUnfulfilled().catch(() => []) : [];
  const outstanding = unfulfilled.filter((r) => r.sessionId !== DRILL_RECORD_ID);
  checks.push({
    name: "no_outstanding_unfulfilled",
    passed: outstanding.length === 0,
    detail:
      outstanding.length === 0
        ? "No paid-but-unfulfilled sessions recorded."
        : `${outstanding.length} session(s) recorded as paid but not fulfilled.`,
  });
  if (outstanding.length > 0) {
    blockers.push(`${outstanding.length} paid-but-unfulfilled session(s) must be resolved first.`);
  }

  return { ready: blockers.length === 0, checks, blockers };
}

/* ------------------------------------------------------------- the verdict */

export const isLiveCommerce = () => process.env.NEXT_PUBLIC_COMMERCE_MODE === "live";

export type SellVerdict = {
  liveMode: boolean;
  canSellSafely: boolean;
  configuration: ConfigurationReadiness;
  operational: OperationalReadiness;
  blockers: string[];
};

export async function sellVerdict(storeOverride?: FulfillmentStore | null): Promise<SellVerdict> {
  const configuration = configurationReadiness();
  const operational = await operationalReadiness(storeOverride);
  const liveMode = isLiveCommerce();

  const blockers = [
    ...configuration.missing.map((name) => `Configuration missing: ${name}`),
    ...operational.blockers,
  ];

  return {
    liveMode,
    // Both gates, every time. Presence alone is never enough.
    canSellSafely: liveMode && configuration.ready && operational.ready,
    configuration,
    operational,
    blockers,
  };
}

/** True when configured to sell but not proven able to deliver. */
export async function liveCommerceUnsafe(storeOverride?: FulfillmentStore | null): Promise<boolean> {
  if (!isLiveCommerce()) return false;
  const verdict = await sellVerdict(storeOverride);
  return !verdict.canSellSafely;
}

/**
 * Kept for the legacy shape used by earlier callers/tests. Configuration only —
 * never use this to decide whether checkout may open.
 */
export const fulfillmentReadiness = configurationReadiness;
