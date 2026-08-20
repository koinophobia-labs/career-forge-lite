// Functional checkout/session boundary checks with a mocked Stripe transport.
// No network, credentials, or customer data are used.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();

function loadTs(relativePath) {
  const absolute = path.join(root, relativePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute,
  });
  const loaded = { exports: {} };
  cache.set(absolute, loaded);
  const localRequire = (specifier) => specifier.startsWith("@/")
    ? loadTs(path.join("src", `${specifier.slice(2)}.ts`))
    : require(specifier);
  new Function("require", "module", "exports", outputText)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

const prices = {
  resume: ["price_resume", 900],
  job: ["price_job", 1_500],
  career: ["price_career", 2_500],
  "all-access": ["price_all_access", 3_900],
};
process.env.STRIPE_PRICE_RESUME = prices.resume[0];
process.env.STRIPE_PRICE_JOB = prices.job[0];
process.env.STRIPE_PRICE_CAREER = prices.career[0];
process.env.STRIPE_PRICE_ALL_ACCESS = prices["all-access"][0];

const { createCheckoutSession } = loadTs("src/lib/server/stripe.ts");
const { priceTierMap, verifyPaidSession } = loadTs("src/lib/server/session-verification.ts");

const originalFetch = globalThis.fetch;
try {
  for (const [tier, [priceId]] of Object.entries(prices)) {
    let request;
    globalThis.fetch = async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: `cs_test_${tier}`, url: "https://checkout.stripe.com/c/pay/test", payment_status: "unpaid", status: "open", created: 1, metadata: { tier } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const idempotencyKey = `career-forge/${tier}/request_1234567890`;
    const result = await createCheckoutSession(tier, "https://career.example", "sk_test_placeholder", undefined, {}, undefined, idempotencyKey);
    const body = request.init.body;
    check(`${tier} checkout uses its configured Price`, result.ok && body.get("line_items[0][price]") === priceId);
    check(`${tier} checkout sends one item and no client amount`, body.get("line_items[0][quantity]") === "1" && !body.has("line_items[0][price_data][unit_amount]"));
    check(`${tier} checkout has safe success and cancel routes`, body.get("success_url") === "https://career.example/unlock?session_id={CHECKOUT_SESSION_ID}" && body.get("cancel_url") === "https://career.example/pricing?checkout=cancelled");
    check(`${tier} checkout forwards the retry identity`, request.init.headers["Idempotency-Key"] === idempotencyKey);
  }
} finally {
  globalThis.fetch = originalFetch;
}

delete process.env.STRIPE_PRICE_ALL_ACCESS;
const unconfigured = await createCheckoutSession("all-access", "https://career.example", "sk_test_placeholder");
check("checkout refuses a package without an authoritative Price", !unconfigured.ok && unconfigured.status === 503);
process.env.STRIPE_PRICE_ALL_ACCESS = prices["all-access"][0];

const authoritative = priceTierMap();
for (const [tier, [priceId, amount]] of Object.entries(prices)) {
  const session = {
    id: `cs_test_paid_${tier.replace("-", "_")}`,
    payment_status: "paid",
    amount_total: amount,
    currency: "usd",
    livemode: false,
    created: 1_752_600_000,
    metadata: { tier },
    customer_details: { email: "buyer@example.test" },
    line_items: { data: [{ price: { id: priceId } }] },
  };
  const result = await verifyPaidSession(session.id, async () => ({ ok: true, session }), authoritative);
  check(`${tier} paid session verifies from the Price`, result.ok && result.session.tier === tier && result.session.amountTotal === amount);
}

const base = {
  id: "cs_test_boundary",
  payment_status: "paid",
  amount_total: 900,
  currency: "usd",
  livemode: false,
  created: 1_752_600_000,
  metadata: { tier: "resume" },
  customer_details: { email: "buyer@example.test" },
  line_items: { data: [{ price: { id: "price_resume" } }] },
};
const verify = (patch) => verifyPaidSession(base.id, async () => ({ ok: true, session: { ...base, ...patch } }), authoritative);
check("metadata cannot upgrade a paid Price", (await verify({ metadata: { tier: "all-access" } })).reason === "tier_mismatch");
check("wrong amount is rejected", (await verify({ amount_total: 899 })).reason === "amount_mismatch");
check("wrong currency is rejected", (await verify({ currency: "eur" })).reason === "currency_mismatch");
check("retired or unknown Price is rejected", (await verify({ line_items: { data: [{ price: { id: "price_legacy_reset" } }] } })).reason === "unknown_price");
check("unpaid Session is rejected", (await verify({ payment_status: "unpaid" })).reason === "not_paid");
check("missing fulfillment email is rejected", (await verify({ customer_details: {} })).reason === "no_email");

console.log(`\nCommerce boundary regression: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
