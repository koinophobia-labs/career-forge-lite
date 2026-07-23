-- Approval role separation — REQUIRED before this build can authorize checkout.
--
-- Run once, with a Neon ADMIN/owner credential (not the application DATABASE_URL
-- and not any agent environment). It creates the isolated approvals table, a
-- separate offline writer role, and grants that make the application/certification
-- role able to READ approvals but never WRITE them. After this, a raw
-- `INSERT INTO cf_approvals` from the app role is rejected by Postgres — the
-- second, independent lock beneath the Ed25519 signature check.
--
-- Replace the two placeholders before running:
--   :app_role         the role the Vercel DATABASE_URL connects as
--   :approver_password a strong secret kept ONLY on the owner's offline machine
--
-- The approver credential becomes APPROVAL_DATABASE_URL for
-- scripts/authorize-live-commerce.mjs. It must never enter Vercel, the repo, or
-- any agent configuration.

BEGIN;

-- 1. Remove the legacy plaintext approval path. Approvals no longer live in
--    cf_docs. (Containment note: if the unauthorized 2026-07-21 row was not
--    already deleted, this removes it. Prefer running the standalone
--    `DELETE ... RETURNING id, doc` first so the record is preserved.)
DELETE FROM cf_docs WHERE id = 'approval:live-commerce';

-- 2. Isolated approvals table, owned by the admin/approver — NOT by the app role.
CREATE TABLE IF NOT EXISTS cf_approvals (
  id         text PRIMARY KEY,
  approval   jsonb NOT NULL,           -- { payload, signature, alg }
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Separate writer role. Its credential lives only on the owner's offline
--    machine. LOGIN so it can be used as APPROVAL_DATABASE_URL by the signer.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cf_approver') THEN
    CREATE ROLE cf_approver LOGIN PASSWORD :'approver_password';
  END IF;
END
$$;

-- 4. The application/certification role: READ approvals to verify them, never
--    write. Revoke first so a prior blanket grant cannot linger.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cf_approvals FROM :app_role;
GRANT  SELECT ON cf_approvals TO :app_role;

-- 5. The approver role: write approvals, and read certification evidence so the
--    signer can bind the correct evidence id.
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_approvals TO cf_approver;
GRANT SELECT ON cf_docs TO cf_approver;

COMMIT;

-- Verify the lock (should FAIL with "permission denied for table cf_approvals"):
--   SET ROLE :app_role;
--   INSERT INTO cf_approvals (id, approval) VALUES ('x', '{}'::jsonb);
--   RESET ROLE;
--
-- Verify the read still works (should return 0 or 1 row, no error):
--   SET ROLE :app_role;
--   SELECT id FROM cf_approvals WHERE id = 'approval:live-commerce';
--   RESET ROLE;
