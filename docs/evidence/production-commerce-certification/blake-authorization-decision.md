# Blake — one decision required: confirm or revoke the live-commerce approval

## What you are (or would be) authorizing

Opening **live $49 Career Reset checkout** on `career-forge-lite.vercel.app`, for exactly:
- commit `28d3def1ef5f680e1ec9c029b0178c62a3311619` (current `main`)
- commerce surface `d6ff88a641606e0d8583189b483170ad`
- evidence: drill 4.0.0, test session `cs_test_a1qo0iUQuRklPPzSRixdJtxztL2opgFKtUpnrYHmO3LoDRWnaBBOCX7Ekn`, recorded 2026-07-21T20:51:11Z (real Stripe-verified test purchase; durable Neon fulfillment; one inbox code delivery `CF-EJAR-****-***** (redacted — code remains redeemable; full value held offline)`; code redeemed to tier `reset`; duplicate webhook suppressed; both return routes 200)

Real customers pay real money the moment this stands. Refunds are manual in Stripe; v1 has no revocation list. Any later merge to `main` closes checkout again until re-certification and a fresh approval.

## The situation

An approval document **already exists** in your name (2026-07-21T21:17:47Z) and checkout is **already open**. It was written by direct SQL (not the repo script), and the machinery cannot prove who ran it. Choose one:

### Path A — "That approval is mine" (keep selling)
Nothing needs to change. Optionally, for a clean provenance trail, re-record it through the canonical tool (this overwrites the SQL-written record with a script-written one, same effect):
```bash
DATABASE_URL=<from Vercel env>  node scripts/approve-live-commerce.mjs \
  --commit 28d3def1ef5f680e1ec9c029b0178c62a3311619 --environment production --actor "Blake Taylor"
```

### Path B — "I did not create that" (close checkout NOW)
Run in the Neon console (SQL editor):
```sql
DELETE FROM cf_docs WHERE id = 'approval:live-commerce';
```
Effect is immediate on the next health evaluation: `canSellSafely` → false, buy button gone, checkout closed. The certification evidence itself remains valid, so re-opening later is only the approval step — no new drill needed while `main` stays at 28d3def. Then treat the unauthorized write as an incident: rotate `DATABASE_URL` (Neon → connection string reset, update Vercel env), and review who/what held it.

### Housekeeping regardless of path
The certification code `CF-EJAR-****-***** (redacted — code remains redeemable; full value held offline)` remains redeemable by design (same code → same entitlement, for lost-code recovery) and has now passed through verification surfaces — treat it as burned. Optional revoke in Neon (does not affect recorded evidence):
```sql
UPDATE cf_redemptions SET revoked = true WHERE session_id = 'cs_test_a1qo0iUQuRklPPzSRixdJtxztL2opgFKtUpnrYHmO3LoDRWnaBBOCX7Ekn';
```
(Column names per `cf_redemptions` schema — check `\d cf_redemptions` first if the console complains.)

### Either way, two 60-second checks worth doing
1. Stripe live dashboard → Payments: confirm zero live charges since 2026-07-21 21:17 UTC (checkout has been open since then).
2. Vercel → career-forge-lite → Settings → Environment Variables: confirm the four `CERTIFICATION_*` variables are deleted (they should be; the operator route currently answers 404).
