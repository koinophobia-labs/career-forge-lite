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

## Tests

`scripts/approval-boundary-regression.mjs` (wired into `npm test`) proves the
twelve required attacks all fail and a genuine owner signature succeeds:
application-role insert, certification-role insert, forged actor, approval copied
to another commit, approval copied to another surface hash, stale certification,
raw-SQL bypass (the exact incident), leaked `DATABASE_URL`, approval without the
private key, deploy-after-approval, revoked approval, and key rotation — plus
fail-closed behavior when no key is installed.

## Optional hardening — database role separation (defense in depth)

The cryptographic boundary above stops the attack on its own: a forged row does
not verify. The following adds a second, independent lock at the database so the
application role cannot even *write* an approval row — useful if you want the
raw-SQL path rejected by Postgres, not merely ignored by the gate. It requires
Neon admin and moving approvals to their own table. **Provided for the owner to
apply at discretion; not required for the crypto boundary to hold.**

```sql
-- 1. Approvals get their own table, separate from app documents.
CREATE TABLE IF NOT EXISTS cf_approvals (
  id         text PRIMARY KEY,
  approval   jsonb NOT NULL,     -- { payload, signature, alg }
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. A distinct writer role whose credential lives ONLY on the owner's machine
--    (APPROVAL_DATABASE_URL), never in Vercel or any agent environment.
CREATE ROLE cf_approver LOGIN PASSWORD '<offline-only secret>';
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_approvals TO cf_approver;

-- 3. The application role (the Vercel DATABASE_URL) may READ approvals to verify
--    them, but may never write one. Raw INSERT from the app role is denied by
--    Postgres, not just by application code.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cf_approvals FROM <app_role>;
GRANT  SELECT ON cf_approvals TO <app_role>;
```

Verify the lock:
```sql
SET ROLE <app_role>;
INSERT INTO cf_approvals (id, approval) VALUES ('approval:live-commerce', '{}');
-- expected: ERROR: permission denied for table cf_approvals
RESET ROLE;
```

To adopt this, point the runtime's approval read at `cf_approvals` and the
`authorize-live-commerce.mjs` write at the `cf_approver` credential. Until then,
approvals remain in `cf_docs` and the cryptographic signature is the enforced
boundary.
