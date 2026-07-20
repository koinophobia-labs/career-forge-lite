# Recovery: someone paid and didn't get their key

This product has no database on purpose — career data never touches a server.
The cost of that choice is that Stripe is the only system that knows a purchase
happened, so reconciliation is manual. At a five-seat founding cohort that is a
five-minute job. Do it after every sale until the webhook path is proven.

## 1. Find out whether anyone was lost

**Vercel logs.** Every commerce event is one JSON line tagged
`career-forge-commerce`. Search production logs for:

```
PAID_BUT_UNFULFILLED
```

That event fires when a real payment could not be delivered — unusable tier
metadata, a missing signing key, unconfigured email, or a failed send. Each line
carries a `sessionId` and a `reason`. It is deliberately logged at error level.

Also worth searching:

| Event | Meaning |
|---|---|
| `checkout_opened` | someone was sent to Stripe |
| `checkout_blocked_unsafe` | checkout refused because delivery wasn't provable |
| `license_minted` | a key was issued (`via: unlock_page` or `via: webhook`) |
| `fulfillment_email_failed` | Resend rejected or was unreachable |
| `webhook_duplicate_ignored` | Stripe re-delivered an event we'd handled |

**Reconcile against Stripe.** In the Stripe dashboard, list successful payments
for the period. For each `payment_intent`, find the Checkout Session id, then
search the logs for that `sessionId`. A payment with no `license_minted` line is
an unfulfilled customer.

> Logs are retained for a limited window on Vercel. If a payment predates the
> retention window, treat Stripe as the source of truth and assume nothing was
> delivered unless the customer says otherwise.

## 2. Mint and send the key by hand

```
node scripts/mint-license.mjs --tier reset --session <checkout_session_id>
```

Minting is deterministic: the same session id always produces the same key, so
re-running this is safe and cannot create a second entitlement. Email the key to
the address on the Stripe payment with a short apology and the unlock link.

## 3. If you can't deliver, refund

Refund from the Stripe dashboard (full, `requested_by_customer`). Tell them it
was on your side. A refunded customer who was told what happened is recoverable;
a silent one is not.

## 4. Known gaps this runbook exists because of

Two things were true in production as of 2026-07-20 and should be re-checked
before checkout reopens:

- **The receipt-link promise may be false.** The unlock page tells buyers "Your
  Stripe receipt links back to this page if you ever lose it." Stripe receipt
  emails link to Stripe's hosted receipt, not to the `after_completion` redirect.
  Verify against a real receipt; if it's wrong, fix the copy and point people at
  the support address instead.
- **Payment Link → Session metadata propagation is unverified.** Both fulfillment
  paths require `session.metadata.tier`. The launch script sets it on the Payment
  Link and assumes Stripe copies it onto the Session. If it doesn't, every live
  purchase fails at the tier check while the money is still collected. One
  sandbox purchase proves it either way.

## 5. Reopening checkout

`/api/commerce-health` reports whether this deployment may sell. It returns
`canSellSafely: true` only when live mode is on **and** every fulfillment
setting is present — Stripe key, signing key, payment link, **webhook secret,
Resend key, sender address**. Until then the pricing page shows a contact CTA
instead of a buy button and `/api/checkout` refuses with 503.

To reopen: register the webhook endpoint in Stripe, add the three missing
settings to Vercel production, add them to `scripts/commerce-launch.mjs` so they
can't be forgotten again, then confirm `/api/commerce-health` reports
`canSellSafely: true`.
