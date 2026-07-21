/**
 * Operational certification: what counts as proof, and who gets to say so.
 *
 * The flaw this replaces
 * ---------------------
 * The previous design let the webhook itself write the readiness record when a
 * session id happened to start with `cs_test_drill_`. Since the drill chose its
 * own session ids, signed its own payloads, and declared its own `paid` status,
 * the system could certify a purchase journey that never occurred. A leaked
 * webhook secret would have been enough to reopen sales.
 *
 * Two ideas fix it:
 *
 *   1. EVIDENCE IS EARNED, NOT ASSERTED. Certification requires a session that
 *      Stripe confirms exists and was paid, at a price we recognise. The webhook
 *      never writes certification — only the certification tool does, and only
 *      after Stripe has been consulted.
 *
 *   2. EVIDENCE IS SCOPED. A proof belongs to one commit, one environment, one
 *      Stripe account. Change the checkout code and the proof dies with it,
 *      because the thing it vouched for no longer exists.
 *
 * And a third, which is not technical: even perfect evidence does not open a
 * shop. Only Blake does, per commit, in writing.
 */

import { createHash } from "node:crypto";

/** Bump when the certification procedure changes shape. */
export const DRILL_VERSION = "4.0.0";

export const CERTIFICATION_RECORD_ID = "certification:operational";
export const APPROVAL_RECORD_ID = "approval:live-commerce";

/**
 * Source files whose behaviour the proof depends on. A change to any of them
 * invalidates prior certification — the journey that was proven is not the
 * journey the code would now run.
 */
export const CERTIFIED_SURFACE = [
  "src/app/api/checkout/route.ts",
  "src/app/api/internal/commerce-certification/route.ts",
  "src/app/api/stripe-webhook/route.ts",
  "src/app/api/license/route.ts",
  "src/app/api/redeem/route.ts",
  "src/app/pricing/page.tsx",
  "src/app/unlock/page.tsx",
  "src/components/PremiumAccess.tsx",
  "src/lib/redemption-code.ts",
  "src/lib/server/stripe.ts",
  "src/lib/server/session-verification.ts",
  "src/lib/server/license-mint.ts",
  "src/lib/server/redemption-code.ts",
  "src/lib/server/redemption-rate-limit.ts",
  "src/lib/server/fulfillment-store.ts",
  "src/lib/server/fulfillment-readiness.ts",
  "src/lib/packages.ts",
] as const;

export type CertificationEvidence = {
  drillVersion: string;
  /** Commit the proof was produced against. */
  commitSha: string;
  /** Fingerprint of the certified surface — catches edits within a commit. */
  surfaceHash: string;
  environment: string;
  host: string;
  stripeMode: "test" | "live";
  stripeAccountId: string | null;
  checkoutSessionId: string;
  stripeEventId: string;
  priceId: string;
  tier: string;
  /** Provider-side id proving the email was accepted. Never the address. */
  emailProviderMessageId: string;
  /** Durable store observed by the deployment recorder. */
  fulfillmentStoreKind: string;
  /** At least two claims proves a duplicate delivery crossed durable dedupe. */
  fulfillmentAttempts: number;
  /** The deployment verified the issued license grants this tier. */
  licenseTierVerified: string;
  /** The emailed short code redeemed into the same purchased tier. */
  redemptionTierVerified: string;
  successRouteStatus: number;
  cancellationRouteStatus: number;
  completedAt: string;
};

export type ApprovalRecord = {
  approvedCommitSha: string;
  approvedEnvironment: string;
  approvalActor: string;
  /** Ties the approval to the exact evidence that was reviewed. */
  evidenceId: string;
  approvedAt: string;
};

/** Current deployment identity, read from the platform rather than asserted. */
export function deploymentIdentity(): {
  commitSha: string;
  environment: string;
  host: string;
} {
  const environment = process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "unknown";
  const stableProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  let configuredAppHost: string | null = null;
  try {
    configuredAppHost = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : null;
  } catch {
    configuredAppHost = null;
  }
  return {
    commitSha:
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.GIT_COMMIT_SHA?.trim() ||
      "unknown",
    environment,
    host:
      (environment === "production" ? stableProductionHost || configuredAppHost : null) ||
      process.env.VERCEL_URL?.trim() ||
      process.env.APP_HOST?.trim() ||
      "unknown",
  };
}

/** Stable id for a piece of evidence, used to bind an approval to it. */
export function evidenceId(evidence: CertificationEvidence): string {
  return createHash("sha256")
    .update(
      [
        evidence.commitSha,
        evidence.surfaceHash,
        evidence.environment,
        evidence.checkoutSessionId,
        evidence.stripeEventId,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);
}

export type CertificationVerdict = {
  valid: boolean;
  reasons: string[];
};

/**
 * Is this evidence usable by the deployment asking?
 *
 * Deliberately strict. Every rejection here is a case where something real was
 * proven — just not about this code, on this deployment, in this account.
 */
export function evaluateEvidence(
  evidence: CertificationEvidence | null,
  current: { commitSha: string; environment: string; host: string; surfaceHash: string },
  policy: { allowedEnvironments: string[]; requireTestMode: boolean }
): CertificationVerdict {
  const reasons: string[] = [];

  if (!evidence) {
    return { valid: false, reasons: ["No operational certification evidence recorded."] };
  }

  if (evidence.drillVersion !== DRILL_VERSION) {
    reasons.push(
      `Evidence was produced by drill ${evidence.drillVersion}; this deployment requires ${DRILL_VERSION}.`
    );
  }

  if (evidence.commitSha !== current.commitSha || current.commitSha === "unknown") {
    reasons.push(
      `Evidence certifies commit ${evidence.commitSha.slice(0, 12)}; this deployment runs ${current.commitSha.slice(0, 12)}.`
    );
  }

  if (evidence.surfaceHash !== current.surfaceHash) {
    reasons.push("Checkout, webhook, license, storage or package code changed since certification.");
  }

  if (!policy.allowedEnvironments.includes(evidence.environment)) {
    reasons.push(
      `Evidence came from environment "${evidence.environment}", which is not approved to certify this one.`
    );
  }

  if (evidence.host !== current.host) {
    reasons.push(
      `Evidence came from host "${evidence.host}", not "${current.host}". A proof from one deployment does not authorize another.`
    );
  }

  if (policy.requireTestMode && evidence.stripeMode !== "test") {
    reasons.push("Certification must be produced in Stripe test mode, never against live charges.");
  }

  if (!evidence.checkoutSessionId.startsWith("cs_")) {
    reasons.push("Evidence does not reference a real Stripe Checkout Session.");
  }

  if (!evidence.stripeEventId.startsWith("evt_")) {
    reasons.push("Evidence does not reference a Stripe-originated event.");
  }

  if (!evidence.priceId) {
    reasons.push("Evidence does not name the price that was actually paid.");
  }

  if (!evidence.emailProviderMessageId) {
    reasons.push("Evidence does not prove the email provider accepted the fulfillment message.");
  }

  if (!evidence.fulfillmentStoreKind || evidence.fulfillmentStoreKind === "memory") {
    reasons.push("Evidence does not name a durable fulfillment store.");
  }

  if (!Number.isInteger(evidence.fulfillmentAttempts) || evidence.fulfillmentAttempts < 2) {
    reasons.push("Evidence does not prove a duplicate webhook was durably suppressed.");
  }

  if (evidence.licenseTierVerified !== evidence.tier) {
    reasons.push("Evidence does not prove the issued license activates the purchased package.");
  }

  if (evidence.redemptionTierVerified !== evidence.tier) {
    reasons.push("Evidence does not prove the emailed access code activates the purchased package.");
  }

  if (evidence.successRouteStatus !== 200 || evidence.cancellationRouteStatus !== 200) {
    reasons.push("Evidence does not prove both Checkout return routes are reachable.");
  }

  return { valid: reasons.length === 0, reasons };
}

/** Does this approval authorize the running code? */
export function evaluateApproval(
  approval: ApprovalRecord | null,
  evidence: CertificationEvidence | null,
  current: { commitSha: string; environment: string }
): CertificationVerdict {
  const reasons: string[] = [];

  if (!approval) {
    return {
      valid: false,
      reasons: [
        "Live checkout has not been authorized. Technical readiness does not open a shop — Blake does, per commit.",
      ],
    };
  }

  if (approval.approvedCommitSha !== current.commitSha || current.commitSha === "unknown") {
    reasons.push(
      `Approval covers commit ${approval.approvedCommitSha.slice(0, 12)}; this deployment runs ${current.commitSha.slice(0, 12)}.`
    );
  }

  if (approval.approvedEnvironment !== current.environment) {
    reasons.push(
      `Approval covers environment "${approval.approvedEnvironment}", not "${current.environment}".`
    );
  }

  if (!approval.approvalActor?.trim()) {
    reasons.push("Approval names no actor.");
  }

  if (!evidence) {
    reasons.push("Approval references evidence that is no longer present.");
  } else if (approval.evidenceId !== evidenceId(evidence)) {
    reasons.push("Approval was granted against different evidence than is currently recorded.");
  }

  return { valid: reasons.length === 0, reasons };
}
