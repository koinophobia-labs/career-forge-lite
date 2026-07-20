#!/usr/bin/env node
/**
 * Record Blake's authorization to open live checkout for one specific commit.
 *
 * Technical readiness does not open a shop. This is the separate, human act.
 *
 * It refuses unless valid operational certification already exists for the
 * surface being approved — you cannot authorize a deployment that has never
 * demonstrated it can deliver. And the approval is pinned to a commit SHA and
 * surface hash, so touching any file in the payment path invalidates it and
 * checkout re-closes on the next deploy.
 *
 * Usage:
 *   DATABASE_URL=… node scripts/approve-live-commerce.mjs \
 *     --commit <sha> --environment production --actor "Blake Taylor"
 */

import { createRequire } from "node:module";
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
  new Function("module", "exports", "require", "process", outputText)(
    loaded,
    loaded.exports,
    localRequire,
    process
  );
  return loaded.exports;
}

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(2);
};

const commitSha = arg("commit");
const environment = arg("environment", "production");
const actor = arg("actor", "Blake Taylor");
if (!commitSha) fail("Pass --commit <sha> — the exact deployed commit being approved.");

const { getFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");
const store = getFulfillmentStore();
if (!store) fail("No durable store configured. Set DATABASE_URL and retry.");
if (store.kind === "memory") fail("An in-memory store cannot hold an approval.");

const {
  APPROVAL_RECORD_ID,
  CERTIFICATION_RECORD_ID,
  evidenceId,
  evaluateEvidence,
} = loadTs("src/lib/server/certification.ts");
const { CERTIFIED_SURFACE_HASH } = loadTs("src/lib/server/certified-surface-hash.ts");

const evidence = await store.getDoc(CERTIFICATION_RECORD_ID);
if (!evidence) {
  fail(
    "No operational certification exists. Run a real Stripe test-mode purchase and record it first:\n" +
      "  node scripts/record-certification.mjs --session cs_test_…"
  );
}

// The surface being approved must be the surface that was certified.
if (evidence.surfaceHash !== CERTIFIED_SURFACE_HASH) {
  fail(
    `Certification covers surface ${evidence.surfaceHash}, but this build is ${CERTIFIED_SURFACE_HASH}.\n` +
      "The payment path changed since it was proven. Re-certify before approving."
  );
}

const verdict = evaluateEvidence(
  evidence,
  { commitSha: evidence.commitSha, environment: evidence.environment, host: evidence.host, surfaceHash: CERTIFIED_SURFACE_HASH },
  { allowedEnvironments: ["preview", "production", "development"], requireTestMode: true }
);
if (!verdict.valid) fail(`Certification is not valid: ${verdict.reasons.join(" ")}`);

const approval = {
  commitSha,
  environment,
  actor,
  evidenceId: evidenceId(evidence),
  surfaceHash: CERTIFIED_SURFACE_HASH,
  approvedAt: new Date().toISOString(),
  statement:
    "Reopen Career Forge paid checkout after the complete test-mode payment and fulfillment journey passes.",
};

await store.putDoc(APPROVAL_RECORD_ID, approval);

console.log("\n✓ Live commerce approved.\n");
console.log(`  commit      ${approval.commitSha}`);
console.log(`  environment ${approval.environment}`);
console.log(`  actor       ${approval.actor}`);
console.log(`  evidence    ${approval.evidenceId}`);
console.log(`  surface     ${approval.surfaceHash}`);
console.log("\nVerify: curl -s https://career-forge-lite.vercel.app/api/commerce-health\n");
