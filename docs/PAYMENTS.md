# Career Forge Payments — Setup & Go-Live Guide

Career Forge sells three one-time packs (config: `src/lib/packages.ts` — names,
prices, deliverables, feature grants all live there). Fulfillment is a signed
**license key**, not an account: the buyer's browser exchanges the Stripe
checkout session id for a key at `/unlock`, and the key verifies offline with
a public key baked into the client. No database, no auth, no career data
server-side.

## Architecture at a glance

```
/pricing ──POST /api/checkout {tier}──▶ Stripe Checkout (price from packages.ts)
   ▲                                        │ success_url
   │                                        ▼
   └──────────── /unlock?session_id=cs_… ──GET /api/license──▶ verify paid
                                            │                  mint ECDSA key
                    localStorage ◀──────────┘ (idempotent — same session
                    career-forge-license-v1     always re-issues a valid key)

Optional: Stripe webhook checkout.session.completed ──▶ /api/stripe-webhook
          (signature-verified) ──▶ Resend emails the key as a backup copy
```

- **Client enforcement**: `src/lib/entitlement.ts` re-verifies the stored key
  cryptographically on every load. Tampering (e.g. editing the payload tier)
  fails signature verification — verified by `scripts/entitlement-regression.mjs`.
- **Server price authority**: `/api/checkout` accepts only a tier name and
  prices it from `packages.ts`; the client can never send an amount.
- **Idempotent fulfillment**: re-requesting `/api/license` with the same
  session id re-issues a working key for the same tier. Duplicate webhooks
  re-send the email — harmless by design (no state to corrupt).

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | server (secret) | `sk_test_…` or `sk_live_…`. Absent → checkout/license APIs return 503 and the UI never shows buy buttons (commerce mode should also be off). |
| `STRIPE_WEBHOOK_SECRET` | server (secret) | `whsec_…` — only needed if the email-backup webhook is configured. |
| `LICENSE_SIGNING_PRIVATE_KEY` | server (secret) | base64 PKCS8 ECDSA P-256 key. Generate with `node scripts/generate-license-keys.mjs`. |
| `NEXT_PUBLIC_LICENSE_PUBLIC_KEY` | build-time (public) | Matching base64 SPKI public key — ships in the client bundle. |
| `NEXT_PUBLIC_COMMERCE_MODE` | build-time (public) | `off` (default — free beta, no gates, no buy buttons), `test`, or `live`. |
| `NEXT_PUBLIC_APP_URL` | build-time | Canonical origin for checkout success/cancel URLs, e.g. `https://career-forge-lite.vercel.app`. |
| `RESEND_API_KEY` | server (secret) | Optional — enables the license-key backup email. |
| `LICENSE_EMAIL_FROM` | server | Optional — from-address for that email, e.g. `Career Forge <keys@yourdomain>`. Must be a Resend-verified domain. |

**Key hygiene:** test and live deployments must use **different** license
keypairs, or test-mode purchases would unlock production.

## Test-mode bring-up (do this first)

1. `node scripts/generate-license-keys.mjs` → set both license env vars
   (Vercel → Project → Settings → Environment Variables, "Preview" scope).
2. Set `STRIPE_SECRET_KEY` to your **test** key (`sk_test_…`).
3. Set `NEXT_PUBLIC_COMMERCE_MODE=test`, `NEXT_PUBLIC_APP_URL` to the preview URL.
4. Deploy. On `/pricing` you should see the "Test mode" banner.
5. Buy each tier with card `4242 4242 4242 4242` (any future date/CVC):
   - Confirm `/unlock` shows and auto-activates the key.
   - Confirm gated surfaces unlock (exports on Résumé Pack, tailor build
     button, outreach templates, interview limit removed).
   - Confirm `/api/license?session_id=<same id>` re-issues a valid key.
6. Simulate failure paths: cancel mid-checkout (returns to `/pricing?checkout=cancelled`),
   and hit `/unlock?session_id=cs_test_garbage` (clean error, retry guidance).
7. (Optional) Add a webhook endpoint in Stripe → `https://<host>/api/stripe-webhook`,
   event `checkout.session.completed`; set `STRIPE_WEBHOOK_SECRET` + Resend vars;
   confirm the key email arrives.

## Go-live checklist

- [ ] Owner has approved final pricing (current $49/$79/$99 are **hypotheses**;
      no willingness-to-pay evidence exists — see docs/CAREER_FORGE_MARKET_MAP_2026.md).
- [ ] Owner (or counsel) has reviewed `/terms` and `/privacy`.
- [ ] A real support contact exists for purchase problems (today the pages say
      "reply to your Stripe receipt" — make sure receipts come from a monitored
      Stripe account email).
- [ ] Fresh **production** license keypair generated and set (never the test pair).
- [ ] `STRIPE_SECRET_KEY` = `sk_live_…`, `NEXT_PUBLIC_COMMERCE_MODE=live`,
      `NEXT_PUBLIC_APP_URL` = production URL.
- [ ] Stripe account activated for live payments (business details, bank payout).
- [ ] One real live-mode purchase + refund executed as a smoke test.
- [ ] Statement descriptor set in Stripe (what buyers see on their card).
- [ ] Webhook (if used) re-created against the production URL with the live secret.

## Refunds and revocation

Refund in the Stripe dashboard. v1 has **no revocation list** — a refunded
buyer's key keeps working (documented, deliberate: no server state). If abuse
appears, add a small denylist of `ref` values checked in `/api/license` and
ship a client denylist with the next deploy.

## Support playbook

- "I lost my key" → their Stripe receipt links back to `/unlock?session_id=…`,
  which always re-issues it. Or mint manually:
  `LICENSE_SIGNING_PRIVATE_KEY=… node scripts/mint-license.mjs <tier> <order-ref>`
- "Key says invalid" → almost always a partial paste; keys are long and must
  include the `CF1.` prefix. Confirm the key was minted for the same
  environment (test keys don't unlock live builds).
- Review/press copy → mint with ref `review-<name>` so grants are auditable.
