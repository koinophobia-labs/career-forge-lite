/**
 * Structured commerce logging.
 *
 * This product deliberately has no database — career data never touches a
 * server, and that is the right call. But "no database" was carried one step
 * too far: it also meant no record that a payment happened, so a customer could
 * be charged and receive nothing with literally nothing anywhere recording it.
 *
 * These lines are the cheapest possible fix. They go to stdout, which Vercel
 * retains and makes searchable, and they give exactly one answer:
 * "who paid, and did they get a key?"
 *
 * NEVER log: email addresses, names, card details, license keys, or any secret.
 * Stripe session ids are logged because they are the reconciliation key and are
 * not themselves sensitive — they identify a transaction, not a person.
 */

export type CommerceEvent =
  | "checkout_opened"
  | "checkout_blocked_unsafe"
  | "license_minted"
  | "license_mint_failed"
  | "webhook_received"
  | "webhook_duplicate_ignored"
  | "webhook_rejected"
  | "fulfillment_email_sent"
  | "fulfillment_email_failed"
  | "redemption_succeeded"
  | "redemption_failed"
  | "redemption_rate_limited"
  | "PAID_BUT_UNFULFILLED";

/**
 * Emit one JSON line. Prefixed so a Vercel log search for `career-forge-commerce`
 * returns the complete commerce history of the deployment.
 */
export function logCommerceEvent(event: CommerceEvent, detail: Record<string, unknown> = {}): void {
  const line = {
    tag: "career-forge-commerce",
    event,
    // Callers pass session ids and tiers. Anything resembling a secret or a
    // person is the caller's responsibility to omit — see the header.
    ...detail,
  };

  // PAID_BUT_UNFULFILLED is the one that matters. If it ever appears, a real
  // person paid and did not get what they bought; see docs/RECOVERY.md.
  if (event === "PAID_BUT_UNFULFILLED" || event.endsWith("_failed")) {
    console.error(JSON.stringify(line));
    return;
  }
  console.log(JSON.stringify(line));
}
