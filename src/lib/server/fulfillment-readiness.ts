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
 * Checkout may open only when both pass.
 *
 * THE SELF-CERTIFICATION FLAW, AND ITS FIX
 * ----------------------------------------
 * An earlier version let the WEBHOOK write the proof whenever a session id
 * started with `cs_test_drill_`. The drill chose its own session ids, signed its
 * own payloads with the endpoint secret, and declared its own `paid` status — so
 * the system could certify a purchase journey that never happened, and a leaked
 * webhook secret was enough to reopen sales.
 *
 * Now the webhook cannot write certification at all. Proof is written only by
 * the certification tool, only after Stripe confirms a real test-mode session at
 * a recognised price, and it is scoped to one commit, one host, one environment.
 * On top of that, `canSellSafely` also requires an explicit approval record for
 * the running commit. Technical readiness does not open a shop; Blake does.
 */

import { type KeyObject } from "node:crypto";
import {
  durableStoreConfigured,
  getFulfillmentStore,
  type FulfillmentStore,
} from "@/lib/server/fulfillment-store";
import {
  APPROVAL_RECORD_ID,
  CERTIFICATION_RECORD_ID,
  deploymentIdentity,
  evaluateApproval,
  evaluateEvidence,
  type CertificationEvidence,
} from "@/lib/server/certification";
import { CERTIFIED_SURFACE_HASH } from "@/lib/server/certified-surface-hash";
import { loadApprovalPublicKey, type SignedApproval } from "@/lib/server/approval-crypto";
import { APPROVAL_PUBLIC_KEY_SPKI_BASE64 } from "@/lib/server/approval-public-key";

/**
 * Environments whose certification may authorize this deployment.
 *
 * A preview proof is accepted only for that same preview host — evaluateEvidence
 * pins the host too. Production requires its own certification; a green preview
 * never opens the real shop.
 */
const ALLOWED_CERTIFYING_ENVIRONMENTS = ["preview", "production", "development"];

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
      name: "REDEMPTION_CODE_PEPPER",
      consequence:
        "Customer access codes cannot be securely hashed or recovered for a safe fulfillment retry.",
      present: present("REDEMPTION_CODE_PEPPER"),
    },
    {
      name: "STRIPE_PRICE_RESET",
      consequence:
        "Checkout falls back to an inline price with no stable id, so fulfillment cannot derive which package was bought from the paid session.",
      present: present("STRIPE_PRICE_RESET"),
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
      name: "LICENSE_EMAIL_REPLY_TO",
      consequence: "A buyer who needs help cannot reply to a monitored support address.",
      present: present("LICENSE_EMAIL_REPLY_TO"),
    },
    {
      name: "DATABASE_URL (or KV_REST_API_URL / KV_REST_API_TOKEN)",
      consequence:
        "No durable fulfillment state. Duplicate webhooks cannot be deduplicated across instances or retries, and a paid-but-unfulfilled purchase cannot be reconciled.",
      present: durableStoreConfigured(),
    },
  ];

  const missing = requirements.filter((r) => !r.present).map((r) => r.name);
  return { ready: missing.length === 0, requirements, missing };
}

/* --------------------------------------------------- operational readiness */

/**
 * Has the complete journey actually been demonstrated here?
 *
 * Requires a durable store, a healthy probe, Stripe-verified certification for
 * THIS commit on THIS host, no outstanding unfulfilled sessions, and explicit
 * human authorization. Nothing a caller controls can satisfy these.
 */
export async function operationalReadiness(
  storeOverride?: FulfillmentStore | null,
  approvalKeyOverride?: KeyObject | null
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
      blockers: ["No durable fulfillment store is provisioned (DATABASE_URL or Vercel KV)."],
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

  // Certification evidence — written ONLY by the real certification tool after
  // Stripe has confirmed a genuine test-mode purchase. The webhook cannot write
  // it, so a fabricated event can never certify a deployment.
  const identity = deploymentIdentity();
  const evidence = healthy
    ? await store.getDoc<CertificationEvidence>(CERTIFICATION_RECORD_ID).catch(() => null)
    : null;
  const evidenceVerdict = evaluateEvidence(
    evidence,
    { ...identity, surfaceHash: CERTIFIED_SURFACE_HASH },
    { allowedEnvironments: ALLOWED_CERTIFYING_ENVIRONMENTS, requireTestMode: true }
  );
  checks.push({
    name: "stripe_verified_certification",
    passed: evidenceVerdict.valid,
    detail: evidenceVerdict.valid
      ? `Certified against Stripe test-mode session ${evidence!.checkoutSessionId} at ${evidence!.completedAt}.`
      : evidenceVerdict.reasons.join(" "),
  });
  blockers.push(...evidenceVerdict.reasons);

  // Human authorization — a statement signed by the release owner's offline
  // key. The public key that checks it grants no power to create one, so a
  // database client cannot mint authorization by writing a row.
  const approval = healthy
    ? await store.getDoc<SignedApproval>(APPROVAL_RECORD_ID).catch(() => null)
    : null;
  // Tests inject a throwaway key; production always resolves the committed
  // trust root. The override is a function argument, unreachable at runtime.
  const approvalPublicKey =
    approvalKeyOverride !== undefined
      ? approvalKeyOverride
      : loadApprovalPublicKey(APPROVAL_PUBLIC_KEY_SPKI_BASE64);
  const approvalVerdict = evaluateApproval(
    approval,
    evidence,
    { ...identity, surfaceHash: CERTIFIED_SURFACE_HASH },
    approvalPublicKey
  );
  checks.push({
    name: "human_authorization",
    passed: approvalVerdict.valid,
    detail: approvalVerdict.valid
      ? `Signed authorization verified for ${approval!.payload.approvalActor} at ${approval!.payload.approvedAt}.`
      : approvalVerdict.reasons.join(" "),
  });
  blockers.push(...approvalVerdict.reasons);

  const unfulfilled = healthy ? await store.listUnfulfilled().catch(() => []) : [];
  const outstanding = unfulfilled;
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

export async function sellVerdict(
  storeOverride?: FulfillmentStore | null,
  approvalKeyOverride?: KeyObject | null
): Promise<SellVerdict> {
  const configuration = configurationReadiness();
  const operational = await operationalReadiness(storeOverride, approvalKeyOverride);
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
export async function liveCommerceUnsafe(
  storeOverride?: FulfillmentStore | null,
  approvalKeyOverride?: KeyObject | null
): Promise<boolean> {
  if (!isLiveCommerce()) return false;
  const verdict = await sellVerdict(storeOverride, approvalKeyOverride);
  return !verdict.canSellSafely;
}

/**
 * Kept for the legacy shape used by earlier callers/tests. Configuration only —
 * never use this to decide whether checkout may open.
 */
export const fulfillmentReadiness = configurationReadiness;
