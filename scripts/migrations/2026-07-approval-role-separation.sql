-- Approval role separation — REQUIRED before this build can authorize checkout.
--
-- Run once, with a Neon ADMIN/owner credential (not the application DATABASE_URL
-- and not any agent environment):
--
--   psql "<admin connection string>" \
--     -v app_role=<the role the app DATABASE_URL connects as> \
--     -f scripts/migrations/2026-07-approval-role-separation.sql
--
-- The approver role is NOT created here and its password is NEVER in this file.
-- Create it out of band first (Neon console or a separate admin session), give
-- it a strong password, and keep that credential only on the owner's offline
-- machine as APPROVAL_DATABASE_URL:
--
--   CREATE ROLE cf_approver LOGIN PASSWORD '<set in a secure channel, not here>';
--
-- This migration then: creates the isolated approvals table, removes the legacy
-- plaintext approval, grants the app role SELECT only, and grants the (already
-- existing) approver role write. Re-running it is safe (idempotent).
--
-- Identifiers are interpolated with psql's identifier-quoting form :"app_role",
-- so a role name is always safely quoted. No literal is interpolated inside a
-- dollar-quoted block (that would not be substituted).

\set ON_ERROR_STOP on

BEGIN;

-- 0. The approver role must already exist. Fail loudly (not silently) if not.
--    'cf_approver' is a fixed identifier here, so no interpolation is needed.
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cf_approver') THEN
    RAISE EXCEPTION
      'Role cf_approver does not exist. Create it out of band first: CREATE ROLE cf_approver LOGIN PASSWORD ''...'';';
  END IF;
END
$check$;

-- 1. Remove the legacy plaintext approval path. Approvals no longer live in
--    cf_docs. Idempotent. (Containment note: if the unauthorized 2026-07-21 row
--    was not already deleted, this removes it — prefer running the standalone
--    DELETE ... RETURNING id, doc first so the record is preserved.)
DELETE FROM cf_docs WHERE id = 'approval:live-commerce';

-- 2. Isolated approvals table, owned by the admin/approver — NOT the app role.
CREATE TABLE IF NOT EXISTS cf_approvals (
  id         text PRIMARY KEY,
  approval   jsonb NOT NULL,           -- { payload, signature, alg }
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. The application/certification role: READ approvals to verify them, never
--    write. Revoke first so any prior blanket grant cannot linger (idempotent).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cf_approvals FROM :"app_role";
GRANT  SELECT ON cf_approvals TO :"app_role";

-- 4. The approver role: write approvals, and read certification evidence so the
--    offline signer can bind the correct evidence id.
GRANT SELECT, INSERT, UPDATE, DELETE ON cf_approvals TO cf_approver;
GRANT SELECT ON cf_docs TO cf_approver;

COMMIT;

-- Verify the write lock (run manually; should FAIL "permission denied"):
--   SET ROLE :"app_role";
--   INSERT INTO cf_approvals (id, approval) VALUES ('x', '{}'::jsonb);
--   RESET ROLE;
--
-- Verify the read still works (should succeed with 0/1 rows):
--   SET ROLE :"app_role";
--   SELECT id FROM cf_approvals WHERE id = 'approval:live-commerce';
--   RESET ROLE;
