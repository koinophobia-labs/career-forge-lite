#!/usr/bin/env node
/**
 * Authorize live checkout for one exact commit. This is the human act.
 *
 * It does two things that only the release owner can do together:
 *   1. SIGNS a scoped approval with the offline Ed25519 private key.
 *   2. RECORDS the signed approval in the fulfillment store.
 *
 * The signature is what authorizes; the recording is just delivery. A recorded
 * row without a valid signature is rejected by the runtime, and a signature can
 * only be produced by the offline private key — so neither database access nor a
 * chosen actor name can substitute for running this command with the real key.
 *
 * Two credentials are required, and by design they live only on the owner's
 * machine — never in Vercel, the repo, or an agent environment:
 *   --private-key-file   the offline Ed25519 key from generate-approval-keypair
 *   APPROVAL_DATABASE_URL the offline APPROVER Postgres credential (never the
 *                         application DATABASE_URL, never KV)
 *
 * Writing goes through approver-store.ts, the only approval writer, which refuses
 * any non-Postgres URL and which the database rejects unless the connected role
 * holds write on cf_approvals. The application role is granted SELECT only, so a
 * leaked application DATABASE_URL cannot record an approval here.
 *
 * Usage:
 *   APPROVAL_DATABASE_URL=… node scripts/authorize-live-commerce.mjs \
 *     --private-key-file /secure/offline/cf-approval.key \
 *     --commit <deployed-sha> --host career-forge-lite.vercel.app \
 *     --environment production [--actor "Blake Taylor"]
 *
 * The evidence id is read from the recorded certification, not supplied, so the
 * approval can only bind to certification that actually exists. Refuses if the
 * certification does not match --commit, or if the payment surface changed.
 */

import { createRequire } from "node:module";
import { createPrivateKey, sign as edSign, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const nodeRequire = createRequire(import.meta.url);
const moduleCache = new Map();
function loadTs(relPath) {
  const absolute = path.resolve(root, relPath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loaded = { exports: {} };
  moduleCache.set(absolute, loaded);
  const localRequire = (spec) =>
    spec.startsWith("@/") ? loadTs(path.join("src", `${spec.slice(2)}.ts`)) : nodeRequire(spec);
  new Function("module", "exports", "require", "process", outputText)(loaded, loaded.exports, localRequire, process);
  return loaded.exports;
}

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const fail = (m) => {
  console.error(`\n✖ ${m}\n`);
  process.exit(2);
};

const commit = arg("commit");
const host = arg("host", "career-forge-lite.vercel.app");
const environment = arg("environment", "production");
const actor = arg("actor", "Blake Taylor");
const keyFile = arg("private-key-file");
if (!commit) fail("Pass --commit <sha> — the exact deployed commit being authorized.");
if (!keyFile) fail("Pass --private-key-file <path> — your offline Ed25519 approval key.");


let privateKey;
try {
  privateKey = createPrivateKey({ key: fs.readFileSync(keyFile, "utf8") });
} catch {
  fail(`Could not read a private key from ${keyFile}.`);
}
if (privateKey.asymmetricKeyType !== "ed25519") fail("The approval key must be Ed25519.");

// Approval writing goes ONLY through the Postgres-only approver store, with the
// offline approver credential. It refuses KV, memory, and the app DATABASE_URL.
const { approverConfigError, readApproverDoc, recordApproval } =
  loadTs("src/lib/server/approver-store.ts");
const configError = approverConfigError();
if (configError) fail(configError);

const { APPROVAL_RECORD_ID, CERTIFICATION_RECORD_ID, evidenceId, evaluateEvidence } =
  loadTs("src/lib/server/certification.ts");
const { CERTIFIED_SURFACE_HASH } = loadTs("src/lib/server/certified-surface-hash.ts");
const { canonicalApprovalMessage } = loadTs("src/lib/server/approval-crypto.ts");

const evidence = await readApproverDoc(CERTIFICATION_RECORD_ID);
if (!evidence) fail("No operational certification exists. Certify a real test purchase first.");
if (evidence.surfaceHash !== CERTIFIED_SURFACE_HASH)
  fail(`Certification covers surface ${evidence.surfaceHash}, this build is ${CERTIFIED_SURFACE_HASH}. Re-certify.`);
if (evidence.commitSha !== commit)
  fail(`Certification covers commit ${evidence.commitSha}, not ${commit}. Authorize the certified commit.`);

const verdict = evaluateEvidence(
  evidence,
  { commitSha: evidence.commitSha, environment: evidence.environment, host: evidence.host, surfaceHash: CERTIFIED_SURFACE_HASH },
  { allowedEnvironments: ["preview", "production", "development"], requireTestMode: true }
);
if (!verdict.valid) fail(`Certification is not valid: ${verdict.reasons.join(" ")}`);

const payload = {
  approvedCommitSha: commit,
  approvedSurfaceHash: CERTIFIED_SURFACE_HASH,
  approvedHost: host,
  approvedEnvironment: environment,
  evidenceId: evidenceId(evidence),
  approvalActor: actor,
  approvedAt: new Date().toISOString(),
  nonce: randomBytes(16).toString("hex"),
};
const signature = edSign(null, canonicalApprovalMessage(payload), privateKey).toString("base64");
const signed = { payload, signature, alg: "ed25519" };

// Written to cf_approvals through the approver store. If this were run with the
// app DATABASE_URL (SELECT-only on cf_approvals), Postgres rejects the insert.
await recordApproval(APPROVAL_RECORD_ID, signed);

console.log("\n✓ Live commerce authorized with a verified owner signature.\n");
console.log(`  commit    ${payload.approvedCommitSha}`);
console.log(`  surface   ${payload.approvedSurfaceHash}`);
console.log(`  host      ${payload.approvedHost}`);
console.log(`  evidence  ${payload.evidenceId}`);
console.log(`  actor     ${payload.approvalActor}  (informational only — the signature is the proof)`);
console.log("\nVerify: curl -s https://career-forge-lite.vercel.app/api/commerce-health\n");
