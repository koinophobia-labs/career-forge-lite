# Live-commerce approval boundary

## Why this exists

Live checkout was once opened by an **unsigned approval row** inserted straight
into `cf_docs` (incident 2026-07-21). The gate read the row and believed its
contents — actor `"Blake Taylor"`, a commit, an evidence id — none of which cost
anything to type. Any holder of the application `DATABASE_URL` could authorize
sales. Database write access was equivalent to impersonating the owner.

## The property we now enforce

**Only a signature from the release owner's private key authorizes checkout, and
holding a database connection is not holding that key.**

An approval is an Ed25519-signed statement. The runtime verifies it with a
PUBLIC key committed to the source tree; a public key can check a signature but
cannot make one. A row written by any database client — app, certification
route, webhook, Vercel runtime, or an agent session with a leaked `DATABASE_URL`
— is rejected unless it carries a valid owner signature, which none of them can
produce.

### What is signed

Each approval binds, inside the signed bytes:

- `approvedCommitSha` — the exact deployed commit
- `approvedSurfaceHash` — the certified payment-surface fingerprint
- `approvedHost` — the production hostname
- `approvedEnvironment` — `production`
- `evidenceId` — the exact certification evidence it rests on
- `approvalActor` — **informational only; never proof**
- `approvedAt`, `nonce`

Change any bound field and the signature no longer verifies; keep the signature
and the field still has to match this deployment. A new production SHA changes
`approvedCommitSha` (and usually `approvedSurfaceHash`), so **any deploy after an
approval invalidates it** — the existing rule is preserved and now cryptographic.

### Trust root

`src/lib/server/approval-public-key.ts` holds the base64 SPKI public key. It is
**committed, not an environment variable** — env vars are writable by anyone with
Vercel access, one of the surfaces this boundary distrusts. Pinning it in
reviewed source keeps key changes on the code-review path, and because the file
is part of the certified surface, swapping the key changes the surface hash and
voids prior certification. It ships **empty**, which fails closed: no installed
key → every approval rejected → checkout closed.

## Owner runbook

**One-time — generate the keypair (offline, trusted machine):**
```bash
node scripts/generate-approval-keypair.mjs --out /secure/offline/cf-approval.key
```
Keep the private key offline (0600, never in Vercel/repo/agent env). Paste the
printed public key into `src/lib/server/approval-public-key.ts`, commit, deploy.

**To authorize checkout for a certified commit:**
```bash
APPROVAL_DATABASE_URL=<approver writer credential> \
node scripts/authorize-live-commerce.mjs \
  --private-key-file /secure/offline/cf-approval.key \
  --commit <deployed-sha> \
  --host career-forge-lite.vercel.app \
  --environment production
```
It signs offline and records the signed approval. Verify:
```bash
curl -s https://career-forge-lite.vercel.app/api/commerce-health
```

`scripts/approve-live-commerce.mjs` (the old unsigned writer) is **disabled** and
refuses to run.

## Second lock — database role separation (MANDATORY)

The signature stops a forged row from verifying. Role separation stops the
application from *writing* an approval row at all, so the raw-SQL path — the exact
2026-07-21 vector — is rejected by Postgres, not merely ignored by the gate. This
is required, not optional.

- Approvals live in their own table, **`cf_approvals`**, created and owned by the
  migration/admin — never by the application. The app's Postgres store never
  creates it and has no write method for it (`getApproval` is read-only).
- The runtime reads approvals via `getApproval` (SELECT). Writing lives only in
  `src/lib/server/approver-store.ts`, a Postgres-only module used exclusively by
  the offline signer with the separate `APPROVAL_DATABASE_URL` credential. The
  `FulfillmentStore` interface the app holds exposes **no approval writer**.
- **Vercel KV cannot back live commerce.** KV uses one token for every key and
  cannot isolate approval writes; `KvFulfillmentStore.getApproval` always returns
  null and readiness blocks a KV-only deployment (`isolated_approval_store`
  check). Live commerce requires the Postgres role split.

**Run the migration once, with a Neon admin credential** (not the app URL, not an
agent env). Create the approver role out of band first — its password is never in
the repo:

```
CREATE ROLE cf_approver LOGIN PASSWORD '<set in a secure channel>';   -- out of band

psql "<admin url>" -v app_role=<the app's role> \
  -f scripts/migrations/2026-07-approval-role-separation.sql
```

The migration (`scripts/migrations/2026-07-approval-role-separation.sql`) is
idempotent, quotes the role identifier safely (`:"app_role"`), refuses to run
until `cf_approver` exists, removes the legacy `cf_docs` approval, grants the app
role **SELECT only** on `cf_approvals`, and grants the approver role write.

**Proof it enforces:** `bash scripts/approval-migration-smoke.sh` (`npm run
test:migration`) spins up a disposable Postgres, applies the migration, and
asserts the app role is denied INSERT/UPDATE/DELETE/TRUNCATE while the approver
role can write, that the guard refuses without the role, that re-running is safe,
and that a missing table fails closed — 12/12 against a real database.

## Tests

- `scripts/approval-boundary-regression.mjs` (`npm test`): the twelve required
  attacks fail and a genuine owner signature succeeds — application-role insert,
  certification-role insert, forged actor, approval copied to another commit or
  surface hash, stale certification, raw-SQL bypass (the exact incident), leaked
  `DATABASE_URL`, approval without the private key, deploy-after-approval, revoked
  approval, key rotation — plus namespace isolation, the KV store having no
  writer, the signer refusing non-Postgres credentials, and fail-closed with no
  installed key.
- `scripts/fulfillment-safety-regression.mjs` (`npm test`): includes the
  KV-cannot-open-live-commerce case and the unsigned-plaintext-in-approvals case.
- `scripts/approval-migration-smoke.sh` (`npm run test:migration`): the real
  Postgres grant proof above.

## Not yet a complete boundary — the reviewer identity (OPEN)

`.github/CODEOWNERS` routes changes to the trust-root files (the public key, the
gate, the signer, the migration) to the release owner, and `main` is protected to
require pull requests and block force-push/deletion. **This is prepared, not
complete.** The `gh` credential in the working environment is authenticated as
`@koinophobia-labs` — the same identity available to automation — so "require
Code Owner review" is not yet enabled: with a single shared identity it would
either be satisfiable by the agent (theater) or brick self-authored merges. The
CODEOWNERS protection becomes real only once the owner establishes a **reviewer
identity that Claude, Codex, Vercel, and the current `gh` token cannot access**,
then enables required code-owner review (command in the PR notes). Until then,
treat the file-ownership map as documentation, not enforcement.
