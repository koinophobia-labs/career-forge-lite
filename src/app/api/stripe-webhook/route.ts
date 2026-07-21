import { NextResponse } from "next/server";
import { getPackage, isPackageTier } from "@/lib/packages";
import { getSigningKeyB64, mintLicenseKey } from "@/lib/server/license-mint";
import {
  getCertificationStripeConfig,
  getStripeSecretKey,
  retrieveCheckoutSession,
  stripeKeyMode,
  verifyStripeWebhookSignature,
  type CheckoutSession,
} from "@/lib/server/stripe";
import { logCommerceEvent } from "@/lib/server/commerce-log";
import { getFulfillmentStore } from "@/lib/server/fulfillment-store";
import {
  getRedemptionCodePepper,
  issueRedemptionCode,
} from "@/lib/server/redemption-code";
import { verifyPaidSession } from "@/lib/server/session-verification";

// Durable fulfillment: emails the license key on completed checkout so buyers
// who close the success tab still receive it. Duplicate delivery is claimed in
// the durable store and acknowledged without sending a second message.

type StripeEvent = {
  id?: string;
  type: string;
  livemode?: boolean;
  data?: { object?: CheckoutSession };
};

export async function POST(request: Request): Promise<NextResponse> {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  const certification = getCertificationStripeConfig();
  if (!endpointSecret && !certification) {
    return NextResponse.json({ error: "Webhook is not configured on this deployment." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const primarySignatureValid = Boolean(
    endpointSecret && verifyStripeWebhookSignature(rawBody, signature, endpointSecret)
  );
  const certificationSignatureValid = Boolean(
    certification &&
      verifyStripeWebhookSignature(rawBody, signature, certification.webhookSecret)
  );
  if (!primarySignatureValid && !certificationSignatureValid) {
    logCommerceEvent("webhook_rejected", { reason: "invalid_signature" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const certificationEvent = certificationSignatureValid && !primarySignatureValid;
  const secretKey = certificationEvent ? certification!.secretKey : getStripeSecretKey();
  const keyMode = secretKey ? stripeKeyMode(secretKey) : "unknown";
  const eventMode = event.livemode === true ? "live" : "test";
  if (!secretKey || keyMode === "unknown" || keyMode !== eventMode) {
    logCommerceEvent("webhook_rejected", {
      eventId: event.id,
      reason: "stripe_mode_mismatch",
    });
    return NextResponse.json({ error: "Webhook mode mismatch." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  if (!session?.id) {
    return NextResponse.json({ received: true });
  }

  logCommerceEvent("webhook_received", { eventId: event.id, sessionId: session.id });

  // A valid signature proves only that the sender holds the endpoint secret.
  // It does not prove a Checkout Session exists, that it was paid, or that the
  // tier named in metadata is the tier paid for. Ask Stripe.
  const verification = await verifyPaidSession(session.id, async (id) => {
    const looked = await retrieveCheckoutSession(id, secretKey);
    return looked.ok
      ? { ok: true as const, session: looked.session, accountId: null }
      : { ok: false as const, status: looked.status };
  }, certificationEvent ? new Map([[certification!.priceReset, "reset"]]) : undefined);

  if (!verification.ok) {
    // Stripe disagrees with the payload. Never fulfill on the payload's word.
    logCommerceEvent("webhook_rejected", {
      eventId: event.id,
      sessionId: session.id,
      reason: verification.reason,
    });
    return NextResponse.json({ error: "Session verification failed." }, { status: 400 });
  }

  // Authoritative from here down: tier comes from the paid price, not metadata.
  const tier = verification.session.tier;
  const email = verification.session.customerEmail;

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
    // A prior response may have been interrupted after delivery was committed
    // but before temporary retry material was erased. Cleanup is idempotent.
    await store.markRedemptionDelivered(session.id).catch(() => undefined);
    logCommerceEvent("webhook_duplicate_ignored", { eventId: event.id, sessionId: session.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.LICENSE_EMAIL_FROM;
  const replyToAddress = process.env.LICENSE_EMAIL_REPLY_TO;
  const signingKey = getSigningKeyB64();
  const redemptionPepper = getRedemptionCodePepper();
  if (!resendKey?.trim() || !fromAddress?.trim() || !replyToAddress?.trim() || !signingKey || !redemptionPepper || !email) {
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
        !replyToAddress?.trim() ? "LICENSE_EMAIL_REPLY_TO" : null,
        !signingKey ? "LICENSE_SIGNING_PRIVATE_KEY" : null,
        !redemptionPepper ? "REDEMPTION_CODE_PEPPER" : null,
        !email ? "customer_email_absent_on_session" : null,
      ].filter(Boolean),
    });
    return NextResponse.json({ received: true });
  }

  const entitlementReference = session.id.slice(-10);
  const signedEntitlement = mintLicenseKey(tier, entitlementReference, session.created, signingKey);
  if (!signedEntitlement) {
    await store.update(session.id, { status: "failed", lastError: "license_mint_failed" });
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "license_mint_returned_null",
      tier,
    });
    return NextResponse.json({ received: true });
  }

  // The entitlement payload is deterministic per session. P-256 ECDSA may
  // produce different valid signature bytes on a retry; both keys activate the
  // same package. Durable emailSent state prevents a second fulfillment email.
  await store.update(session.id, { status: "license_minted", licenseMinted: true });
  logCommerceEvent("license_minted", { sessionId: session.id, tier, via: "webhook" });

  let redemptionCode: string;
  try {
    const issued = await issueRedemptionCode(
      store,
      {
        sessionId: session.id,
        tier,
        entitlementReference,
        purchaseTimestamp: new Date(session.created * 1000).toISOString(),
      },
      redemptionPepper
    );
    redemptionCode = issued.redemptionCode;
  } catch {
    await store.update(session.id, { status: "failed", lastError: "unknown" });
    logCommerceEvent("PAID_BUT_UNFULFILLED", {
      sessionId: session.id,
      reason: "redemption_code_issue_failed",
      tier,
    });
    return NextResponse.json({ error: "Fulfillment code creation failed." }, { status: 500 });
  }

  const pack = getPackage(tier);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  const unlockUrl = appUrl ? `${appUrl}/unlock` : "the Unlock page";

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey.trim()}`,
      "Content-Type": "application/json",
      // Pending code ciphertext makes the message body stable across retries.
      // Resend also returns the original message id for this idempotency key.
      "Idempotency-Key": `career-forge-license/${session.id}`,
    },
    body: JSON.stringify({
      from: fromAddress.trim(),
      to: [email],
      reply_to: replyToAddress.trim(),
      subject: `Career Forge access ${session.id.slice(-8)}`,
      text: [
        `You received this email because a $${pack.priceUsd} Career Forge purchase was completed for this address.`,
        ``,
        `Your access code:`,
        redemptionCode,
        ``,
        `Paste this code to unlock Career Forge:`,
        unlockUrl,
        ``,
        `Questions? Reply to this email.`
      ].join("\n"),
      html: [
        `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px">`,
        `<p>You received this email because a $${pack.priceUsd} Career Forge purchase was completed for this address.</p>`,
        `<p style="margin-bottom:8px"><strong>Your access code</strong></p>`,
        `<p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:2px;margin:0 0 24px">${redemptionCode}</p>`,
        `<p><a href="${unlockUrl}">Paste this code to unlock Career Forge</a></p>`,
        `<p>Questions? Reply to this email.</p>`,
        `</div>`,
      ].join(""),
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

  const providerResponse = (await response.json().catch(() => null)) as { id?: unknown } | null;
  const providerMessageId =
    typeof providerResponse?.id === "string" && providerResponse.id.trim()
      ? providerResponse.id.trim()
      : null;
  if (!providerMessageId) {
    await store.update(session.id, {
      status: "failed",
      lastError: "email_provider_rejected",
    });
    logCommerceEvent("fulfillment_email_failed", {
      sessionId: session.id,
      tier,
      status: response.status,
      reason: "provider_message_id_missing",
    });
    return NextResponse.json({ error: "Fulfillment email was not acknowledged." }, { status: 500 });
  }

  await store.update(session.id, {
    status: "email_sent",
    emailSent: true,
    emailProviderMessageId: providerMessageId,
    lastError: "none",
  });
  // Permanent state keeps only the HMAC hash. The encrypted retry copy is no
  // longer needed once provider acceptance and fulfillment are durable.
  await store.markRedemptionDelivered(session.id);


  logCommerceEvent("fulfillment_email_sent", { sessionId: session.id, tier, providerMessageId });
  return NextResponse.json({ received: true });
}
