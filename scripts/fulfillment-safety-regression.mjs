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
  STRIPE_PRICE_RESET: "price_test_reset",
  STRIPE_WEBHOOK_SECRET: "x",
  RESEND_API_KEY: "x",
  LICENSE_EMAIL_FROM: "x",
  LICENSE_EMAIL_REPLY_TO: "x",
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

// --- THE SELF-CERTIFICATION LOOPHOLE ------------------------------------------------------------
// A fabricated event, a chosen session id, or a leaked webhook secret must never
// be able to certify a deployment.

await withEnv({ ...ALL_CONFIG, NEXT_PUBLIC_COMMERCE_MODE: "live" }, async () => {
  const { sellVerdict } = loadTs("src/lib/server/fulfillment-readiness.ts");
  const { MemoryFulfillmentStore } = loadTs("src/lib/server/fulfillment-store.ts");
  const {
    CERTIFICATION_RECORD_ID,
    APPROVAL_RECORD_ID,
    DRILL_VERSION,
    evidenceId,
  } = loadTs("src/lib/server/certification.ts");
  const { CERTIFIED_SURFACE_HASH } = loadTs("src/lib/server/certified-surface-hash.ts");

  const durable = (inner) => ({
    kind: "fake-durable",
    claim: (...a) => inner.claim(...a),
    get: (...a) => inner.get(...a),
    update: (...a) => inner.update(...a),
    listUnfulfilled: (...a) => inner.listUnfulfilled(...a),
    getDoc: (...a) => inner.getDoc(...a),
    putDoc: (...a) => inner.putDoc(...a),
    healthy: (...a) => inner.healthy(...a),
  });

  const identity = { commitSha: "abc123def456", environment: "preview", host: "preview.example" };
  process.env.VERCEL_GIT_COMMIT_SHA = identity.commitSha;
  process.env.VERCEL_ENV = identity.environment;
  process.env.VERCEL_URL = identity.host;

  const goodEvidence = {
    drillVersion: DRILL_VERSION,
    commitSha: identity.commitSha,
    surfaceHash: CERTIFIED_SURFACE_HASH,
    environment: identity.environment,
    host: identity.host,
    stripeMode: "test",
    stripeAccountId: "acct_test",
    checkoutSessionId: "cs_test_real_123",
    stripeEventId: "evt_real_123",
    priceId: "price_reset",
    tier: "reset",
    emailProviderMessageId: "msg_123",
    fulfillmentStoreKind: "neon-postgres",
    fulfillmentAttempts: 2,
    licenseTierVerified: "reset",
    successRouteStatus: 200,
    cancellationRouteStatus: 200,
    completedAt: "2026-07-20T12:00:00.000Z",
  };

  // 1. The old loophole: a session id the caller chose.
  {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    await store.claim("cs_test_drill_anything", "evt_forged", { paymentStatus: "paid", tier: "reset" });
    await store.update("cs_test_drill_anything", { status: "email_sent", licenseMinted: true, emailSent: true });
    const v = await sellVerdict(store);
    check("a caller-chosen cs_test_drill_* id has no certifying authority", v.canSellSafely === false);
    check(
      "the blocker names missing certification, not the fake session",
      v.blockers.some((b) => /certification evidence/i.test(b))
    );
  }

  // 2. Certification present but no human approval.
  {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    await store.putDoc(CERTIFICATION_RECORD_ID, goodEvidence);
    const v = await sellVerdict(store);
    check("technical readiness without approval keeps checkout closed", v.canSellSafely === false);
    check(
      "the blocker says a human must authorize",
      v.blockers.some((b) => /has not been authorized/i.test(b))
    );
  }

  // 3. Evidence + approval for the CURRENT commit: the only passing case.
  {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    await store.putDoc(CERTIFICATION_RECORD_ID, goodEvidence);
    await store.putDoc(APPROVAL_RECORD_ID, {
      approvedCommitSha: identity.commitSha,
      approvedEnvironment: identity.environment,
      approvalActor: "blake",
      evidenceId: evidenceId(goodEvidence),
      approvedAt: "2026-07-20T12:05:00.000Z",
    });
    const v = await sellVerdict(store);
    check("Stripe-verified evidence + matching approval may sell", v.canSellSafely === true);
  }

  // 4. Every way evidence can be stale or foreign.
  const approvalFor = (ev) => ({
    approvedCommitSha: identity.commitSha,
    approvedEnvironment: identity.environment,
    approvalActor: "blake",
    evidenceId: evidenceId(ev),
    approvedAt: "2026-07-20T12:05:00.000Z",
  });

  const mutations = [
    ["evidence from an older commit fails", { commitSha: "999999999999" }, /certifies commit/i],
    ["evidence from a different host fails", { host: "other.example" }, /not "preview.example"/i],
    ["evidence from an unapproved environment fails", { environment: "rogue" }, /not approved to certify/i],
    ["live-mode evidence fails test certification", { stripeMode: "live" }, /test mode/i],
    ["evidence with a changed code surface fails", { surfaceHash: "deadbeef" }, /code changed since certification/i],
    ["evidence without a real Stripe session fails", { checkoutSessionId: "fabricated_1" }, /real Stripe Checkout Session/i],
    ["evidence without a Stripe-originated event fails", { stripeEventId: "forged_1" }, /Stripe-originated event/i],
    ["evidence without a known price fails", { priceId: "" }, /price that was actually paid/i],
    ["evidence without provider acceptance fails", { emailProviderMessageId: "" }, /email provider accepted/i],
    ["evidence without durable duplicate suppression fails", { fulfillmentAttempts: 1 }, /duplicate webhook/i],
    ["evidence without a durable store fails", { fulfillmentStoreKind: "memory" }, /durable fulfillment store/i],
    ["evidence without license activation fails", { licenseTierVerified: "job-search" }, /issued license activates/i],
    ["evidence without both return routes fails", { cancellationRouteStatus: 500 }, /return routes/i],
    ["evidence from an older drill version fails", { drillVersion: "1.0.0" }, /drill 1\.0\.0/i],
  ];

  for (const [label, patch, pattern] of mutations) {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    const ev = { ...goodEvidence, ...patch };
    await store.putDoc(CERTIFICATION_RECORD_ID, ev);
    await store.putDoc(APPROVAL_RECORD_ID, approvalFor(ev));
    const v = await sellVerdict(store);
    check(label, v.canSellSafely === false);
    check(`${label} — blocker explains why`, v.blockers.some((b) => pattern.test(b)));
  }

  // 5. Approval scoping.
  {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    await store.putDoc(CERTIFICATION_RECORD_ID, goodEvidence);
    await store.putDoc(APPROVAL_RECORD_ID, { ...approvalFor(goodEvidence), approvedCommitSha: "oldcommit0000" });
    const v = await sellVerdict(store);
    check("approval for a previous commit keeps checkout closed", v.canSellSafely === false);
    check("the blocker names the commit mismatch", v.blockers.some((b) => /Approval covers commit/i.test(b)));
  }
  {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    await store.putDoc(CERTIFICATION_RECORD_ID, goodEvidence);
    await store.putDoc(APPROVAL_RECORD_ID, { ...approvalFor(goodEvidence), evidenceId: "0".repeat(32) });
    const v = await sellVerdict(store);
    check("approval granted against different evidence fails", v.canSellSafely === false);
  }
  {
    const inner = new MemoryFulfillmentStore();
    const store = durable(inner);
    await store.putDoc(CERTIFICATION_RECORD_ID, goodEvidence);
    await store.putDoc(APPROVAL_RECORD_ID, { ...approvalFor(goodEvidence), approvedEnvironment: "production" });
    const v = await sellVerdict(store);
    check("a preview approval cannot authorize another environment", v.canSellSafely === false);
  }

  delete process.env.VERCEL_GIT_COMMIT_SHA;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
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
    STRIPE_PRICE_RESET: "price_test_reset",
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
  const source = read("src/lib/server/fulfillment-store.ts");
  check(
    "Postgres readiness uses fulfillment facts, not an unwritten status value",
    source.includes("license_minted IS NOT TRUE OR email_sent IS NOT TRUE") &&
      !source.includes("status <> 'fulfilled'")
  );
}

{
  const source = read("scripts/approve-live-commerce.mjs");
  check(
    "approval recorder writes the field names consumed by the runtime gate",
    source.includes("approvedCommitSha: commitSha") &&
      source.includes("approvedEnvironment: environment") &&
      source.includes("approvalActor: actor")
  );
}

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

  await store.update("cs_1", {
    status: "email_sent",
    emailSent: true,
    emailProviderMessageId: "msg_1",
  });
  check("a completed session drops off the unfulfilled list", (await store.listUnfulfilled()).every((r) => r.sessionId !== "cs_1"));

  const afterComplete = await store.claim("cs_1", "evt_1_late_retry", {});
  check("a late retry of a completed session does not win a new claim", afterComplete.won === false);
  check("the completed record still reports the email as sent", afterComplete.record.emailSent === true);

  check("record carries the required operational fields", (() => {
    const r = afterComplete.record;
    return ["sessionId","lastEventId","paymentStatus","tier","status","licenseMinted","emailSent","emailProviderMessageId","attempts","lastError","createdAt","updatedAt"].every((k) => k in r);
  })());

  let fulfillmentEmails = 0;
  const deliver = async (eventId) => {
    const { record } = await store.claim("cs_same_entitlement", eventId, {
      paymentStatus: "paid",
      tier: "reset",
    });
    if (record.emailSent) return;
    fulfillmentEmails += 1;
    await store.update("cs_same_entitlement", {
      status: "email_sent",
      licenseMinted: true,
      emailSent: true,
      emailProviderMessageId: "msg_same_entitlement",
    });
  };
  await deliver("evt_first");
  await deliver("evt_duplicate");
  check(
    "the same entitlement is fulfilled by exactly one email across duplicate delivery",
    fulfillmentEmails === 1
  );
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
check("webhook records the real provider message id", /emailProviderMessageId: providerMessageId/.test(webhookRoute));
check("fulfillment email has text and HTML bodies", /text:[\s\S]{0,1800}html:/.test(webhookRoute));
check("fulfillment email uses a monitored reply-to", /reply_to: replyToAddress/.test(webhookRoute));
check("fulfillment email contains a direct session unlock", /unlock\?session_id=/.test(webhookRoute));
check("fulfillment email uses provider idempotency", /Idempotency-Key/.test(webhookRoute) && /career-forge-license\//.test(webhookRoute));
check(
  "fulfillment email subject is transactional and unique per checkout",
  webhookRoute.includes("subject: `Career Forge purchase confirmed — ${pack.name} — ${session.id.slice(-8)}`") &&
    !webhookRoute.includes("Your Career Forge license key")
);
check(
  "webhook returns 500 on email failure so Stripe retries",
  /fulfillment_email_failed[\s\S]{0,700}status:\s*500/.test(webhookRoute)
);
check("webhook no longer relies on in-memory dedupe", !webhookRoute.includes("markEventProcessed"));
check("the in-memory dedupe module is gone", !fs.existsSync(path.join(root, "src/lib/server/event-dedupe.ts")));
check("failures are categorised for reconciliation", /lastError:/.test(webhookRoute));
// The loophole, at the source level.
check(
  "the webhook cannot certify anything",
  !webhookRoute.includes("cs_test_drill_") && !webhookRoute.includes("CERTIFICATION_RECORD_ID")
);
check("the webhook re-reads the session from Stripe", webhookRoute.includes("verifyPaidSession"));
check(
  "the webhook does not trust metadata for the tier",
  !/const tier = session\??\.?\.metadata/.test(webhookRoute)
);
check("the self-signing drill is gone", !fs.existsSync(path.join(root, "scripts/fulfillment-drill.mjs")));

// Synthetic tool has hard runtime guards.
const synthetic = read("scripts/synthetic-webhook-regression.mjs");
check("synthetic tool refuses non-localhost targets", /REFUSED[\s\S]{0,200}localhost/.test(synthetic));
check("synthetic tool refuses live keys at runtime", /sk_live[\s\S]{0,200}process\.exit\(2\)/.test(synthetic));
check("synthetic tool never writes certification", !synthetic.includes("CERTIFICATION_RECORD_ID"));

const certify = read("scripts/certify-fulfillment.mjs");
check("certification client targets only the exact production host", /hostname !== "career-forge-lite\.vercel\.app"/.test(certify));
check("certification client reads the operator token only from the environment", /process\.env\.CERTIFICATION_OPERATOR_TOKEN/.test(certify) && !/operator-token/.test(certify));
check("certification client holds no Stripe key", !/STRIPE_TEST_SECRET_KEY|STRIPE_SECRET_KEY|sk_test_/.test(certify));
check("certification client states it does not authorize live checkout", /evidence, not permission|No live-commerce approval/i.test(certify));

const operatorRoute = read("src/app/api/internal/commerce-certification/route.ts");
check("production-host recorder is disabled without all temporary credentials", /if \(!config\)[\s\S]{0,100}status: 404/.test(operatorRoute));
check("production-host recorder requires a bearer token", /operatorAuthorized/.test(operatorRoute) && /Bearer /.test(operatorRoute));
check("production-host recorder refuses a foreign host or stale commit", /requestHost !== identity\.host/.test(operatorRoute) && /certification_commit/.test(operatorRoute));
check("production-host recorder retrieves the Stripe event directly", /\/events\//.test(operatorRoute) && /checkout\.session\.completed/.test(operatorRoute));
check("production-host recorder requires a provider message id and duplicate claim", /emailProviderMessageId/.test(operatorRoute) && /record\.attempts < 2/.test(operatorRoute));
check("production-host recorder never writes an approval record", !operatorRoute.includes("APPROVAL_RECORD_ID"));
check("unsafe local certification recorder is removed", !fs.existsSync(path.join(root, "scripts/record-certification.mjs")));

// Session verification derives tier from price, never metadata.
const verification = read("src/lib/server/session-verification.ts");
check("tier comes from an authoritative price map", /tierForPriceId/.test(verification));
check("metadata disagreeing with the price is rejected", /tier_mismatch/.test(verification));
check("amount and currency are checked against the package", /amount_mismatch/.test(verification) && /currency_mismatch/.test(verification));
check("a signature alone is documented as insufficient", /signature proves only/i.test(verification));

// Surface fingerprint keeps proof tied to the code it vouched for.
check("the certified surface hash is generated", fs.existsSync(path.join(root, "src/lib/server/certified-surface-hash.ts")));

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
