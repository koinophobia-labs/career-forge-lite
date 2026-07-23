#!/usr/bin/env bash
# Proves scripts/migrations/2026-07-approval-role-separation.sql against a REAL,
# disposable Postgres cluster: the app role gets SELECT only on cf_approvals and
# is denied every write; the approver role can write; the migration is idempotent
# and refuses to run without the approver role. No credentials are used or printed
# (trust auth over a private unix socket; roles have no passwords).
#
#   bash scripts/approval-migration-smoke.sh
#
# Requires: initdb, pg_ctl, psql on PATH. Exits non-zero on any failed assertion.
set -euo pipefail
export LC_ALL=C LANG=C   # macOS Postgres refuses to start under some locales

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG="$HERE/scripts/migrations/2026-07-approval-role-separation.sql"
WORK="$(mktemp -d)"
PGDATA="$WORK/data"
SOCK="$WORK/sock"
mkdir -p "$SOCK"
mkdir -p "$PGDATA"

pass=0; fail=0
ok()   { echo "PASS  $1"; pass=$((pass+1)); }
bad()  { echo "FAIL  $1"; fail=$((fail+1)); }

cleanup() {
  pg_ctl -D "$PGDATA" -s -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "== init disposable cluster =="
initdb -D "$PGDATA" -U admin --auth=trust >/dev/null 2>&1
pg_ctl -D "$PGDATA" -o "-k $SOCK -h ''" -w -s start >/dev/null 2>&1
PSQL="psql -v ON_ERROR_STOP=1 -h $SOCK -U admin -d postgres -qtA"

# Assert a SQL statement SUCCEEDS.
sql_ok() { local label="$1"; shift; if $PSQL -c "$1" >/dev/null 2>"$WORK/err"; then ok "$label"; else bad "$label ($(tr -d '\n' <"$WORK/err"))"; fi; }
# Assert a SQL statement FAILS with "permission denied".
denied() { local label="$1"; shift; if $PSQL -c "$1" >/dev/null 2>"$WORK/err"; then bad "$label (unexpectedly succeeded)"; elif grep -qi "permission denied" "$WORK/err"; then ok "$label"; else bad "$label (failed, but not permission denied: $(tr -d '\n' <"$WORK/err"))"; fi; }
# Assert a SQL statement FAILS containing a given phrase.
fails_with() { local label="$1" phrase="$2"; shift 2; if $PSQL -c "$1" >/dev/null 2>"$WORK/err"; then bad "$label (unexpectedly succeeded)"; elif grep -qi "$phrase" "$WORK/err"; then ok "$label"; else bad "$label (missing phrase '$phrase': $(tr -d '\n' <"$WORK/err"))"; fi; }

echo "== base schema owned by admin; realistic app role with normal grants =="
$PSQL -c "CREATE ROLE app_role LOGIN NOSUPERUSER;" >/dev/null
$PSQL -c "CREATE TABLE cf_docs (id text PRIMARY KEY, doc jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());" >/dev/null
$PSQL -c "CREATE TABLE cf_fulfillment (session_id text PRIMARY KEY);" >/dev/null
$PSQL -c "GRANT SELECT, INSERT, UPDATE, DELETE ON cf_docs, cf_fulfillment TO app_role;" >/dev/null
$PSQL -c "INSERT INTO cf_docs (id, doc) VALUES ('certification:operational', '{\"ok\":true}'::jsonb);" >/dev/null

echo "== the migration REFUSES to run without the approver role =="
if psql -v ON_ERROR_STOP=1 -h "$SOCK" -U admin -d postgres -v app_role=app_role -f "$MIG" >/dev/null 2>"$WORK/err"; then
  bad "migration should have refused without cf_approver"
elif grep -qi "cf_approver does not exist" "$WORK/err"; then
  ok "migration guard: refuses to run until cf_approver is created out of band"
else
  bad "migration failed for the wrong reason: $(tr -d '\n' <"$WORK/err")"
fi

echo "== create the approver role out of band (no password needed on trust socket) =="
$PSQL -c "CREATE ROLE cf_approver LOGIN NOSUPERUSER;" >/dev/null

echo "== run the migration =="
if psql -v ON_ERROR_STOP=1 -h "$SOCK" -U admin -d postgres -v app_role=app_role -f "$MIG" >/dev/null 2>"$WORK/err"; then
  ok "migration applies cleanly"
else
  bad "migration failed: $(tr -d '\n' <"$WORK/err")"
fi

echo "== app role: SELECT allowed, every write DENIED =="
sql_ok  "app role can SELECT cf_approvals" "SET ROLE app_role; SELECT id FROM cf_approvals;"
denied  "app role INSERT denied"   "SET ROLE app_role; INSERT INTO cf_approvals (id, approval) VALUES ('approval:live-commerce','{}'::jsonb);"
denied  "app role UPDATE denied"   "SET ROLE app_role; UPDATE cf_approvals SET approval='{}'::jsonb WHERE id='x';"
denied  "app role DELETE denied"   "SET ROLE app_role; DELETE FROM cf_approvals WHERE id='x';"
denied  "app role TRUNCATE denied" "SET ROLE app_role; TRUNCATE cf_approvals;"

echo "== approver role: write ALLOWED =="
sql_ok "approver role can INSERT a signed approval" \
  "SET ROLE cf_approver; INSERT INTO cf_approvals (id, approval) VALUES ('approval:live-commerce','{\"payload\":{},\"signature\":\"sig\",\"alg\":\"ed25519\"}'::jsonb);"
sql_ok "approver role can read certification evidence from cf_docs" \
  "SET ROLE cf_approver; SELECT id FROM cf_docs WHERE id='certification:operational';"

echo "== idempotency: re-running the migration is safe =="
if psql -v ON_ERROR_STOP=1 -h "$SOCK" -U admin -d postgres -v app_role=app_role -f "$MIG" >/dev/null 2>"$WORK/err"; then
  ok "migration re-run is idempotent"
else
  bad "migration re-run failed: $(tr -d '\n' <"$WORK/err")"
fi
# The approver row must survive the idempotent re-run (migration does not clear cf_approvals).
CNT="$($PSQL -c "SELECT count(*) FROM cf_approvals WHERE id='approval:live-commerce';")"
[ "$CNT" = "1" ] && ok "re-run preserves the approvals table" || bad "re-run altered cf_approvals (count=$CNT)"

echo "== fail-closed: without cf_approvals, a read errors (app getApproval catches → null) =="
$PSQL -c "DROP TABLE cf_approvals;" >/dev/null
fails_with "missing cf_approvals table makes the read error (→ fail closed in app)" "does not exist" \
  "SET ROLE app_role; SELECT id FROM cf_approvals;"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
