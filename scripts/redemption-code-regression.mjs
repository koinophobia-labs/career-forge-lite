import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleCache = new Map();

function loadTs(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolute,
  });
  const loaded = { exports: {} };
  moduleCache.set(absolute, loaded);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTs(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTs(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(
    localRequire,
    loaded,
    loaded.exports,
    dirname,
    absolute
  );
  return loaded.exports;
}

let passes = 0;
let failures = 0;
function check(label, condition) {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const pure = loadTs(path.join(root, "src/lib/redemption-code.ts"));
const cryptoCode = loadTs(path.join(root, "src/lib/server/redemption-code.ts"));
const rates = loadTs(path.join(root, "src/lib/server/redemption-rate-limit.ts"));
const { MemoryFulfillmentStore } = loadTs(path.join(root, "src/lib/server/fulfillment-store.ts"));
const { mintLicenseKey } = loadTs(path.join(root, "src/lib/server/license-mint.ts"));
const { verifyLicenseKey } = loadTs(path.join(root, "src/lib/license.ts"));

const pepper = "regression-only-pepper-with-at-least-32-bytes";
const fixedA = "CF-7K9M-P4TX-W8Q2";
const fixedB = "CF-A2BC-D3EF-G4HJ";

check("short-code alphabet has exactly 32 symbols", pure.REDEMPTION_CODE_ALPHABET.length === 32);
check("short-code entropy is 60 bits", pure.REDEMPTION_CODE_ENTROPY_BITS === 60);
check("generated code has the required grouped format", /^CF-[A-HJ-KM-NP-Z2-9*]{4}(?:-[A-HJ-KM-NP-Z2-9*]{4}){2}$/.test(cryptoCode.generateRedemptionCode()));
check("ambiguous characters are excluded", !/[01OIL]/.test(pure.REDEMPTION_CODE_ALPHABET));

const generated = new Set(Array.from({ length: 256 }, () => cryptoCode.generateRedemptionCode()));
check("independent generation does not collide in the regression sample", generated.size === 256);

for (const candidate of [
  fixedA,
  "cf-7k9m-p4tx-w8q2",
  "CF 7K9M P4TX W8Q2",
  "cf7k9mp4txw8q2",
]) {
  check(`normalizes ${candidate}`, pure.normalizeRedemptionCode(candidate) === "CF7K9MP4TXW8Q2");
}
for (const candidate of ["CF-7K9M-P4TX-W8Q", "CF-7K9M-P4TX-W8Q0", "CF-7K9M-P4TX-W8QI", "nope"]) {
  check(`rejects malformed ${candidate}`, pure.normalizeRedemptionCode(candidate) === null);
}
check("typing auto-formats short codes", pure.formatAccessCodeInput("cf7k9mp4txw8q2") === fixedA);
check("legacy signed keys are preserved by input formatting", pure.formatAccessCodeInput("CF1.payload.signature") === "CF1.payload.signature");

const store = new MemoryFulfillmentStore();
const purchase = {
  sessionId: "cs_test_short_code_one",
  tier: "reset",
  entitlementReference: "code-one",
  purchaseTimestamp: "2026-07-21T12:00:00.000Z",
};
const first = await cryptoCode.issueRedemptionCode(store, purchase, pepper, () => fixedA);
const duplicate = await cryptoCode.issueRedemptionCode(store, purchase, pepper, () => fixedB);
check("a duplicate fulfillment reuses one customer-facing code", first.redemptionCode === duplicate.redemptionCode);
check("one checkout session has exactly one redemption record", (await store.getRedemptionBySession(purchase.sessionId)).codeHash === first.record.codeHash);
check("normalized code hash is stable and peppered", first.record.codeHash === cryptoCode.hashRedemptionCode("CF7K9MP4TXW8Q2", pepper));
check("stored record does not contain plaintext code", !JSON.stringify(first.record).includes(fixedA));

const secondPurchase = { ...purchase, sessionId: "cs_test_short_code_two", entitlementReference: "code-two" };
const sequence = [fixedA, fixedB];
const collisionRecovered = await cryptoCode.issueRedemptionCode(store, secondPurchase, pepper, () => sequence.shift());
check("hash collision retries with fresh randomness", collisionRecovered.redemptionCode === fixedB);

await store.markRedemptionDelivered(purchase.sessionId);
const delivered = await store.getRedemptionBySession(purchase.sessionId);
check("delivery erases encrypted retry material", delivered.pendingCodeCiphertext === null);
check("permanent redemption state still contains no plaintext", !JSON.stringify(delivered).includes(fixedA));

const foundFromFreshServiceInstance = await store.getRedemptionByHash(
  cryptoCode.hashRedemptionCode(pure.normalizeRedemptionCode("cf 7k9m p4tx w8q2"), pepper)
);
check("fresh-instance lookup finds the durable hashed mapping", foundFromFreshServiceInstance?.sessionId === purchase.sessionId);
const redeemed = await store.markRedemptionRedeemed(foundFromFreshServiceInstance.codeHash);
check("successful redemption records time and count", redeemed.redemptionCount === 1 && Boolean(redeemed.lastRedeemedAt));
const revoked = await store.revokeRedemption(foundFromFreshServiceInstance.codeHash, "support_test");
check("redemption codes can be revoked with a reason", revoked.revoked && revoked.revocationReason === "support_test");

let rate = null;
for (let index = 0; index < 4; index += 1) rate = rates.recordRedemptionFailure(rate, 1_000);
check("four failures do not trigger cooldown", rates.rateLimitBlocked(rate, 1_001) === false);
rate = rates.recordRedemptionFailure(rate, 1_000);
check("five failures in one minute trigger cooldown", rates.rateLimitBlocked(rate, 1_001) === true);
const secondStrike = Array.from({ length: 5 }).reduce(
  (state) => rates.recordRedemptionFailure(state, rate.cooldownUntil + 1),
  rate
);
check("repeated abuse increases cooldown", secondStrike.cooldownUntil - (rate.cooldownUntil + 1) >= 120_000);

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const signedEntitlement = mintLicenseKey("reset", foundFromFreshServiceInstance.entitlementReference, 1_752_600_000, privateB64);
const verified = await verifyLicenseKey(signedEntitlement, publicB64);
check("short-code mapping produces a valid signed entitlement", verified.ok && verified.payload.tier === "reset");
check("existing long CF1 keys remain valid", verified.ok && pure.isLegacyLicenseKey(signedEntitlement));

const storeSource = fs.readFileSync(path.join(root, "src/lib/server/fulfillment-store.ts"), "utf8");
const webhookSource = fs.readFileSync(path.join(root, "src/app/api/stripe-webhook/route.ts"), "utf8");
const redeemSource = fs.readFileSync(path.join(root, "src/app/api/redeem/route.ts"), "utf8");
const unlockSource = fs.readFileSync(path.join(root, "src/app/unlock/page.tsx"), "utf8");
const pricingSource = fs.readFileSync(path.join(root, "src/app/pricing/page.tsx"), "utf8");
const premiumAccessSource = fs.readFileSync(path.join(root, "src/components/PremiumAccess.tsx"), "utf8");
check("Neon schema stores hashed code and required lifecycle fields", ["code_hash", "session_id", "entitlement_reference", "purchase_timestamp", "last_redeemed_at", "redemption_count", "revoked", "revocation_reason"].every((field) => storeSource.includes(field)));
check("Neon enforces one code per Checkout Session", /session_id\s+TEXT UNIQUE NOT NULL/.test(storeSource));
check("email includes short code and excludes signed entitlement", webhookSource.includes("redemptionCode,") && !/License key:/.test(webhookSource));
check("email has plain-text and HTML variants", webhookSource.includes("text:") && webhookSource.includes("html:"));
check("redemption endpoint returns generic invalid-code errors", redeemSource.includes("That access code could not be activated") && !redeemSource.includes("partial"));
check("redemption endpoint never logs plaintext codes", !/logCommerceEvent\([^)]*(submitted|normalized|codeHash)/s.test(redeemSource));
check("unlock labels the customer field Access code", /htmlFor="access-code"[\s\S]{0,80}Access code/.test(unlockSource));
check("unlock supports paste, auto-capitalization, and accessible status", unlockSource.includes("Paste code") && unlockSource.includes('autoCapitalize="characters"') && unlockSource.includes('role="status"'));
check("unlock never renders a signed entitlement", !/\{fulfillment\.(license|signedEntitlement)\}/.test(unlockSource));
check("mobile layout does not require a wide row", unlockSource.includes("min-w-0") && unlockSource.includes("flex-col"));
check("pricing uses access-code language", !/license key/i.test(pricingSource));
check("premium gate uses access-code language", !/license key/i.test(premiumAccessSource));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
