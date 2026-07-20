import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyLicenseKey } from "@/lib/license";
import {
  CERTIFICATION_RECORD_ID,
  DRILL_VERSION,
  deploymentIdentity,
  evidenceId,
  type CertificationEvidence,
} from "@/lib/server/certification";
import { CERTIFIED_SURFACE_HASH } from "@/lib/server/certified-surface-hash";
import { getFulfillmentStore } from "@/lib/server/fulfillment-store";
import { verifyPaidSession } from "@/lib/server/session-verification";
import {
  createCheckoutSession,
  getCertificationStripeConfig,
  retrieveCheckoutSession,
} from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OperatorRequest = {
  action?: unknown;
  email?: unknown;
  sessionId?: unknown;
  eventId?: unknown;
};

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function certificationProof(token: string, commitSha: string, host: string): string {
  return createHmac("sha256", token).update(`${commitSha}|${host}`).digest("hex");
}

function operatorAuthorized(request: Request, token: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && sameSecret(header.slice(7), token);
}

async function stripeGet(path: string, secretKey: string): Promise<unknown | null> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  return response.ok ? response.json() : null;
}

/**
 * Exact-host fetch that carries Vercel's temporary automation-bypass query
 * only for the duration of certification. The bypass value is never stored.
 */
async function fetchDeployment(
  request: Request,
  path: string
): Promise<Response> {
  const target = new URL(path, request.url);
  const bypass = new URL(request.url).searchParams.get("x-vercel-protection-bypass");
  if (bypass) target.searchParams.set("x-vercel-protection-bypass", bypass);
  return fetch(target, { cache: "no-store", redirect: "manual" });
}

export async function POST(request: Request): Promise<NextResponse> {
  const config = getCertificationStripeConfig();
  // With temporary variables removed, this route is indistinguishable from a
  // route that does not exist. It has no fallback credentials or read mode.
  if (!config) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!operatorAuthorized(request, config.operatorToken)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const identity = deploymentIdentity();
  const requestHost = new URL(request.url).host;
  if (
    identity.environment !== "production" ||
    identity.commitSha === "unknown" ||
    identity.host === "unknown" ||
    requestHost !== identity.host
  ) {
    return NextResponse.json({ error: "Certification host or commit is not authoritative." }, { status: 409 });
  }

  let body: OperatorRequest;
  try {
    body = (await request.json()) as OperatorRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const proof = certificationProof(config.operatorToken, identity.commitSha, identity.host);

  if (body.action === "create") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A controlled test email is required." }, { status: 400 });
    }
    const origin = `https://${identity.host}`;
    const created = await createCheckoutSession(
      "reset",
      origin,
      config.secretKey,
      config.priceReset,
      {
        certification_commit: identity.commitSha,
        certification_host: identity.host,
        certification_proof: proof,
      },
      email
    );
    if (!created.ok || !created.session.url) {
      return NextResponse.json({ error: "Stripe refused the test Checkout Session." }, { status: 502 });
    }
    return NextResponse.json({ sessionId: created.session.id, url: created.session.url });
  }

  if (body.action !== "record") {
    return NextResponse.json({ error: "Unknown certification action." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!/^cs_test_[a-zA-Z0-9_]+$/.test(sessionId) || !/^evt_[a-zA-Z0-9_]+$/.test(eventId)) {
    return NextResponse.json({ error: "A Stripe test session and event are required." }, { status: 400 });
  }

  // The caller supplies identifiers only. Stripe supplies every fact used to
  // decide whether evidence is earned.
  const [eventRaw, accountRaw] = await Promise.all([
    stripeGet(`/events/${encodeURIComponent(eventId)}`, config.secretKey),
    stripeGet("/account", config.secretKey),
  ]);
  const event = eventRaw as {
    id?: string;
    type?: string;
    livemode?: boolean;
    data?: { object?: { id?: string } };
  } | null;
  const account = accountRaw as { id?: string } | null;
  if (
    event?.id !== eventId ||
    event.type !== "checkout.session.completed" ||
    event.livemode !== false ||
    event.data?.object?.id !== sessionId ||
    !account?.id
  ) {
    return NextResponse.json({ error: "Stripe does not confirm that event and session." }, { status: 409 });
  }

  const verification = await verifyPaidSession(
    sessionId,
    async (id) => {
      const result = await retrieveCheckoutSession(id, config.secretKey);
      return result.ok
        ? { ok: true as const, session: result.session, accountId: account.id }
        : { ok: false as const, status: result.status };
    },
    new Map([[config.priceReset, "reset" as const]])
  );
  if (!verification.ok || verification.session.livemode) {
    return NextResponse.json({ error: "Stripe does not confirm a paid $49 test purchase." }, { status: 409 });
  }

  const session = await stripeGet(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`,
    config.secretKey
  ) as { created?: number; metadata?: Record<string, string> } | null;
  if (
    !session ||
    session.metadata?.certification_commit !== identity.commitSha ||
    session.metadata?.certification_host !== identity.host ||
    !sameSecret(session.metadata?.certification_proof ?? "", proof) ||
    typeof session.created !== "number" ||
    session.created < Math.floor(Date.now() / 1000) - 86_400
  ) {
    return NextResponse.json({ error: "The test purchase is stale or belongs to another deployment." }, { status: 409 });
  }

  const store = getFulfillmentStore();
  if (!store || store.kind === "memory" || !(await store.healthy())) {
    return NextResponse.json({ error: "A healthy durable fulfillment store is required." }, { status: 503 });
  }
  const record = await store.get(sessionId);
  if (
    !record?.licenseMinted ||
    !record.emailSent ||
    !record.emailProviderMessageId ||
    record.lastEventId !== eventId ||
    record.attempts < 2
  ) {
    return NextResponse.json(
      { error: "Durable fulfillment, provider acceptance, and duplicate suppression are not all proven." },
      { status: 409 }
    );
  }

  const [licenseResponse, successResponse, cancellationResponse] = await Promise.all([
    fetchDeployment(request, `/api/license?session_id=${encodeURIComponent(sessionId)}`),
    fetchDeployment(request, `/unlock?session_id=${encodeURIComponent(sessionId)}`),
    fetchDeployment(request, "/pricing?checkout=cancelled"),
  ]);
  const licenseBody = (await licenseResponse.json().catch(() => null)) as { license?: string } | null;
  const verifiedLicense = licenseBody?.license
    ? await verifyLicenseKey(licenseBody.license)
    : { ok: false as const };
  if (
    !licenseResponse.ok ||
    !verifiedLicense.ok ||
    verifiedLicense.payload.tier !== verification.session.tier ||
    successResponse.status !== 200 ||
    cancellationResponse.status !== 200
  ) {
    return NextResponse.json({ error: "License activation or Checkout return routes failed verification." }, { status: 409 });
  }

  const evidence: CertificationEvidence = {
    drillVersion: DRILL_VERSION,
    commitSha: identity.commitSha,
    surfaceHash: CERTIFIED_SURFACE_HASH,
    environment: identity.environment,
    host: identity.host,
    stripeMode: "test",
    stripeAccountId: account.id,
    checkoutSessionId: verification.session.sessionId,
    stripeEventId: eventId,
    priceId: verification.session.priceId!,
    tier: verification.session.tier,
    emailProviderMessageId: record.emailProviderMessageId,
    fulfillmentStoreKind: store.kind,
    fulfillmentAttempts: record.attempts,
    licenseTierVerified: verifiedLicense.payload.tier,
    successRouteStatus: successResponse.status,
    cancellationRouteStatus: cancellationResponse.status,
    completedAt: new Date().toISOString(),
  };
  await store.putDoc(CERTIFICATION_RECORD_ID, evidence);

  // This route never reads or writes the human approval document.
  // Certification is evidence only; checkout stays closed at that gate.
  return NextResponse.json({ evidenceId: evidenceId(evidence), evidence });
}
