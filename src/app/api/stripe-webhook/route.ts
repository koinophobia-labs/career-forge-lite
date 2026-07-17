import { NextResponse } from "next/server";
import { getPackage, isPackageTier } from "@/lib/packages";
import { getSigningKeyB64, mintLicenseKey } from "@/lib/server/license-mint";
import { verifyStripeWebhookSignature, type CheckoutSession } from "@/lib/server/stripe";

// Optional fulfillment backup: emails the license key on completed checkout so
// buyers who close the success tab still receive their key. Primary
// fulfillment is the /unlock page exchanging the session id — this webhook is
// belt-and-suspenders, and safe to leave unconfigured.
//
// Duplicate webhook deliveries re-send the same email; that is harmless and
// deliberate (no database exists to dedupe against, and a duplicate receipt
// email beats a missing key).

type StripeEvent = {
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
  if (!session || !isPackageTier(tier) || session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.LICENSE_EMAIL_FROM;
  const signingKey = getSigningKeyB64();
  if (!resendKey?.trim() || !fromAddress?.trim() || !signingKey || !email) {
    // Nothing to do without email delivery configured; /unlock still fulfills.
    return NextResponse.json({ received: true });
  }

  const license = mintLicenseKey(tier, session.id.slice(-10), session.created, signingKey);
  if (!license) return NextResponse.json({ received: true });

  const pack = getPackage(tier);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  const unlockUrl = appUrl ? `${appUrl}/unlock` : "the Unlock page";

  await fetch("https://api.resend.com/emails", {
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
  }).catch(() => {
    // Email failure must not fail the webhook: Stripe would retry and the
    // buyer can always fulfill through the receipt link.
  });

  return NextResponse.json({ received: true });
}
