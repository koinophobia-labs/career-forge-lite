# Career Forge self-service payments

Career Forge sells simple one-time access, not AI credits or an automatically
renewing subscription. The optional $149 human résumé service is separate,
inquiry-first, and has no automated checkout path.

## Product contract

| Offer | Price | Access |
| --- | ---: | --- |
| Free | $0 | Import/enter history, evidence review, one role direction, editable previews, job analysis, tracking, and six interview answers. No card or account. |
| Resume Pack | $9 once | Permanent baseline PDF/DOCX/ZIP résumé exports for one role direction. |
| Job Pack | $15 once | Resume Pack plus one target-job tailoring, application/outreach materials, and unlimited interview answers. |
| Career Pack | $25 once | Job Pack plus LinkedIn/profile materials, complete career ZIP, transition positioning, and up to three role directions. |
| 30-Day All Access | $39 once | Every paid workflow and up to ten role directions for exactly 30 days. No auto-renewal. |

`src/lib/packages.ts` is the canonical definition for names, prices,
deliverables, limits, durations, and feature grants.

## Trust boundary and fulfillment

```text
/pricing ── POST /api/checkout {tier, requestId} ──▶ Stripe Checkout Session
                                                         │
                       cancel ◀───────────────────────────┤
                                                         ▼ success
/pricing?checkout=cancelled                  /unlock?session_id=cs_...
                                                         │
                                              GET /api/license
                                                         │
                    direct Stripe lookup + Price/amount/currency verification
                                                         │
                                          signed CF1 entitlement

Stripe checkout.session.completed ──▶ signature check ──▶ Stripe re-query
                                   ──▶ durable idempotent claim
                                   ──▶ short recovery code via Resend
```

- The browser sends a tier, never an amount or Price ID. The server maps each
  tier to one environment-configured Stripe Price.
- Checkout requests carry a random retry identity, which becomes a Stripe
  idempotency key. Repeating one click cannot create unrelated sessions.
- Metadata never grants access. Session verification derives the tier from the
  paid Price ID and separately checks amount, currency, paid status, and email.
- The client stores server-signed ECDSA P-256 entitlements, never a trusted
  boolean. Editing the tier or expiry breaks the signature.
- Multiple signed purchases coexist. The highest active pack is shown for
  compatibility, features are the union of active grants, and expired All
  Access falls back to any permanent pack.
- A short recovery code can activate another browser. No user account is
  required; reloads preserve the local signed wallet. Career data is never sent
  to Stripe or the fulfillment store.
- Webhook delivery is durably idempotent by Checkout Session. A retry resumes
  incomplete fulfillment and never sends a second successful delivery email.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-only `sk_test_...` or `sk_live_...` used to create and verify Sessions. |
| `STRIPE_PRICE_RESUME` | Authoritative one-time $9 Price ID. |
| `STRIPE_PRICE_JOB` | Authoritative one-time $15 Price ID. |
| `STRIPE_PRICE_CAREER` | Authoritative one-time $25 Price ID. |
| `STRIPE_PRICE_ALL_ACCESS` | Authoritative one-time $39 Price ID. |
| `STRIPE_WEBHOOK_SECRET` | Server-only signing secret for `checkout.session.completed`. |
| `LICENSE_SIGNING_PRIVATE_KEY` | Server-only base64 PKCS8 P-256 signing key. |
| `NEXT_PUBLIC_LICENSE_PUBLIC_KEY` | Matching base64 SPKI key embedded in the client. |
| `REDEMPTION_CODE_PEPPER` | Independent server-only secret for recovery-code hashing/encryption. |
| `DATABASE_URL` | Preferred durable Neon store. KV variables remain a supported fallback. |
| `RESEND_API_KEY` | Server-only sending key for purchase recovery email. |
| `LICENSE_EMAIL_FROM` | Verified transactional sender. |
| `LICENSE_EMAIL_REPLY_TO` | Monitored support mailbox. |
| `NEXT_PUBLIC_COMMERCE_MODE` | `off`, `test`, or `live`; a build-time value. |
| `NEXT_PUBLIC_APP_URL` | Clean canonical origin used for Stripe return URLs. |

Preview and production must use different license signing keypairs. Never put a
secret in source, shell arguments, support tickets, or logs.

## Test-mode verification

1. Provision all four test Products/Prices with `npm run commerce:launch` or
   configure their Price IDs manually.
2. Set test Stripe, signing, webhook, durable store, Resend, and app URL values;
   set `NEXT_PUBLIC_COMMERCE_MODE=test`; deploy the preview.
3. Buy each package with Stripe test card `4242 4242 4242 4242`.
4. For every purchase, verify the Stripe amount and Price ID, success return,
   immediate activation, refresh persistence, emailed code, second-browser
   redemption, and exact feature boundaries.
5. Verify cancel returns to `/pricing?checkout=cancelled` with no entitlement.
6. Re-deliver the webhook and prove only one email/access code exists.
7. Move the clock to the exact All Access expiry boundary and prove paid
   workflows re-lock while local work and permanent packs remain.

## Catalog packaging command

Start with the non-mutating plan:

```bash
npm run commerce:launch -- --dry-run --target preview --app-url https://<preview-host>
npm run commerce:launch -- --dry-run --target production --app-url https://career-forge-lite.vercel.app
```

The live command reuses the deployed signing pair when valid, otherwise accepts
a mode-0600 keypair file outside the repository. It provisions the exact four
Prices idempotently, writes Vercel values over stdin, removes legacy environment
variables, deactivates only obsolete Career Forge Payment Links, deploys, and
probes all four checkout tiers. It does not certify or authorize live sales.

## Production certification and release

Live checkout requires both configuration and operational proof. Presence of
keys is not proof that delivery works.

1. Deploy the final commit to the production host with live checkout still
   fail-closed.
2. Temporarily configure the `CERTIFICATION_STRIPE_*` values from `.env.example`
   and a separate Stripe test webhook for the exact production host.
3. Complete the $9 Resume Pack test purchase and fulfillment journey. Re-deliver
   the event to prove durable duplicate suppression, then run `npm run certify`.
4. Record explicit human authorization for that exact commit and evidence with
   `scripts/approve-live-commerce.mjs`.
5. Remove every temporary certification variable and bypass, redeploy the same
   commit, and require `/api/internal/commerce-certification` to return 404.
6. Require `/api/commerce-health` to report `canSellSafely: true` and verify all
   four live checkout Sessions show the correct Price and amount. Do not place a
   real charge merely to inspect a Session.
7. Run `npm run audit:stripe-links`; it must find one exact live Price per pack
   and zero active Career Forge Payment Links.

Any checkout-surface edit changes the certified hash and closes live checkout
until the new build is certified and approved again.

## Recovery, refunds, and limitations

Use `docs/RECOVERY.md` for a paid-but-unfulfilled purchase. Stripe is the source
of truth and the paid Price determines the tier. Resume, Job, and Career Pack
keys are deliberately permanent and offline; already activated keys cannot be
remotely revoked. Revoking a short code prevents future redemption but not an
entitlement already stored on a device.
