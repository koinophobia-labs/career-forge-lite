const STRIPE_PAYMENT_LINK_HOST = "buy.stripe.com";

export function getFoundingPaymentLink(raw = process.env.NEXT_PUBLIC_FOUNDING_COHORT_PAYMENT_LINK): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.hostname !== STRIPE_PAYMENT_LINK_HOST) return null;
    return url.toString();
  } catch {
    return null;
  }
}
