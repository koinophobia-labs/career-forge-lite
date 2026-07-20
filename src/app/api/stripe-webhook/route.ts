import { NextResponse } from "next/server";
import { getPackage, isPackageTier } from "@/lib/packages";
import { getSigningKeyB64, mintLicenseKey } from "@/lib/server/license-mint";
import { verifyStripeWebhookSignature, type CheckoutSession } from "@/lib/server/stripe";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import { getFulfillmentStore } from "@/lib/server/fulfillment-store";
import { DRILL_RECORD_ID } from "@/lib/server/fulfillment-readiness";

// Optional fulfillment backup: emails the license key on completed checkout so
// buyers who close the success tab still receive their key. Primary
// fulfillment is the /unlock page exchanging the session id — this webhook is
// belt-and-suspenders, and safe to leave unconfigured.
//
// Duplicate webhook deliveries re-send the same email; that is harmless and
// deliberate (no database exists to dedupe against, and a duplicate receipt
// email beats a missing key).

type StripeEvent = {
  id?: string;
  type: string;
  data?: { object?: CheckoutSession };
};

export async function POST(request: Request): Promise<NextResponse> {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret || !endpointSecret.trim()) {
    return NextResponse.json({ error: "Webhook is not configured on this deployment." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeWebhookSignature(rawBody, signature, endpointSecret.trim())) {
    logCommerceEvent("webhook_rejected", { reason: "invalid_signature" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  const tier = session?.metadata?.tier;
  const email = session?.customer_details?.email;
  if (!session || session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  logCommerceEvent("webhook_received", { eventId: event.id, sessionId: session.id, tier });

  if (!isPackageTier(tier)) {
    // Paid, but we cannot tell what was bought. Money took, nothing owed
    // delivered — the loudest case in the log.
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "missing_or_unknown_tier_metadata",
      sawTier: typeof tier === "string" ? tier : null,
    });
    return NextResponse.json({ received: true });
  }

  // Durable claim. Two concurrent deliveries cannot both win: the store's
  // claim is atomic. A retry hours later — long after any in-memory cache is
  // gone — still finds the record and resumes rather than restarting.
  const store = getFulfillmentStore();
  if (!store) {
    // No durable state means no way to guarantee we won't double-send or lose
    // this. Refuse loudly so Stripe retries once a store exists.
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "no_durable_fulfillment_store",
      tier,
    });
    return NextResponse.json({ error: "Fulfillment store unavailable." }, { status: 503 });
  }

  const { record } = await store.claim(session.id, event.id ?? null, {
    paymentStatus: session.payment_status,
    tier,
  });

  // Already fulfilled: acknowledge and send nothing. This is the durable
  // duplicate-email guarantee the in-memory cache could not make.
  if (record.emailSent) {
    logCommerceEvent("webhook_duplicate_ignored", { eventId: event.id, sessionId: session.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.LICENSE_EMAIL_FROM;
  const signingKey = getSigningKeyB64();
  if (!resendKey?.trim() || !fromAddress?.trim() || !signingKey || !email) {
    // The customer paid and this deployment has no way to reach them. The
    // /unlock redirect may still have fulfilled it, but we cannot know that
    // from here — so this is recorded as a possible loss, not shrugged off.
    await store.update(session.id, { status: "failed", lastError: "unknown" });
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "email_delivery_unconfigured",
      tier,
      missing: [
        !resendKey?.trim() ? "RESEND_API_KEY" : null,
        !fromAddress?.trim() ? "LICENSE_EMAIL_FROM" : null,
        !signingKey ? "LICENSE_SIGNING_PRIVATE_KEY" : null,
        !email ? "customer_email_absent_on_session" : null,
      ].filter(Boolean),
    });
    return NextResponse.json({ received: true });
  }

  const license = mintLicenseKey(tier, session.id.slice(-10), session.created, signingKey);
  if (!license) {
    await store.update(session.id, { status: "failed", lastError: "license_mint_failed" });
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "license_mint_returned_null",
      tier,
    });
    return NextResponse.json({ received: true });
  }

  // Minting is deterministic per session, so recording it before the email
  // means a resumed retry re-derives the SAME key rather than a new one.
  await store.update(session.id, { status: "license_minted", licenseMinted: true });
  logCommerceEvent("license_minted", { sessionId: session.id, tier, via: "webhook" });

  const pack = getPackage(tier);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  const unlockUrl = appUrl ? `${appUrl}/unlock` : "the Unlock page";

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromAddress.trim(),
      to: [email],
      subject: `Your Career Forge license key — ${pack.name}`,
      text: [
        `Thanks for purchasing the ${pack.name}.`,
        ``,
        `Your license key:`,
        ``,
        license,
        ``,
        `To unlock: open ${unlockUrl}, paste the key, and you're set.`,
        `The key works on any browser or device — keep this email so you can re-enter it anywhere.`,
        ``,
        `Your career data always stays on your own device. The key carries no personal information.`
      ].join("\n")
    })
    });
  } catch {
    // Network failure reaching Resend. Same rule as a non-2xx: make Stripe
    // retry rather than reporting success we did not achieve.
    await store.update(session.id, { status: "failed", lastError: "email_network_error" });
    logCommerceEvent("fulfillment_email_failed", { sessionId: session.id, tier, status: 0 });
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "fulfillment_email_network_error",
      tier,
    });
    return NextResponse.json({ error: "Fulfillment email failed." }, { status: 500 });
  }

  if (!response.ok) {
    // Do NOT swallow this. A 2xx here tells Stripe the event is handled and it
    // stops retrying, which is exactly how a paid customer disappears. Return
    // 500 so Stripe retries — the license is deterministic, so a retry is safe.
    await store.update(session.id, {
      status: "failed",
      lastError: "email_provider_rejected",
    });
    logCommerceEvent("fulfillment_email_failed", {
      sessionId: session.id,
      tier,
      status: response.status,
    });
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "fulfillment_email_failed",
      tier,
    });
    return NextResponse.json({ error: "Fulfillment email failed." }, { status: 500 });
  }

  await store.update(session.id, {
    status: "email_sent",
    emailSent: true,
    lastError: "none",
  });

  // A completed drill session IS the operational proof. Mirroring it to the
  // drill record means readiness can only become true by the real journey
  // actually running end to end — there is no flag to flip instead.
  if (session.id.startsWith("cs_test_drill_")) {
    await store.claim(DRILL_RECORD_ID, event.id ?? null, {
      paymentStatus: session.payment_status,
      tier,
    });
    await store.update(DRILL_RECORD_ID, {
      status: "email_sent",
      licenseMinted: true,
      emailSent: true,
      lastError: "none",
    });
  }

  logCommerceEvent("fulfillment_email_sent", { sessionId: session.id, tier });
  return NextResponse.json({ received: true });
}
