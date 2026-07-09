// Paid-beta offer configuration. No billing infrastructure exists (and none
// should yet) — the CTA resolves from environment variables so a checkout
// link (Stripe Payment Link, Gumroad, Lemon Squeezy) can be attached in the
// hosting dashboard without a code change. With nothing configured, the CTA
// degrades honestly to an invite request via the public repo.

export type BetaCtaMode = "checkout" | "email" | "invite";

export type BetaCta = {
  mode: BetaCtaMode;
  label: string;
  href: string;
  hint: string;
};

export const BETA_PRICE_LABEL =
  process.env.NEXT_PUBLIC_BETA_PRICE_LABEL ?? "$19 founding rate · full beta period";

export const BETA_SEATS_LABEL = process.env.NEXT_PUBLIC_BETA_SEATS_LABEL ?? "First 20 seats";

const INVITE_FALLBACK_URL =
  "https://github.com/koinophobia-labs/career-forge-lite/issues/new?title=Paid+beta+invite+request&labels=beta";

export function resolveBetaCta(
  env: { checkoutUrl?: string; contactEmail?: string } = {
    checkoutUrl: process.env.NEXT_PUBLIC_BETA_CHECKOUT_URL,
    contactEmail: process.env.NEXT_PUBLIC_BETA_CONTACT_EMAIL
  }
): BetaCta {
  const checkoutUrl = env.checkoutUrl?.trim();
  if (checkoutUrl) {
    return {
      mode: "checkout",
      label: "Join the paid beta",
      href: checkoutUrl,
      hint: "Secure checkout — you'll get the beta guide by email within a day."
    };
  }

  const contactEmail = env.contactEmail?.trim();
  if (contactEmail) {
    return {
      mode: "email",
      label: "Request a beta invite",
      href: `mailto:${contactEmail}?subject=${encodeURIComponent("Career Forge paid beta invite")}`,
      hint: "Invites go out in small batches — say a sentence about your job search."
    };
  }

  return {
    mode: "invite",
    label: "Request a beta invite",
    href: INVITE_FALLBACK_URL,
    hint: "Invite requests are open — leave a note and you'll get a reply with the details."
  };
}
