# Career Forge — Production Commerce Certification Evidence Packet
**Compiled 2026-07-22 (America/Chicago) by the operational-certification session. No product code was changed; no deploy was triggered; live checkout state was not modified.**

## 1. Exact production state

| Fact | Value |
|---|---|
| Canonical `main` SHA | `28d3def1ef5f680e1ec9c029b0178c62a3311619` (Merge PR #35 — short redemption codes) |
| Deployed Production SHA | `28d3def1…` — **identical to main tip** |
| Current production deployment | `dpl_BC9tGeTvT4F3UJ3c2qKC1gj2k19J` (READY, target=production, created 2026-07-21 20:52:44 UTC — the post-certification redeploy) |
| Deployment serving at record time | `dpl_BWSrN3AJ1RKqQyo8zFa4Z3xTgjPK` (20:48:35 UTC); first deploy of the commit `dpl_8ATSBZsyhRe7adn3S9YFy2dGpQT1` (20:26:51 UTC) |
| Certified commerce-surface hash | `d6ff88a641606e0d8583189b483170ad` (repo `src/lib/server/certified-surface-hash.ts` @ 28d3def; runtime match proven by the passing `stripe_verified_certification` check) |
| Production hostname | `career-forge-lite.vercel.app` (Vercel project `prj_LJreimmVNzKO9Sb7pIXEPEZP377K`, team `koinophobia999-8829s-projects`) |
| Stripe mode (certification) | **test** — enforced three ways by the recorder (`cs_test_` pattern, `event.livemode === false`, `session.livemode` false + `requireTestMode` policy) |
| Stripe account id | recorded in the evidence document (recorder requires `/v1/account` lookup; see §4 retrieval) |
| Neon fulfillment store | `neon-postgres`, healthy (round-trip write/read/delete probe passed) |
| Resend configuration | present (`RESEND_API_KEY`, `LICENSE_EMAIL_FROM`, `LICENSE_EMAIL_REPLY_TO` all attested present); live sender observed: `support@koinophobialabs.com` |
| commerce-health (2026-07-23 02:44 UTC) | `liveMode: true, canSellSafely: true, configurationReady: true, operationalReady: true, missingConfiguration: [], blockers: []` — all five operational checks passing |

## 2. Production configuration presence (no secret values read, printed, or committed)

Attested by the deployment itself via `/api/commerce-health` (`configurationReady: true`, `missingConfiguration: []`), which reports presence only:
`STRIPE_SECRET_KEY` ✓ · `LICENSE_SIGNING_PRIVATE_KEY` ✓ · `REDEMPTION_CODE_PEPPER` ✓ · `STRIPE_PRICE_RESET` ✓ · `STRIPE_WEBHOOK_SECRET` ✓ · `RESEND_API_KEY` ✓ · `LICENSE_EMAIL_FROM` ✓ · `LICENSE_EMAIL_REPLY_TO` ✓ · durable DB (`DATABASE_URL`) ✓ (store kind `neon-postgres`).

**Temporary certification controls** (`CERTIFICATION_STRIPE_SECRET_KEY`, `CERTIFICATION_STRIPE_PRICE_RESET`, `CERTIFICATION_STRIPE_WEBHOOK_SECRET`, `CERTIFICATION_OPERATOR_TOKEN`): presence is deliberately not externally observable (the operator route returns 404 identically when unconfigured or unauthorized). Required end-state per `docs/PAYMENTS.md` is **removed after recording**; the dedicated same-commit redeploy at 20:52:44 UTC — four minutes after evidence was recorded — matches that removal step. Blake can confirm in Vercel → Settings → Environment Variables (names view).

## 3. The certification drill (v4.0.0) — what happened, with proof

Timeline (UTC, 2026-07-21):
- **20:26:47** — PR #35 merged; `main` = 28d3def; production auto-deploys it (20:26:51).
- **20:26 → 20:48** — four same-commit production redeploys (the drill's "fresh deployment" requirement; durable state must survive instance replacement).
- **~20:44** — deployment-created **$49 test Checkout Session** `cs_test_a1qo0iUQuRklPPzSRixdJtxztL2opgFKtUpnrYHmO3LoDRWnaBBOCX7Ekn` completed; production webhook fulfilled it.
- **20:44:58** — fulfillment email delivered: Gmail message id `19f866cb530baf92`, INBOX, subject `Career Forge access BOCX7Ekn` (session-suffix-bound), containing short code **`CF-EJAR-****-***** (redacted — code remains redeemable; full value held offline)`** (format `CF-XXXX-XXXX-XXXXX` ✓) and the `/unlock` link. **Exactly one inbox delivery exists for this session** (the two earlier "access frgKANDj"/"access Ci7QvtLF" messages are prior drill iterations against earlier commits, 20:15/19:32 UTC).
- **20:51:11** — the recorder (`/api/internal/commerce-certification`, bearer-protected, deployment-owned) accepted and wrote evidence `certification:operational`. Acceptance structurally required ALL of: Stripe-confirmed `checkout.session.completed` event bound to this session; Stripe-confirmed paid $49 at the recognized certification price; session metadata HMAC-bound to this commit + this host (proof = HMAC(operatorToken, commit|host)); **durable Neon record with `attempts ≥ 2`** (duplicate delivery suppressed — one email only); Resend provider message id present; hashed-code-only storage (`pendingCodeCiphertext === null`, not revoked); live `/api/license` exchange → signed entitlement verifying to tier `reset`; live `/api/redeem` with the emailed code → signed entitlement verifying to tier `reset`; `/unlock?session_id=…` → 200 and `/pricing?checkout=cancelled` → 200.
- **20:52:44** — final same-commit redeploy (certification variables removed; operator route now 404).
- **21:17:47** — an approval document appeared (see §5 — attribution unresolved).

**Duplicate-fulfillment proof:** `attempts ≥ 2` on the durable record is a hard recorder precondition, and the durable `emailSent` short-circuit acknowledges duplicates without sending (`webhook_duplicate_ignored`); exactly one email exists for the certified session (verified in Gmail).

**Persistence proof:** the entitlement is a client-held signed key re-verified offline on every load (survives refresh and deployments by architecture); the durable Neon record survived five same-commit deployment replacements during the drill window; certification evidence itself was read back by a *later* deployment (the one serving today's passing commerce-health).

## 4. Re-verification performed today (2026-07-22) from this machine

Every command and result:
1. `curl https://career-forge-lite.vercel.app/api/commerce-health` → full passing verdict (§1); certification pinned to `cs_test_a1qo0iUQ…` at `2026-07-21T20:51:11.767Z`; approval "Blake Taylor at 2026-07-21T21:17:47.704182+00:00"; `no_outstanding_unfulfilled: 0`.
2. `node scripts/fulfillment-safety-regression.mjs` at 28d3def → **149 passed, 0 failed**.
3. Redemption normalization proof (repo module, transpiled in node): `"cf ejar amx8 qx4qq"` and `"cf-EJAR-amx8-QX4QQ"` both normalize to the same canonical code — lowercase and spaced input redeem identically.
4. Public return paths live: `/unlock` → **200**; `/pricing?checkout=cancelled` → **200**; `/pricing` renders the live $49 offer.
5. Gmail (controlled mailbox): exactly three `Career Forge access *` messages exist, all test-drill fulfillments to the controlled address; the certified one is `19f866cb530baf92` (full body archived in this packet's directory).
6. Vercel: production deployment inventory (§1) confirms prod == main == certified commit; runtime-log retention on this plan is ~1 hour, so drill-time log lines are no longer retrievable from Vercel.
7. Session-transcript search: the drill was executed from a non-CCD agent surface (deploy metadata `actor: "codex"`); no CCD transcript contains the drill or the approval act.

**Retrieving the full evidence document** (contains `stripeEventId` (`evt_…`), `emailProviderMessageId` (Resend id), `stripeAccountId`, `fulfillmentAttempts`): it lives in Neon `cf_docs`, id `certification:operational`. From the Neon console:
```sql
SELECT jsonb_pretty(doc) FROM cf_docs WHERE id IN ('certification:operational','approval:live-commerce');
```
This machine holds no `DATABASE_URL`, so those two rows could not be re-read here; their integrity is nonetheless attested by the running deployment (the passing health checks re-validate both documents against the live commit, surface hash, host, and each other on every call).

## 5. ⚠️ The approval record — attribution unresolved (Blake must confirm or revoke)

`approval:live-commerce` exists: actor **"Blake Taylor"**, approved at **2026-07-21T21:17:47.704182+00:00**, correctly bound to the current evidence (the binding check passes). Because of it, **live checkout is OPEN now** — `canSellSafely: true` since ~21:17 UTC on 2026-07-21.

Two provenance facts the packet must state plainly:
1. It was **not** written by the repo's `scripts/approve-live-commerce.mjs`: that script stamps `approvedAt` with JavaScript `toISOString()` (millisecond precision, `Z`), and the store saves documents verbatim (`JSON.stringify(doc)::jsonb`). The observed value has **microsecond precision with `+00:00`** — the shape of Postgres `to_jsonb(now())` / a console-SQL insert, not the script.
2. The script's **default** `--actor` is literally `"Blake Taylor"`, so the actor string by itself attests nothing about who acted.

Consistent innocent explanation: a prior session prepared exact SQL and Blake pasted it into the Neon console ~25 minutes after the drill passed. Consistent bad explanation: an automated session wrote it directly, impersonating the human gate. **Nothing on this machine can distinguish the two. Only Blake can.** This session created, modified, and deleted nothing in the store.

## 6. No live customer charge

- The certification purchase was Stripe **test mode**, enforced structurally at three layers by the recorder; the $49 was a test-card payment, not money.
- Zero live-mode fulfillment artifacts exist anywhere observable: the only fulfillment emails ever sent are the three test-drill messages to the controlled mailbox; `no_outstanding_unfulfilled: 0`; no commerce activity in the retained log window.
- Residual check only Blake can perform: Stripe live dashboard → Payments should show no charges. (Live checkout HAS been open since 2026-07-21 21:17 UTC — if any real charge appears, treat fulfillment verification as priority one.)

## 7. Standing operational rule (important)

Certification pins the **exact commit SHA**. Any merge to `main` — even docs — auto-deploys a new SHA, voids this certification, and closes checkout until a fresh drill (requires temporarily restoring the four `CERTIFICATION_*` variables) and a fresh approval. Release trains must end with re-certify → re-approve. This is why PR #27 was closed rather than merged, and why this packet is not committed to `main`.
