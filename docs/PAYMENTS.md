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

Stripe webhook checkout.session.completed ──▶ /api/stripe-webhook
  signature + direct Stripe verification ──▶ durable claim ──▶ Resend direct-unlock email
```

- **Client enforcement**: `src/lib/entitlement.ts` re-verifies the stored key
  cryptographically on every load. Tampering (e.g. editing the payload tier)
  fails signature verification — verified by `scripts/entitlement-regression.mjs`.
- **Server price authority**: `/api/checkout` accepts only a tier name and
  prices it from `packages.ts`; the client can never send an amount.
- **Idempotent fulfillment**: re-requesting `/api/license` with the same
  session id re-issues a working key for the same entitlement. P-256 signature
  bytes may differ. Duplicate webhooks are suppressed by durable session state
  and never send a second fulfillment email.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | server (secret) | `sk_test_…` or `sk_live_…`. Used to create and directly verify Checkout Sessions. |
| `STRIPE_PRICE_RESET` | server | Authoritative one-time $49 Price ID for the open package. |
| `STRIPE_WEBHOOK_SECRET` | server (secret) | `whsec_…` for `checkout.session.completed`; required in live configuration. |
| `LICENSE_SIGNING_PRIVATE_KEY` | server (secret) | base64 PKCS8 ECDSA P-256 key. Generate with `node scripts/generate-license-keys.mjs`. |
| `NEXT_PUBLIC_LICENSE_PUBLIC_KEY` | build-time (public) | Matching base64 SPKI public key — ships in the client bundle. |
| `NEXT_PUBLIC_COMMERCE_MODE` | build-time (public) | `off` (default — free beta, no gates, no buy buttons), `test`, or `live`. |
| `NEXT_PUBLIC_APP_URL` | build-time | Canonical origin for checkout success/cancel URLs, e.g. `https://career-forge-lite.vercel.app`. |
| `RESEND_API_KEY` | server (secret) | Dedicated sending-only key for license fulfillment. |
| `LICENSE_EMAIL_FROM` | server | Verified sender, production: `Career Forge <keys@koinophobialabs.com>`. |
| `LICENSE_EMAIL_REPLY_TO` | server | Monitored support address used by the license email. |

**Key hygiene:** test and live deployments must use **different** license
keypairs, or test-mode purchases would unlock production.

## Test-mode bring-up (do this first)

1. `node scripts/generate-license-keys.mjs` → set both license env vars
   (Vercel → Project → Settings → Environment Variables, "Preview" scope).
2. Set `STRIPE_SECRET_KEY` to your **test** key (`sk_test_…`).
3. Set `NEXT_PUBLIC_COMMERCE_MODE=test`, `NEXT_PUBLIC_APP_URL` to the preview URL.
4. Deploy. On `/pricing` you should see the "Test mode" banner.
5. Buy the open `reset` tier with card `4242 4242 4242 4242` (any future date/CVC):
   - Confirm `/unlock` shows and auto-activates the key.
   - Confirm gated surfaces unlock (exports on Résumé Pack, tailor build
     button, outreach templates, interview limit removed).
   - Confirm `/api/license?session_id=<same id>` re-issues a valid key.
6. Simulate failure paths: cancel mid-checkout (returns to `/pricing?checkout=cancelled`),
   and hit `/unlock?session_id=cs_test_garbage` (clean error, retry guidance).
7. Add a webhook endpoint in Stripe → `https://<host>/api/stripe-webhook`,
   event `checkout.session.completed`; set `STRIPE_WEBHOOK_SECRET` + Resend vars;
   confirm the key email arrives.

## Production-host test certification

The production host must be certified with Stripe test mode while its normal
live checkout remains closed. Temporarily set the four
`CERTIFICATION_STRIPE_*` / `CERTIFICATION_OPERATOR_TOKEN` variables documented
in `.env.example` on the exact production commit. Point a separate Stripe test
webhook at the production webhook URL.

`npm run certify` calls the bearer-protected recorder. The deployment—not the
operator laptop—creates the test Checkout Session and re-queries Stripe's
Session, event, account, authoritative $49 Price, durable Neon record, Resend
message ID, license endpoint, and success/cancellation routes. A second delivery
of the same Stripe event and a fresh same-commit deployment are required before
the recorder accepts the evidence.

After evidence is recorded, remove the temporary certification variables,
revoke the Vercel automation bypass, and redeploy the same commit. The route
then returns 404. It never writes human approval.

## Safe launch command

The repository launch command validates the linked Vercel project, keeps
credentials out of arguments and logs, preserves or generates an ECDSA P-256
signing pair, rejects reuse of the other environment's public key, configures
the selected Vercel environment through stdin, deploys, and probes the public
checkout/license boundary.

Run the credential-free plan first:

```bash
npm run commerce:launch -- --dry-run --target preview --app-url https://<preview-host>
npm run commerce:launch -- --dry-run --target production --app-url https://career-forge-lite.vercel.app
```

Then provide the mode-specific Stripe key only in the local process
environment and run the same command without `--dry-run`:

```bash
STRIPE_TEST_SECRET_KEY=... npm run commerce:launch -- --target preview --app-url https://<preview-host> --signing-key-file /absolute/restricted/test-license.json
STRIPE_LIVE_SECRET_KEY=... npm run commerce:launch -- --target production --app-url https://career-forge-lite.vercel.app --signing-key-file /absolute/restricted/live-license.json
```

Never paste either command with its populated value into chat, an issue, or a
shell transcript. The two signing-key files must be different, outside the
repository, and mode `0600`; retain them only through launch verification and
delete them afterward. The older launcher still contains legacy Payment Link
setup and must not be treated as production authorization. Runtime checkout
ignores that link and creates a verified Checkout Session from
`STRIPE_PRICE_RESET`. Production configuration, certification, reconciliation,
and Blake's approval are separate required gates.

## Go-live checklist

- [ ] Owner has approved final pricing (current $49/$79/$99 are **hypotheses**;
      no willingness-to-pay evidence exists — see docs/CAREER_FORGE_MARKET_MAP_2026.md).
- [ ] Owner (or counsel) has reviewed `/terms` and `/privacy`.
- [ ] `LICENSE_EMAIL_REPLY_TO` names a monitored support mailbox.
- [ ] Fresh **production** license keypair generated and set (never the test pair).
- [ ] `STRIPE_SECRET_KEY` = `sk_live_…`, `NEXT_PUBLIC_COMMERCE_MODE=live`,
      `NEXT_PUBLIC_APP_URL` = production URL.
- [ ] `STRIPE_PRICE_RESET` is the live one-time `$49` Career Reset Price ID.
- [ ] Stripe account activated for live payments (business details, bank payout).
- [ ] One real live-mode purchase + refund executed as a smoke test.
- [ ] Statement descriptor set in Stripe (what buyers see on their card).
- [ ] Live webhook created against the production URL with the live signing secret.
- [ ] Dedicated production Resend key, verified sender, and monitored reply-to configured.
- [ ] Production-host test-mode certification recorded for the exact production commit.
- [ ] Human approval remains a separate final gate.

## Refunds and revocation

Refund in the Stripe dashboard. v1 has **no revocation list** — a refunded
buyer's key keeps working (documented, deliberate: no server state). If abuse
appears, add a small denylist of `ref` values checked in `/api/license` and
ship a client denylist with the next deploy.

## Support playbook

- "I lost my key" → use the direct link in the Career Forge license email, or
  verify the Stripe purchase through the support runbook. Stripe receipts do
  not link back to Career Forge. For an audited manual recovery, mint with:
  `LICENSE_SIGNING_PRIVATE_KEY=… node scripts/mint-license.mjs <tier> <order-ref>`
- "Key says invalid" → almost always a partial paste; keys are long and must
  include the `CF1.` prefix. Confirm the key was minted for the same
  environment (test keys don't unlock live builds).
- Review/press copy → mint with ref `review-<name>` so grants are auditable.
