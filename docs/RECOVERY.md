# Recovery: someone paid and didn't get their key

Career data never touches a server. Operational payment state is stored in a
PII-free durable fulfillment table so Stripe payments can be reconciled without
copying customer names, email addresses, or card data into Career Forge.

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

The entitlement payload is deterministic: the same session id, tier, and issue
time always represent the same grant. P-256 ECDSA signatures may produce
different valid bytes when re-minted; both keys activate the same package. A
manual recovery must not be sent until the durable record and provider history
confirm that it will not duplicate an earlier fulfillment email.

## 3. If you can't deliver, refund

Refund from the Stripe dashboard (full, `requested_by_customer`). Tell them it
was on your side. A refunded customer who was told what happened is recoverable;
a silent one is not.

## 4. Recovery facts

- Stripe receipts prove payment; they are not Career Forge recovery links.
- The dedicated license email contains a direct unlock link that verifies the
  Stripe Session and issues a valid license for the same entitlement.
- The paid Stripe Price ID, not metadata, is the authoritative package signal.
- Duplicate webhook delivery must leave `email_sent` and the provider message ID
  unchanged; if it does not, stop and fix idempotency before manual recovery.

## 5. Reopening checkout

`/api/commerce-health` reports whether this deployment may sell. It returns
`canSellSafely: true` only when live mode is on, configuration and operational
certification pass, and Blake's approval record matches the exact commit and
evidence. Until then the pricing page shows a contact CTA
instead of a buy button and `/api/checkout` refuses with 503.

The operator must configure the live Stripe key, Price ID, webhook secret,
Resend key, verified sender, monitored reply address, and durable store; complete
production-host test-mode certification; reconcile all live successes; and then
wait for Blake's separate approval command.
