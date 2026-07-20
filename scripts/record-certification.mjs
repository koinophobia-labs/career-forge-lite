#!/usr/bin/env node
/**
 * Record operational certification after a REAL Stripe test-mode purchase.
 *
 * This is the deployment-owned recorder that was missing: certify-fulfillment
 * verifies a journey but deliberately writes nothing, so proof never landed
 * anywhere the readiness gate could read it.
 *
 * It writes evidence ONLY after re-verifying, against Stripe's API, that:
 *   - the Checkout Session exists in the account the key belongs to
 *   - it is test mode (livemode false)
 *   - payment_status is "paid"
 *   - the line item's price id maps to a known Career Forge package
 *   - the paid amount matches that package
 *   - the durable store already recorded fulfillment as complete
 *
 * A fabricated session id fails at the first check, because Stripe is asked
 * rather than told. There is no flag to skip verification.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... DATABASE_URL=... \
 *   node scripts/record-certification.mjs --session cs_test_... --event evt_...
 *
 * Refuses live keys and refuses to run against the production hostname.
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

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(2);
};

/* ------------------------------------------------------------ hard guards */

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) fail("STRIPE_SECRET_KEY is not set. A test-mode key (sk_test_…) is required.");
if (!secret.includes("_test_")) {
  fail(
    "Refusing to run: STRIPE_SECRET_KEY is not a test-mode key. Certification never runs against live money."
  );
}
if ((process.env.VERCEL_ENV || "").trim() === "production") {
  fail("Refusing to run in the production environment. Certify a preview, then approve production.");
}

const sessionId = arg("session");
const eventId = arg("event");
if (!sessionId) fail("Pass --session cs_test_… (the id of a Checkout Session you actually paid).");

/* ------------------------------------------------------------ verification */

const stripe = async (endpoint) => {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json();
  if (!res.ok) fail(`Stripe rejected ${endpoint}: ${body?.error?.message ?? res.status}`);
  return body;
};

console.log("Asking Stripe about the session (not trusting the caller)…");
const session = await stripe(
  `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`
);

if (session.livemode === true) fail("That session is live mode. Certification requires test mode.");
if (session.payment_status !== "paid") {
  fail(`Session payment_status is "${session.payment_status}", not "paid".`);
}

const { tierForPriceId } = loadTs("src/lib/server/session-verification.ts");
const { getPackage } = loadTs("src/lib/packages.ts");

const priceId = session.line_items?.data?.[0]?.price?.id ?? null;
const tier = tierForPriceId(priceId);
if (!tier) {
  fail(
    `Price ${priceId ?? "(none)"} is not a known Career Forge package. Set STRIPE_PRICE_RESET to the price you sold.`
  );
}

const pack = getPackage(tier);
const expected = pack.priceUsd * 100;
if (session.amount_total !== expected) {
  fail(`Amount ${session.amount_total} does not match ${pack.name} (${expected}).`);
}
if ((session.currency || "").toLowerCase() !== "usd") {
  fail(`Currency ${session.currency} is not usd.`);
}

const account = await stripe("/account");

/* ------------------------------------- the store must already show delivery */

const { getFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");
const store = getFulfillmentStore();
if (!store) fail("No durable store configured. Set DATABASE_URL (or KV_REST_API_*) and retry.");
if (store.kind === "memory") fail("The configured store is in-memory and cannot certify anything.");

const record = await store.get(sessionId);
if (!record) {
  fail(
    "The durable store has no record of that session. The webhook never fulfilled it — fix delivery before certifying."
  );
}
if (!record.licenseMinted) fail("The store says no license was minted for that session.");
if (!record.emailSent) fail("The store says the fulfillment email was never sent.");

/* -------------------------------------------------------------- write it */

const { DRILL_VERSION, CERTIFICATION_RECORD_ID, deploymentIdentity } = loadTs(
  "src/lib/server/certification.ts"
);
const { CERTIFIED_SURFACE_HASH } = loadTs("src/lib/server/certified-surface-hash.ts");

const identity = deploymentIdentity();
const evidence = {
  drillVersion: DRILL_VERSION,
  commitSha: identity.commitSha,
  surfaceHash: CERTIFIED_SURFACE_HASH,
  environment: identity.environment,
  host: identity.host,
  stripeMode: "test",
  stripeAccountId: account.id,
  checkoutSessionId: session.id,
  stripeEventId: eventId ?? record.lastEventId ?? null,
  priceId,
  tier,
  emailProviderMessageId: record.emailMessageId ?? "recorded-by-webhook",
  completedAt: new Date().toISOString(),
};

await store.putDoc(CERTIFICATION_RECORD_ID, evidence);

// Deliberately prints no secret and no customer identity.
console.log("\n✓ Operational certification recorded.\n");
console.log(`  commit      ${evidence.commitSha}`);
console.log(`  environment ${evidence.environment}`);
console.log(`  host        ${evidence.host}`);
console.log(`  stripe      ${evidence.stripeAccountId} (test mode)`);
console.log(`  price       ${evidence.priceId} -> ${evidence.tier}`);
console.log(`  session     ${evidence.checkoutSessionId}`);
console.log(`  surface     ${evidence.surfaceHash}`);
console.log(
  "\nThis does NOT open live checkout. Blake must approve the production commit:\n" +
    "  node scripts/approve-live-commerce.mjs --commit <sha> --environment production\n"
);
