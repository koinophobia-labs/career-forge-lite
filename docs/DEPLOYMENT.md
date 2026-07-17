# Career Forge Deployment Guide

Target platform: Vercel (project `career-forge-lite`, production URL
`career-forge-lite.vercel.app`). Standard Next.js App Router build — static
pages plus three serverless API routes (`/api/checkout`, `/api/license`,
`/api/stripe-webhook`).

## Environments and payment modes

| Mode | `NEXT_PUBLIC_COMMERCE_MODE` | Behavior |
| --- | --- | --- |
| Free beta (default) | `off` / unset | No gates, no buy buttons, pricing page shows "free during beta". Safe with zero env configuration. |
| Payment test | `test` | Gates active, checkout uses `sk_test_…`, "Test mode" banner on /pricing. |
| Live | `live` | Real charges. Complete the go-live checklist in docs/PAYMENTS.md first. |

`NEXT_PUBLIC_*` variables are baked at **build time** — changing them requires
a redeploy, not just an env edit.

## Deploy steps

1. Merge to `main` (or promote the feature branch after review).
2. Verify locally first: `npm test && npm run lint && npm run typecheck && npm run build`.
3. Set env vars in Vercel per the table in `.env.example` / docs/PAYMENTS.md
   for the intended mode. For `off` mode, nothing is required.
4. Deploy (git push if the repo is Vercel-linked, else `vercel deploy`).
   Prefer a **preview deployment** first; promote to production after the
   smoke test below passes.

## Post-deploy smoke test

Free-mode (always):
- [ ] `/` renders the goal picker; selecting a goal routes and persists (reload resumes it)
- [ ] `/profile` paste-import → Truth Inbox → approve → facts land in the dossier
- [ ] `/targets` activate a lane → forge → `/versions` shows the pack with real bullets
- [ ] A variant exports to PDF and DOCX; the files open and carry the user's name
- [ ] `/settings` backup downloads; restore preview shows correct counts
- [ ] `/pricing`, `/terms`, `/privacy` render; with commerce off there is **no** buy button
- [ ] Mobile width: nav menu opens AND closes (Escape / outside tap)
- [ ] No console errors on the routes above

Payment modes (`test` before `live`, then repeat on `live` with one real purchase + refund):
- [ ] Each tier's checkout opens Stripe with the right price
- [ ] Completing checkout lands on `/unlock`, which issues + auto-activates the key
- [ ] The same `session_id` re-issues a valid key (refresh the unlock page)
- [ ] Gated surfaces unlock (versions export, tailor build, outreach templates, interview limit)
- [ ] `/unlock` rejects a garbage key with usable guidance
- [ ] Cancelled checkout returns to `/pricing?checkout=cancelled` with no side effects

## Rollback

Vercel keeps every deployment: promote the previous deployment from the
dashboard (instant). Data risk on rollback is minimal — user data is
client-side — but do not roll back across a license-keypair rotation, or
newly issued keys would stop validating (the public key ships in the bundle).

## Migrations

There is no server database. Client-side schema migrations run inside
`parseState` (command-center-store) on load, with unreadable state quarantined
to a recovery key rather than destroyed. Backups restore across versions via
the same revival path.
