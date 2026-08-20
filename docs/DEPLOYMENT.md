# Career Forge Deployment Guide

Target platform: Vercel (project `career-forge-lite`, production URL
`career-forge-lite.vercel.app`). Standard Next.js App Router build — static
pages plus server-side checkout, verification, redemption, health, and webhook
routes.

## Environments and payment modes

| Mode | `NEXT_PUBLIC_COMMERCE_MODE` | Behavior |
| --- | --- | --- |
| Checkout off (default) | `off` / unset | Useful Free features remain available; paid boundaries remain real; no buy buttons. Safe with zero payment configuration. |
| Payment test | `test` | Gates active, checkout uses `sk_test_…`, "Test mode" banner on /pricing. |
| Live | `live` | Real charges. Complete the go-live checklist in docs/PAYMENTS.md first. |

`NEXT_PUBLIC_*` variables are baked at **build time** — changing them requires
a redeploy, not just an env edit.

## Deploy steps

1. Merge to `main` (or promote the feature branch after review).
2. Verify locally first: `npm test && npm run lint && npm run typecheck && npm run build`.
3. Set env vars in Vercel per `.env.example` / docs/PAYMENTS.md. Live mode
   requires all four authoritative Price IDs plus the certified fulfillment
   configuration. For `off` mode, nothing is required.
4. Deploy (git push if the repo is Vercel-linked, else `vercel deploy`).
   Prefer a **preview deployment** first; promote to production after the
   smoke test below passes.

## Post-deploy smoke test

Free experience (always):
- [ ] `/` renders the goal picker; selecting a goal routes and persists (reload resumes it)
- [ ] `/profile` paste-import → Truth Inbox → approve → facts land in the dossier
- [ ] `/targets` activate a lane → forge → `/versions` shows the pack with real bullets
- [ ] Résumé previews remain editable; locked exports clearly name the smallest pack that unlocks them
- [ ] `/settings` backup downloads; restore preview shows correct counts
- [ ] `/pricing`, `/terms`, `/privacy` render; with commerce off there is **no** buy button and no $149 primary upsell
- [ ] Mobile width: nav menu opens AND closes (Escape / outside tap)
- [ ] No console errors on the routes above

Payment modes (`test` before `live`):
- [ ] Resume $9, Job $15, Career $25, and All Access $39 each create a Stripe Checkout Session with the authoritative Price
- [ ] A repeated request with the same `requestId` is idempotent
- [ ] Completing checkout lands on `/unlock`, which verifies and activates the signed entitlement
- [ ] Reload preserves access; the emailed short code activates a second fresh browser
- [ ] Package gates match the pricing table, including 1/1/3/10 role-direction limits
- [ ] All Access expires at exactly 30 days and falls back to a permanent pack
- [ ] `/unlock` rejects garbage and tampered keys with usable guidance
- [ ] Cancel returns to `/pricing?checkout=cancelled` with no entitlement
- [ ] Duplicate webhook delivery produces one durable fulfillment and one email
- [ ] Production health says `canSellSafely: true`; the temporary certification route returns 404
- [ ] Production Stripe audit reports zero active Career Forge Payment Links

## Rollback

Vercel keeps every deployment: promote the previous deployment from the
dashboard (instant). Data risk on rollback is minimal — user data is
client-side — but do not roll back across a license-keypair rotation, or
newly issued keys would stop validating (the public key ships in the bundle).

## Migrations

Career data has no server database. Client-side schema migrations run inside
`parseState` on load, with unreadable state quarantined rather than destroyed.
Payment fulfillment and recovery-code state are the narrow exception: they are
stored durably without customer identity so charges can be reconciled and
webhooks deduplicated. The legacy single-license browser key migrates into the
multi-entitlement wallet on load.
