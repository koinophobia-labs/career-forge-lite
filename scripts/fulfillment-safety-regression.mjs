// Fulfillment-safety checks.
//
// These exist because an audit found that a customer could be charged $49 and
// receive nothing, silently: in live mode the app handed out a Stripe Payment
// Link and never learned the outcome, the webhook safety net 503'd because its
// secret was never provisioned, and no route logged or persisted anything.
//
// The second pass found a subtler version of the same mistake in the fix:
// checking that six environment variables contained text, and calling that
// "ready". Presence is not proof. These checks now enforce the distinction.
//
// Every check below answers one question: can this deployment take money it
// cannot deliver, or lose a paid customer without saying so?

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let passes = 0;
let failures = 0;
function check(label, condition) {
  if (condition) {
    passes += 1;
    console.log(`PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}`);
  }
}

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

const read = (relPath) => fs.readFileSync(path.join(root, relPath), "utf8");

const ORIGINAL_ENV = { ...process.env };
// MUST await the callback before restoring. An earlier version returned the
// promise from a sync try/finally, so env was torn down while the async body
// was still reading it — every async readiness check silently ran against a
// blank environment.
async function withEnv(vars, fn) {
  for (const key of Object.keys(process.env)) {
    if (/^(STRIPE_|LICENSE_|RESEND_|KV_|NEXT_PUBLIC_COMMERCE)/.test(key)) delete process.env[key];
  }
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, ORIGINAL_ENV);
  }
}

const ALL_CONFIG = {
  STRIPE_SECRET_KEY: "x",
  LICENSE_SIGNING_PRIVATE_KEY: "x",
  STRIPE_LIVE_RESET_PAYMENT_LINK: "https://buy.stripe.com/x",
  STRIPE_WEBHOOK_SECRET: "x",
  RESEND_API_KEY: "x",
  LICENSE_EMAIL_FROM: "x",
  KV_REST_API_URL: "https://kv.example",
  KV_REST_API_TOKEN: "x",
};

// --- Configuration readiness --------------------------------------------------------------------

await withEnv({ ...ALL_CONFIG, NEXT_PUBLIC_COMMERCE_MODE: "live" }, () => {
  const { configurationReadiness } = loadTs("src/lib/server/fulfillment-readiness.ts");
  check("fully configured deployment passes configuration readiness", configurationReadiness().ready === true);
});

for (const missing of Object.keys(ALL_CONFIG)) {
  const partial = { ...ALL_CONFIG, NEXT_PUBLIC_COMMERCE_MODE: "live" };
  delete partial[missing];
  await withEnv(partial, () => {
    const { configurationReadiness } = loadTs("src/lib/server/fulfillment-readiness.ts");
    const readiness = configurationReadiness();
    check(`missing ${missing} fails configuration readiness`, readiness.ready === false);
    check(
      `missing ${missing} states its customer consequence`,
      readiness.requirements.some((r) => !r.present && r.consequence.length > 20)
    );
  });
}

// --- THE CENTRAL RULE: configuration alone must never open checkout ------------------------------

await withEnv({ ...ALL_CONFIG, NEXT_PUBLIC_COMMERCE_MODE: "live" }, async () => {
  const { sellVerdict, configurationReadiness } = loadTs("src/lib/server/fulfillment-readiness.ts");
  const { MemoryFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");

  check("all env vars present => configuration ready", configurationReadiness().ready === true);

  // No store at all.
  const noStore = await sellVerdict(null);
  check("every env var set but no durable store => cannot sell", noStore.canSellSafely === false);
  check("the blocker names the missing store", noStore.blockers.some((b) => /durable/i.test(b)));

  // Durable-looking but in-memory: still refused.
  const memory = new MemoryFulfillmentStore();
  const memVerdict = await sellVerdict(memory);
  check("an in-memory store is not accepted as durable", memVerdict.canSellSafely === false);
  check(
    "the blocker says in-memory is not durable",
    memVerdict.blockers.some((b) => /in-memory|not durable/i.test(b))
  );
});

// A store that claims durability but has no recorded drill must still refuse.
await withEnv({ ...ALL_CONFIG, NEXT_PUBLIC_COMMERCE_MODE: "live" }, async () => {
  const { sellVerdict, DRILL_RECORD_ID } = loadTs("src/lib/server/fulfillment-readiness.ts");
  const { MemoryFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");

  // Delegate rather than subclass: `kind` is a readonly field on the class, so
  // a subclass cannot override it. This wrapper stands in for a real durable
  // backend without pretending to be one in production code.
  const inner = new MemoryFulfillmentStore();
  const store = {
    kind: "fake-durable",
    claim: (...a) => inner.claim(...a),
    get: (...a) => inner.get(...a),
    update: (...a) => inner.update(...a),
    listUnfulfilled: (...a) => inner.listUnfulfilled(...a),
    healthy: (...a) => inner.healthy(...a),
  };
  const noDrill = await sellVerdict(store);
  check("durable store without a recorded drill => cannot sell", noDrill.canSellSafely === false);
  check(
    "the blocker names the missing end-to-end demonstration",
    noDrill.blockers.some((b) => /test-mode journey|demonstrated/i.test(b))
  );

  // Record a completed drill: now, and only now, may it sell.
  await store.claim(DRILL_RECORD_ID, "evt_drill", { paymentStatus: "paid", tier: "reset" });
  await store.update(DRILL_RECORD_ID, {
    status: "email_sent",
    licenseMinted: true,
    emailSent: true,
  });
  const withDrill = await sellVerdict(store);
  check("durable store + recorded drill + full config => may sell", withDrill.canSellSafely === true);

  // An outstanding unfulfilled purchase re-closes it.
  await store.claim("cs_test_unfulfilled", "evt_x", { paymentStatus: "paid", tier: "reset" });
  const withOutstanding = await sellVerdict(store);
  check(
    "an unresolved paid-but-unfulfilled session re-closes checkout",
    withOutstanding.canSellSafely === false
  );
  check(
    "the blocker names the outstanding purchase",
    withOutstanding.blockers.some((b) => /unfulfilled/i.test(b))
  );
});

// Not live mode: never "unsafe", never sellable.
await withEnv({ NEXT_PUBLIC_COMMERCE_MODE: "off" }, async () => {
  const { liveCommerceUnsafe, sellVerdict } = loadTs("src/lib/server/fulfillment-readiness.ts");
  check("a non-live deployment is not flagged unsafe", (await liveCommerceUnsafe(null)) === false);
  check("a non-live deployment cannot sell", (await sellVerdict(null)).canSellSafely === false);
});

// The exact production shape the audit found.
await withEnv(
  {
    NEXT_PUBLIC_COMMERCE_MODE: "live",
    STRIPE_SECRET_KEY: "x",
    LICENSE_SIGNING_PRIVATE_KEY: "x",
    STRIPE_LIVE_RESET_PAYMENT_LINK: "https://buy.stripe.com/x",
  },
  async () => {
    const { liveCommerceUnsafe } = loadTs("src/lib/server/fulfillment-readiness.ts");
    check(
      "the audited production shape (link, no webhook, no email, no store) is unsafe",
      (await liveCommerceUnsafe(null)) === true
    );
  }
);

// --- Durable idempotency ------------------------------------------------------------------------

{
  const { MemoryFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");
  const store = new MemoryFulfillmentStore();

  const first = await store.claim("cs_1", "evt_1", { paymentStatus: "paid", tier: "reset" });
  check("first claim of a session wins", first.won === true);

  const second = await store.claim("cs_1", "evt_1_retry", { paymentStatus: "paid", tier: "reset" });
  check("a second claim of the same session loses", second.won === false);
  check("attempts are counted across retries", second.record.attempts === 2);
  check("the retry's event id is recorded", second.record.lastEventId === "evt_1_retry");

  await store.update("cs_1", { status: "license_minted", licenseMinted: true });
  const resumed = await store.get("cs_1");
  check("an interrupted fulfillment can be resumed", resumed.licenseMinted === true && resumed.emailSent === false);
  check("an incomplete session shows as unfulfilled", (await store.listUnfulfilled()).some((r) => r.sessionId === "cs_1"));

  await store.update("cs_1", { status: "email_sent", emailSent: true });
  check("a completed session drops off the unfulfilled list", (await store.listUnfulfilled()).every((r) => r.sessionId !== "cs_1"));

  const afterComplete = await store.claim("cs_1", "evt_1_late_retry", {});
  check("a late retry of a completed session does not win a new claim", afterComplete.won === false);
  check("the completed record still reports the email as sent", afterComplete.record.emailSent === true);

  check("record carries the required operational fields", (() => {
    const r = afterComplete.record;
    return ["sessionId","lastEventId","paymentStatus","tier","status","licenseMinted","emailSent","attempts","lastError","createdAt","updatedAt"].every((k) => k in r);
  })());
}

// The store must not become a second place to leak personal data.
{
  const storeSource = read("src/lib/server/fulfillment-store.ts");
  check(
    "the fulfillment record holds no personal data",
    !/\b(email|customerEmail|name|address|card|postal)\s*:/i.test(
      storeSource.slice(storeSource.indexOf("export type FulfillmentRecord"), storeSource.indexOf("export interface"))
    )
  );
  check("the store documents why personal data is absent", /Personal data/.test(storeSource));
  check("the atomic claim is documented", /NX/.test(storeSource));
}

// --- Route wiring -------------------------------------------------------------------------------

const checkoutRoute = read("src/app/api/checkout/route.ts");
check("checkout consults the full verdict, not just config", checkoutRoute.includes("sellVerdict()"));
check(
  "checkout refuses when it cannot sell safely",
  /!verdict\.canSellSafely[\s\S]{0,800}status:\s*503/.test(checkoutRoute)
);
check("checkout logs the refusal", checkoutRoute.includes('logCommerceEvent("checkout_blocked_unsafe"'));

const webhookRoute = read("src/app/api/stripe-webhook/route.ts");
check("webhook still verifies the Stripe signature", webhookRoute.includes("verifyStripeWebhookSignature"));
check("webhook logs rejected signatures", webhookRoute.includes('logCommerceEvent("webhook_rejected"'));
check("webhook claims the session durably", webhookRoute.includes("store.claim(session.id"));
check("webhook refuses when no durable store exists", /no_durable_fulfillment_store[\s\S]{0,300}status:\s*503/.test(webhookRoute));
check("webhook suppresses a duplicate using durable state", /record\.emailSent[\s\S]{0,300}duplicate: true/.test(webhookRoute));
check("webhook records the mint before emailing", /licenseMinted: true/.test(webhookRoute));
check("webhook records successful delivery", /emailSent: true/.test(webhookRoute));
check(
  "webhook returns 500 on email failure so Stripe retries",
  /fulfillment_email_failed[\s\S]{0,700}status:\s*500/.test(webhookRoute)
);
check("webhook no longer relies on in-memory dedupe", !webhookRoute.includes("markEventProcessed"));
check("the in-memory dedupe module is gone", !fs.existsSync(path.join(root, "src/lib/server/event-dedupe.ts")));
check("failures are categorised for reconciliation", /lastError:/.test(webhookRoute));
check(
  "a completed drill session records the operational proof",
  /cs_test_drill_[\s\S]{0,400}DRILL_RECORD_ID/.test(webhookRoute)
);
check("a drill script exists to produce that proof", fs.existsSync(path.join(root, "scripts/fulfillment-drill.mjs")));
check(
  "the drill names what it cannot prove",
  /cannot prove/i.test(read("scripts/fulfillment-drill.mjs"))
);

const licenseRoute = read("src/app/api/license/route.ts");
check("license route records successful mints", licenseRoute.includes('logCommerceEvent("license_minted"'));
check(
  "license route records a paid-but-unfulfillable session",
  licenseRoute.includes('logCommerceEvent("PAID_BUT_UNFULFILLED"')
);

// --- Health check must not leak secrets ----------------------------------------------------------

const healthRoute = read("src/app/api/commerce-health/route.ts");
check("health check reports the two gates separately", healthRoute.includes("configurationReady") && healthRoute.includes("operationalReady"));
check("health check reports canSellSafely", healthRoute.includes("canSellSafely"));
check(
  "health check never returns a secret value",
  !/process\.env\.[A-Z_]+/.test(healthRoute)
);

const readinessSource = read("src/lib/server/fulfillment-readiness.ts");
check(
  "readiness reports presence only, never values",
  readinessSource.includes("Boolean(process.env[name]?.trim())") && !readinessSource.includes("return process.env[")
);
check(
  "readiness documents that presence is not proof",
  /Presence is not proof|nowhere near\s*\n?\s*\*?\s*sufficient|not sufficient/i.test(readinessSource)
);

const logSource = read("src/lib/server/commerce-log.ts");
check("commerce log documents the no-PII rule", /NEVER log: email addresses/.test(logSource));

// --- Purchase CTA -------------------------------------------------------------------------------

const pricingPage = read("src/app/pricing/page.tsx");
check("pricing page asks whether it may sell", pricingPage.includes("/api/commerce-health"));
check("pricing page closes checkout when unsafe", pricingPage.includes("checkoutClosed"));
check(
  "an unsafe deployment shows a contact CTA instead of a buy button",
  /checkoutClosed \?[\s\S]{0,900}mailto:/.test(pricingPage)
);
check("checkout cannot be started while closed", /if \(checkoutClosed\) return;/.test(pricingPage));
check("the CTA defaults to closed before readiness is known", pricingPage.includes("canSellSafely !== true"));
check(
  "the header does not advertise an open paid beta while closed",
  /checkoutClosed[\s\S]{0,200}Checkout closed/.test(pricingPage)
);

// --- Recovery procedure -------------------------------------------------------------------------

check("a manual recovery runbook exists", fs.existsSync(path.join(root, "docs/RECOVERY.md")));
const recovery = read("docs/RECOVERY.md");
check("runbook explains how to find unfulfilled purchases", recovery.includes("PAID_BUT_UNFULFILLED"));
check("runbook covers manual license minting", recovery.includes("mint-license"));
check("runbook covers refunds", /refund/i.test(recovery));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
