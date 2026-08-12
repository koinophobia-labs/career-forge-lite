import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeLoader(stubs = {}) {
  const cache = new Map();
  function load(filePath) {
    const absolute = path.resolve(filePath);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: absolute,
    });
    const loaded = { exports: {} };
    cache.set(absolute, loaded);
    const localRequire = (specifier) => {
      if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
      if (specifier.startsWith("@/")) return load(path.join(root, "src", `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) {
        return load(path.resolve(path.dirname(absolute), specifier.endsWith(".ts") ? specifier : `${specifier}.ts`));
      }
      return require(specifier);
    };
    new Function("require", "module", "exports", "__dirname", "__filename", outputText)(
      localRequire, loaded, loaded.exports, path.dirname(absolute), absolute
    );
    return loaded.exports;
  }
  return { load };
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

const { load } = makeLoader({
  "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) } },
  "@/lib/server/commerce-log": { logCommerceEvent: () => {} },
});
const storeModule = load(path.join(root, "src/lib/server/fulfillment-store.ts"));
const codes = load(path.join(root, "src/lib/server/redemption-code.ts"));
const mint = load(path.join(root, "src/lib/server/license-mint.ts"));
const license = load(path.join(root, "src/lib/license.ts"));
const revocation = load(path.join(root, "src/lib/server/revocation.ts"));
const authorizeRoute = load(path.join(root, "src/app/api/entitlement/authorize/route.ts"));

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
process.env.LICENSE_SIGNING_PRIVATE_KEY = privateB64;
process.env.NEXT_PUBLIC_LICENSE_PUBLIC_KEY = publicB64;

const store = new storeModule.MemoryFulfillmentStore();
storeModule.__setFulfillmentStoreForTests(store);
const pepper = "revocation-regression-pepper-at-least-32-bytes";
process.env.REDEMPTION_CODE_PEPPER = pepper;
const timestamp = "2026-08-12T12:00:00.000Z";
const issuedAt = Math.floor(new Date(timestamp).getTime() / 1000);
const entitlementId = "0123456789abcdef0123456789abcdef";
const paymentIntentId = "pi_revocation_regression";
const issued = await codes.issueRedemptionCode(store, {
  sessionId: "cs_test_revocation_regression",
  tier: "reset",
  entitlementReference: "revocable-one",
  entitlementId,
  paymentIntentId,
  amountTotal: 4900,
  currency: "usd",
  purchaseTimestamp: timestamp,
}, pepper, () => "CF-7K9M-P4TX-W8Q2R");

check("issued entitlement has a stable opaque id", issued.record.entitlementId === entitlementId);
check("payment maps durably to the entitlement record", (await store.getRedemptionByPaymentIntent(paymentIntentId))?.entitlementId === entitlementId);
check("entitlement id maps durably to its issuance", (await store.getRedemptionByEntitlementId(entitlementId))?.sessionId === issued.record.sessionId);

const cf2 = mint.mintRevocableLicenseKey("reset", "revocable-one", issuedAt, entitlementId, privateB64);
const verifiedCf2 = await license.verifyLicenseKey(cf2, publicB64);
check("CF2 signature carries the stable entitlement id", verifiedCf2.ok && verifiedCf2.payload.v === 2 && verifiedCf2.payload.entitlementId === entitlementId);

const request = (signedEntitlement) => ({ json: async () => ({ signedEntitlement }) });
const authorization = await authorizeRoute.POST(request(cf2));
check("first CF2 activation requires and receives online authorization", authorization.status === 200 && authorization.body.authorized === true);
check("online authorization window is exactly 24 hours", authorization.body.expiresAt - authorization.body.checkedAt === 86_400_000);
const verifiedAuthorization = await license.verifyAuthorizationReceipt(authorization.body.authorizationReceipt, publicB64);
check("device authorization window is server-signed", verifiedAuthorization.ok && verifiedAuthorization.payload.entitlementId === entitlementId);
const authorizationParts = license.parseAuthorizationReceipt(authorization.body.authorizationReceipt);
const authorizationSignature = Buffer.from(authorizationParts.signatureB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
authorizationSignature[8] ^= 1;
const forgedAuthorization = `CFA1.${authorizationParts.payloadB64}.${authorizationSignature.toString("base64url")}`;
check("edited device authorization receipt cannot extend access", !(await license.verifyAuthorizationReceipt(forgedAuthorization, publicB64)).ok);

const legacy = mint.mintLicenseKey("reset", "revocable-one", issuedAt, privateB64);
const exchange = await authorizeRoute.POST(request(legacy));
const verifiedExchange = await license.verifyLicenseKey(exchange.body.signedEntitlement, publicB64);
check("mapped CF1 receives a one-time online CF2 exchange", exchange.status === 200 && verifiedExchange.ok && verifiedExchange.payload.v === 2);
const unmappedLegacy = mint.mintLicenseKey("reset", "not-issued", issuedAt, privateB64);
check("unmapped CF1 remains locked", (await authorizeRoute.POST(request(unmappedLegacy))).status === 403);

const partial = await revocation.decideRefundRevocation(store, {
  id: "re_partial", amount: 100, currency: "usd", status: "succeeded", payment_intent: paymentIntentId, charge: "ch_regression", livemode: false,
});
check("partial refunds do not silently revoke the full entitlement", !partial.revoke && partial.reason === "partial_refund");
const full = await revocation.decideRefundRevocation(store, {
  id: "re_full", amount: 2400, currency: "usd", status: "succeeded", payment_intent: paymentIntentId, charge: "ch_regression", livemode: false,
}, 4900);
check("cumulative successful refunds reaching the full charge map to exactly one entitlement", full.revoke && full.record.entitlementId === entitlementId);
await store.revokeRedemption(full.record.codeHash, "stripe_refund:re_full");
const denied = await authorizeRoute.POST(request(cf2));
check("revoked CF2 is denied immediately on its next connected check", denied.status === 403 && denied.body.revoked === true);
check("durable revocation records reason and timestamp", Boolean((await store.getRedemptionByEntitlementId(entitlementId))?.revokedAt));

const collisionStore = new storeModule.MemoryFulfillmentStore();
for (const [index, id] of ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"].entries()) {
  await codes.issueRedemptionCode(collisionStore, {
    sessionId: `cs_test_collision_${index}`,
    tier: "reset",
    entitlementReference: "same-legacy-reference",
    entitlementId: id,
    purchaseTimestamp: timestamp,
  }, pepper, () => index === 0 ? "CF-A2BC-D3EF-G4HJK" : "CF-7K9M-P4TX-W8Q2R");
}
check("ambiguous legacy references fail closed instead of guessing", (await collisionStore.getRedemptionByReference("same-legacy-reference")) === null);

const entitlementSource = fs.readFileSync(path.join(root, "src/lib/entitlement.ts"), "utf8");
const backupSource = fs.readFileSync(path.join(root, "src/lib/backup.ts"), "utf8");
const webhookSource = fs.readFileSync(path.join(root, "src/app/api/stripe-webhook/route.ts"), "utf8");
const checkoutSource = fs.readFileSync(path.join(root, "src/lib/server/stripe.ts"), "utf8");
check("device authorization expires itself while an offline app remains open", entitlementSource.includes("scheduleExpiry") && entitlementSource.includes('status: "invalid"'));
check("network failure cannot extend an expired authorization receipt", entitlementSource.includes("authorization.expiresAt > now"));
check("client verifies the signed authorization receipt before granting", entitlementSource.includes("verifyAuthorizationReceipt") && entitlementSource.includes("verifiedAuthorization.payload"));
check("authorization cache is device-local and absent from backup serialization", !backupSource.includes("AUTHORIZATION_STORAGE_KEY") && !backupSource.includes("career-forge-entitlement-authorization-v1"));
check("Checkout mirrors opaque identity into PaymentIntent metadata", checkoutSource.includes("payment_intent_data[metadata]"));
check("webhook consumes verified refund creation and update events", webhookSource.includes('event.type === "refund.created"') && webhookSource.includes('event.type === "refund.updated"'));
check("commerce remains off in repository defaults throughout revocation pass", fs.readFileSync(path.join(root, ".env.example"), "utf8").includes("NEXT_PUBLIC_COMMERCE_MODE=off"));

delete process.env.LICENSE_SIGNING_PRIVATE_KEY;
delete process.env.NEXT_PUBLIC_LICENSE_PUBLIC_KEY;
delete process.env.REDEMPTION_CODE_PEPPER;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
