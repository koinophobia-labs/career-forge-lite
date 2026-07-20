// Fulfillment-safety checks.
//
// These exist because an audit found that a customer could be charged $49 and
// receive nothing, silently: in live mode the app handed out a Stripe Payment
// Link and never learned the outcome, the webhook safety net 503'd because its
// secret was never provisioned, and no route logged or persisted anything.
//
// Every check below is about one question: can this deployment take money it
// cannot deliver, or lose a paid customer without saying so?

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

function loadTs(relPath) {
  const source = fs.readFileSync(path.join(root, relPath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  new Function("module", "exports", "process", outputText)(module, module.exports, process);
  return module.exports;
}

const read = (relPath) => fs.readFileSync(path.join(root, relPath), "utf8");

// --- Readiness gate -----------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };
const withEnv = (vars, fn) => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("STRIPE_") || key.startsWith("LICENSE_") || key.startsWith("RESEND_") || key.startsWith("NEXT_PUBLIC_COMMERCE")) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, ORIGINAL_ENV);
  }
};

const ALL_PRESENT = {
  STRIPE_SECRET_KEY: "x",
  LICENSE_SIGNING_PRIVATE_KEY: "x",
  STRIPE_LIVE_RESET_PAYMENT_LINK: "https://buy.stripe.com/x",
  STRIPE_WEBHOOK_SECRET: "x",
  RESEND_API_KEY: "x",
  LICENSE_EMAIL_FROM: "x",
};

withEnv({ ...ALL_PRESENT, NEXT_PUBLIC_COMMERCE_MODE: "live" }, () => {
  const { fulfillmentReadiness, liveCommerceUnsafe } = loadTs("src/lib/server/fulfillment-readiness.ts");
  check("fully configured deployment is ready", fulfillmentReadiness().ready === true);
  check("fully configured live deployment is not flagged unsafe", liveCommerceUnsafe() === false);
});

// Each individually-missing setting must block the sale on its own.
for (const missing of Object.keys(ALL_PRESENT)) {
  const partial = { ...ALL_PRESENT, NEXT_PUBLIC_COMMERCE_MODE: "live" };
  delete partial[missing];
  withEnv(partial, () => {
    const { fulfillmentReadiness, liveCommerceUnsafe } = loadTs("src/lib/server/fulfillment-readiness.ts");
    const readiness = fulfillmentReadiness();
    check(`missing ${missing} blocks live checkout`, readiness.ready === false && liveCommerceUnsafe() === true);
    check(`missing ${missing} is named in the report`, readiness.missing.includes(missing));
    check(
      `missing ${missing} states its customer consequence`,
      readiness.requirements.find((r) => r.name === missing)?.consequence.length > 20
    );
  });
}

// The specific gap the audit found: payment link present, webhook absent.
withEnv(
  {
    NEXT_PUBLIC_COMMERCE_MODE: "live",
    STRIPE_SECRET_KEY: "x",
    LICENSE_SIGNING_PRIVATE_KEY: "x",
    STRIPE_LIVE_RESET_PAYMENT_LINK: "https://buy.stripe.com/x",
  },
  () => {
    const { liveCommerceUnsafe } = loadTs("src/lib/server/fulfillment-readiness.ts");
    check(
      "the audited production shape (payment link, no webhook, no email) is unsafe",
      liveCommerceUnsafe() === true
    );
  }
);

withEnv({ NEXT_PUBLIC_COMMERCE_MODE: "off" }, () => {
  const { liveCommerceUnsafe } = loadTs("src/lib/server/fulfillment-readiness.ts");
  check("a non-live deployment is not flagged unsafe", liveCommerceUnsafe() === false);
});

// --- Idempotency --------------------------------------------------------------------------------

{
  const { markEventProcessed, __resetDedupeForTests } = loadTs("src/lib/server/event-dedupe.ts");
  __resetDedupeForTests();

  check("first delivery of an event is processed", markEventProcessed("evt_1") === true);
  check("duplicate delivery of the same event is ignored", markEventProcessed("evt_1") === false);
  check("a different event still processes", markEventProcessed("evt_2") === true);
  check("blank event id is never dropped", markEventProcessed("") === true && markEventProcessed(null) === true);

  // Bounded memory must not silently start dropping fresh events.
  __resetDedupeForTests();
  for (let i = 0; i < 600; i += 1) markEventProcessed(`evt_bulk_${i}`);
  check("recent events are still deduplicated after eviction", markEventProcessed("evt_bulk_599") === false);
  check("evicted old events are reprocessed rather than lost", markEventProcessed("evt_bulk_0") === true);
}

// --- Route wiring -------------------------------------------------------------------------------

const checkoutRoute = read("src/app/api/checkout/route.ts");
check("checkout consults fulfillment readiness", checkoutRoute.includes("fulfillmentReadiness()"));
check(
  "checkout refuses when fulfillment is not ready",
  /!readiness\.ready[\s\S]{0,800}status:\s*503/.test(checkoutRoute)
);
check("checkout logs the refusal", checkoutRoute.includes('logCommerceEvent("checkout_blocked_unsafe"'));

const webhookRoute = read("src/app/api/stripe-webhook/route.ts");
check("webhook still verifies the Stripe signature", webhookRoute.includes("verifyStripeWebhookSignature"));
check("webhook logs rejected signatures", webhookRoute.includes('logCommerceEvent("webhook_rejected"'));
check("webhook deduplicates by event id", webhookRoute.includes("markEventProcessed(event.id)"));
check(
  "webhook returns 500 on email failure so Stripe retries",
  /fulfillment_email_failed[\s\S]{0,600}status:\s*500/.test(webhookRoute)
);
check(
  "webhook never swallows a failed send silently",
  !/\.catch\(\(\) => \{\s*\/\/[\s\S]{0,200}\}\);/.test(webhookRoute)
);
check(
  "a paid session with unusable metadata is recorded as unfulfilled",
  webhookRoute.includes('logCommerceEvent("PAID_BUT_UNFULFILLED"')
);

const licenseRoute = read("src/app/api/license/route.ts");
check("license route records successful mints", licenseRoute.includes('logCommerceEvent("license_minted"'));
check(
  "license route records a paid-but-unfulfillable session",
  licenseRoute.includes('logCommerceEvent("PAID_BUT_UNFULFILLED"')
);

// --- Health check must not leak secrets ----------------------------------------------------------

const healthRoute = read("src/app/api/commerce-health/route.ts");
check("health check reports readiness", healthRoute.includes("canSellSafely"));
check(
  "health check never returns a secret value",
  !/process\.env\.[A-Z_]+\s*[,}]/.test(healthRoute) && !healthRoute.includes("STRIPE_SECRET_KEY:")
);

const readinessSource = read("src/lib/server/fulfillment-readiness.ts");
check(
  "readiness reports presence only, never values",
  readinessSource.includes("Boolean(process.env[name]?.trim())") && !readinessSource.includes("return process.env[")
);

const logSource = read("src/lib/server/commerce-log.ts");
check(
  "commerce log documents the no-PII rule",
  /NEVER log: email addresses/.test(logSource)
);

// --- Purchase CTA -------------------------------------------------------------------------------

const pricingPage = read("src/app/pricing/page.tsx");
check("pricing page asks whether it may sell", pricingPage.includes("/api/commerce-health"));
check("pricing page closes checkout when unsafe", pricingPage.includes("checkoutClosed"));
check(
  "an unsafe deployment shows a contact CTA instead of a buy button",
  /checkoutClosed \?[\s\S]{0,900}mailto:/.test(pricingPage)
);
check(
  "checkout cannot be started while closed",
  /if \(checkoutClosed\) return;/.test(pricingPage)
);
check(
  "the CTA defaults to closed before readiness is known",
  pricingPage.includes("canSellSafely !== true")
);

// --- Recovery procedure -------------------------------------------------------------------------

check("a manual recovery runbook exists", fs.existsSync(path.join(root, "docs/RECOVERY.md")));
const recovery = fs.existsSync(path.join(root, "docs/RECOVERY.md")) ? read("docs/RECOVERY.md") : "";
check("runbook explains how to find unfulfilled purchases", recovery.includes("PAID_BUT_UNFULFILLED"));
check("runbook covers manual license minting", recovery.includes("mint-license"));
check("runbook covers refunds", /refund/i.test(recovery));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
