#!/usr/bin/env node
/**
 * Adversarial proof that database write access can no longer impersonate the
 * release owner. Each case models an attacker who has MORE than the 2026-07-21
 * attacker had, and shows the gate still refuses.
 *
 * The twelve required cases:
 *   1  application role inserts an approval
 *   2  certification role inserts an approval
 *   3  forged actor name
 *   4  approval copied onto another commit
 *   5  approval copied onto another surface hash
 *   6  stale certification
 *   7  direct SQL bypass (raw row, the exact incident)
 *   8  leaked application DATABASE_URL
 *   9  approval created without the owner's private signing key
 *  10  deployment after approval (new SHA)
 *  11  revoked approval
 *  12  credential rotation (owner key rotated; old signatures die)
 *
 * All twelve reduce to one property: only a signature from the owner's private
 * key authorizes, and holding a database connection is not holding that key.
 */

import { createRequire } from "node:module";
import { generateKeyPairSync, sign as edSign, randomBytes } from "node:crypto";
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

let passed = 0;
let failed = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) passed += 1;
  else failed += 1;
};

const { evaluateApproval, evidenceId, DRILL_VERSION } = loadTs("src/lib/server/certification.ts");
const { canonicalApprovalMessage, loadApprovalPublicKey } = loadTs("src/lib/server/approval-crypto.ts");
const { CERTIFIED_SURFACE_HASH } = loadTs("src/lib/server/certified-surface-hash.ts");

// The genuine release owner's key exists only here, in this test process.
const owner = generateKeyPairSync("ed25519");
const ownerPublicKey = owner.publicKey;

const current = {
  commitSha: "28d3def1ef5f680e1ec9c029b0178c62a3311619",
  environment: "production",
  host: "career-forge-lite.vercel.app",
  surfaceHash: CERTIFIED_SURFACE_HASH,
};

const evidence = {
  drillVersion: DRILL_VERSION,
  commitSha: current.commitSha,
  surfaceHash: CERTIFIED_SURFACE_HASH,
  environment: current.environment,
  host: current.host,
  stripeMode: "test",
  stripeAccountId: "acct_test",
  checkoutSessionId: "cs_test_real",
  stripeEventId: "evt_real",
  priceId: "price_reset",
  tier: "reset",
  emailProviderMessageId: "msg_1",
  fulfillmentStoreKind: "neon-postgres",
  fulfillmentAttempts: 2,
  licenseTierVerified: "reset",
  redemptionTierVerified: "reset",
  successRouteStatus: 200,
  cancellationRouteStatus: 200,
  completedAt: "2026-07-21T20:51:11.000Z",
};

const basePayload = (over = {}) => ({
  approvedCommitSha: current.commitSha,
  approvedSurfaceHash: CERTIFIED_SURFACE_HASH,
  approvedHost: current.host,
  approvedEnvironment: current.environment,
  evidenceId: evidenceId(evidence),
  approvalActor: "Blake Taylor",
  approvedAt: "2026-07-21T21:17:47.000Z",
  nonce: randomBytes(8).toString("hex"),
  ...over,
});
const signWith = (privateKey, payload) => ({
  payload,
  signature: edSign(null, canonicalApprovalMessage(payload), privateKey).toString("base64"),
  alg: "ed25519",
});
const ownerSigned = (over) => signWith(owner.privateKey, basePayload(over));

// Sanity: a genuine owner-signed approval for this deployment IS accepted, so
// the refusals below are about the attack, not a gate that rejects everything.
check("baseline: a genuine owner-signed approval is accepted", evaluateApproval(ownerSigned(), evidence, current, ownerPublicKey).valid === true);

// 1. Application role inserts an approval. It has a DB connection and can write
//    a plausible row — but cannot sign. Model: unsigned row.
{
  const row = { payload: basePayload(), signature: "", alg: "ed25519" };
  const v = evaluateApproval(row, evidence, current, ownerPublicKey);
  check("1. application-role insert (unsigned) is rejected", v.valid === false);
}

// 2. Certification role inserts an approval. Same power, same lack of a signing
//    key. It signs with a DIFFERENT key it does control.
{
  const attacker = generateKeyPairSync("ed25519");
  const v = evaluateApproval(signWith(attacker.privateKey, basePayload()), evidence, current, ownerPublicKey);
  check("2. certification-role insert (attacker-signed) is rejected", v.valid === false);
}

// 3. Forged actor name. Claiming to be Blake proves nothing without a signature.
{
  const attacker = generateKeyPairSync("ed25519");
  const v = evaluateApproval(
    signWith(attacker.privateKey, basePayload({ approvalActor: "Blake Taylor" })),
    evidence,
    current,
    ownerPublicKey
  );
  check("3. a forged 'Blake Taylor' actor is not authorization", v.valid === false);
}

// 4. A real owner-signed approval, copied onto another commit. The commit is
//    inside the signed bytes, so changing it breaks the signature; keeping it
//    fails the commit binding. Either way, refused on the other deployment.
{
  const genuine = ownerSigned(); // signed for current.commitSha
  const otherDeployment = { ...current, commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
  const v = evaluateApproval(genuine, evidence, otherDeployment, ownerPublicKey);
  check("4. a genuine approval copied onto another commit is rejected", v.valid === false);
}

// 5. Copied onto another surface hash (payment code changed under it).
{
  const genuine = ownerSigned();
  const changedSurface = { ...current, surfaceHash: "ffffffffffffffffffffffffffffffff" };
  const v = evaluateApproval(genuine, evidence, changedSurface, ownerPublicKey);
  check("5. a genuine approval against a changed surface hash is rejected", v.valid === false);
}

// 6. Stale certification: approval binds evidence that no longer matches.
{
  const staleEvidence = { ...evidence, checkoutSessionId: "cs_test_stale", stripeEventId: "evt_stale" };
  // Owner signs against the ORIGINAL evidence id; deployment now records stale evidence.
  const v = evaluateApproval(ownerSigned(), staleEvidence, current, ownerPublicKey);
  check("6. approval bound to superseded certification is rejected", v.valid === false);
}

// 7. Direct SQL bypass — the exact 2026-07-21 incident: a plaintext legacy row
//    with an actor string and self-declared fields, no signature envelope.
{
  const legacyRow = {
    approvedCommitSha: current.commitSha,
    approvedEnvironment: current.environment,
    approvalActor: "Blake Taylor",
    evidenceId: evidenceId(evidence),
    approvedAt: "2026-07-21T21:17:47.704182+00:00",
  };
  const v = evaluateApproval(legacyRow, evidence, current, ownerPublicKey);
  check("7. the exact incident (raw plaintext SQL row) is rejected", v.valid === false);
}

// 8. Leaked application DATABASE_URL: attacker can write ANY row they like, and
//    even replay a previously valid signed approval's bytes. Without the commit
//    they target matching, or without a signature at all, it fails. Here they
//    craft a fresh row and sign with a stolen-but-wrong key.
{
  const leaked = generateKeyPairSync("ed25519");
  const v = evaluateApproval(signWith(leaked.privateKey, basePayload()), evidence, current, ownerPublicKey);
  check("8. a leaked DATABASE_URL cannot mint authorization", v.valid === false);
}

// 9. Approval created without the owner's private key — tampered payload under a
//    genuine signature (flip the actor after signing; signature no longer covers it).
{
  const genuine = ownerSigned();
  const tampered = { ...genuine, payload: { ...genuine.payload, approvedCommitSha: "tampered000000" } };
  const v = evaluateApproval(tampered, evidence, current, ownerPublicKey);
  check("9. a payload tampered after signing is rejected", v.valid === false);
}

// 10. Deployment after approval: a valid approval for the old commit does not
//     authorize the newly deployed SHA.
{
  const genuine = ownerSigned(); // for current.commitSha
  const afterDeploy = { ...current, commitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" };
  const v = evaluateApproval(genuine, evidence, afterDeploy, ownerPublicKey);
  check("10. a new deployment (new SHA) invalidates the prior approval", v.valid === false);
}

// 11. Revoked approval: removing the record closes the shop; nothing to verify.
{
  const v = evaluateApproval(null, evidence, current, ownerPublicKey);
  check("11. a revoked/removed approval closes checkout", v.valid === false);
}

// 12. Credential rotation: the owner rotates to a new keypair (public key in the
//     build changes). Approvals signed by the OLD key must stop verifying.
{
  const rotated = generateKeyPairSync("ed25519");
  const v = evaluateApproval(ownerSigned(), evidence, current, rotated.publicKey);
  check("12. after key rotation, old-key approvals no longer verify", v.valid === false);
}

// Fail-closed trust root: the committed placeholder public key is empty, so a
// deployment with no installed key can never open checkout.
{
  const { APPROVAL_PUBLIC_KEY_SPKI_BASE64 } = loadTs("src/lib/server/approval-public-key.ts");
  const key = loadApprovalPublicKey(APPROVAL_PUBLIC_KEY_SPKI_BASE64);
  check("committed trust root is empty → fails closed until the owner installs it", key === null);
  const v = evaluateApproval(ownerSigned(), evidence, current, key);
  check("with no installed key, even a genuine signature cannot open checkout", v.valid === false);
}

// Role separation (defense in depth): approvals live in their own namespace,
// which the payment path cannot reach. A write to the document namespace — the
// only thing the app role can do — is invisible to the gate that reads approvals.
{
  const { MemoryFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");
  const store = new MemoryFulfillmentStore();
  const legacyPlaintext = {
    approvedCommitSha: current.commitSha,
    approvedEnvironment: current.environment,
    approvalActor: "Blake Taylor",
    evidenceId: evidenceId(evidence),
    approvedAt: "2026-07-21T21:17:47.704182+00:00",
  };
  // The exact incident write — into the app-writable document namespace.
  await store.putDoc("approval:live-commerce", legacyPlaintext);
  const seenByGate = await store.getApproval("approval:live-commerce");
  check("a doc-namespace write is not visible to the approvals reader", seenByGate === null);

  // Even placed directly in the approvals namespace, an unsigned row is refused.
  await store.putApproval("approval:live-commerce", legacyPlaintext);
  const stored = await store.getApproval("approval:live-commerce");
  check("13. a plaintext row in the approvals table is rejected (unsigned)", evaluateApproval(stored, evidence, current, ownerPublicKey).valid === false);

  // A genuine owner signature in the approvals namespace still works.
  await store.putApproval("approval:live-commerce", ownerSigned());
  const good = await store.getApproval("approval:live-commerce");
  check("a genuine signed approval in the approvals table is accepted", evaluateApproval(good, evidence, current, ownerPublicKey).valid === true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
