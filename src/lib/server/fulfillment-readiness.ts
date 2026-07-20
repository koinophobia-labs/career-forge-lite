/**
 * Can this deployment actually deliver what it sells?
 *
 * Why this exists
 * ---------------
 * In live mode the checkout route returned a static Stripe Payment Link and the
 * server's involvement ended there. The ONLY fulfillment path ran in the
 * buyer's browser: Stripe redirects to /unlock?session_id=…, the page fetches
 * /api/license, the key is minted client-side-triggered. If the buyer closed the
 * tab, lost signal, or came back through a bank's in-app browser that dropped
 * the redirect, the license was never minted — and because no route logs or
 * persists anything, nothing recorded that a paying customer got nothing.
 *
 * The webhook that was supposed to be the safety net 503s unless
 * STRIPE_WEBHOOK_SECRET is set, and the provisioning script never set it. So the
 * belt existed, the suspenders existed, and neither was fastened.
 *
 * The rule
 * --------
 * A deployment may not take money unless it has a SERVER-SIDE path that can
 * deliver the thing independently of the customer's browser. That means the
 * webhook secret AND an email sender, not just a payment link.
 *
 * This fails closed on purpose. A checkout that refuses to open is a bad day; a
 * checkout that charges and silently delivers nothing is a refund, an apology,
 * and someone's trust.
 */

export type ReadinessRequirement = {
  name: string;
  /** What breaks for a paying customer when this is missing. */
  consequence: string;
  present: boolean;
};

export type FulfillmentReadiness = {
  ready: boolean;
  requirements: ReadinessRequirement[];
  missing: string[];
};

const present = (name: string) => Boolean(process.env[name]?.trim());

/**
 * Evaluate live-commerce readiness. Reads only presence — never values, and
 * never returns a value — so this is safe to surface in a health check.
 */
export function fulfillmentReadiness(): FulfillmentReadiness {
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
  ];

  const missing = requirements.filter((r) => !r.present).map((r) => r.name);
  return { ready: missing.length === 0, requirements, missing };
}

export const isLiveCommerce = () => process.env.NEXT_PUBLIC_COMMERCE_MODE === "live";

/**
 * True when the deployment is configured to sell but cannot prove it can
 * deliver. The pricing page uses this to show a waitlist instead of a buy
 * button, and the checkout route uses it to refuse.
 */
export const liveCommerceUnsafe = () => isLiveCommerce() && !fulfillmentReadiness().ready;
