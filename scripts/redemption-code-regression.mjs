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
const fixedA = "CF-7K9M-P4TX-W8Q2R";
const fixedB = "CF-A2BC-D3EF-G4HJK";

check("short-code alphabet has exactly 31 symbols", pure.REDEMPTION_CODE_ALPHABET.length === 31);
check("short-code entropy remains above 60 bits", pure.REDEMPTION_CODE_ENTROPY_BITS >= 60);
check("short-code entropy is approximately 64.4 bits", Math.abs(pure.REDEMPTION_CODE_ENTROPY_BITS - 64.4) < 0.01);
check("generated code has the required grouped format", /^CF-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{5}$/.test(cryptoCode.generateRedemptionCode()));
check("ambiguous characters are excluded", !/[01OIL]/.test(pure.REDEMPTION_CODE_ALPHABET));
check("symbols are excluded", /^[A-Z2-9]+$/.test(pure.REDEMPTION_CODE_ALPHABET));
check(
  "generation rejects biased byte values",
  cryptoCode.generateRedemptionCode(Uint8Array.from([248, 249, 250, 251, 252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) === "CF-ABCD-EFGH-JKMNP"
);

const generated = new Set(Array.from({ length: 256 }, () => cryptoCode.generateRedemptionCode()));
check("independent generation does not collide in the regression sample", generated.size === 256);

for (const candidate of [
  fixedA,
  "cf-7k9m-p4tx-w8q2r",
  "CF 7K9M P4TX W8Q2R",
  "cf7k9mp4txw8q2r",
]) {
  check(`normalizes ${candidate}`, pure.normalizeRedemptionCode(candidate) === "CF7K9MP4TXW8Q2R");
}
for (const candidate of ["CF-7K9M-P4TX-W8Q2", "CF-7K9M-P4TX-W8Q20", "CF-7K9M-P4TX-W8Q2I", "CF-7K9M-P4TX-W8Q2*", "nope"]) {
  check(`rejects malformed ${candidate}`, pure.normalizeRedemptionCode(candidate) === null);
}
check("typing auto-formats short codes", pure.formatAccessCodeInput("cf7k9mp4txw8q2r") === fixedA);
check("spaces and hyphens remain optional", pure.formatAccessCodeInput("cf 7k9m-p4tx w8q2r") === fixedA);
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
check("normalized code hash is stable and peppered", first.record.codeHash === cryptoCode.hashRedemptionCode("CF7K9MP4TXW8Q2R", pepper));
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
  cryptoCode.hashRedemptionCode(pure.normalizeRedemptionCode("cf 7k9m p4tx w8q2r"), pepper)
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

// CF-03: a single bearer code activates a generous, capped number of times.
const cap = loadTs(path.join(root, "src/lib/server/redemption-cap.ts"));
check("default activation cap is a generous 10", cap.DEFAULT_REDEMPTION_MAX_ACTIVATIONS === 10);
check("unset activation cap falls back to the generous default", cap.resolveRedemptionMaxActivations(undefined) === 10);
check("blank activation cap falls back to the default", cap.resolveRedemptionMaxActivations("   ") === 10);
for (const bad of ["abc", "0", "-3", "2.5", "Infinity", "NaN"]) {
  check(`nonsense cap "${bad}" fails open to the default`, cap.resolveRedemptionMaxActivations(bad) === 10);
}
check("an operator can lower the cap explicitly", cap.resolveRedemptionMaxActivations("3") === 3);
check("an operator can raise the cap explicitly", cap.resolveRedemptionMaxActivations("25") === 25);
check(
  "a code is refused once prior activations reach the cap",
  cap.redemptionCapReached(3, 3) === true && cap.redemptionCapReached(4, 3) === true
);
check(
  "a code is allowed while prior activations remain under the cap",
  cap.redemptionCapReached(0, 3) === false && cap.redemptionCapReached(2, 3) === false
);
check(
  "an unreadable (non-finite/negative) count fails open to allowed",
  cap.redemptionCapReached(NaN, 3) === false && cap.redemptionCapReached(-1, 3) === false
);
// Executed store-level walk: redeeming to the cap flips the gate, and it stays
// flipped, without ever revoking the code.
const cappedStore = new MemoryFulfillmentStore();
const capIssue = await cryptoCode.issueRedemptionCode(
  cappedStore,
  { sessionId: "cs_test_cap_walk", tier: "reset", entitlementReference: "cap-walk", purchaseTimestamp: "2026-07-21T12:00:00.000Z" },
  pepper,
  () => "CF-CAP2-WAKE-2Q3R4"
);
let capBefore = null;
for (let i = 0; i < 3; i += 1) {
  const rec = await cappedStore.getRedemptionByHash(capIssue.record.codeHash);
  check(`activation ${i + 1} of 3 is under the cap and allowed`, cap.redemptionCapReached(rec.redemptionCount, 3) === false);
  capBefore = await cappedStore.markRedemptionRedeemed(capIssue.record.codeHash);
}
check("after three activations the stored count equals the cap", capBefore.redemptionCount === 3);
const capAfter = await cappedStore.getRedemptionByHash(capIssue.record.codeHash);
check("a fourth activation is refused by the cap", cap.redemptionCapReached(capAfter.redemptionCount, 3) === true);
check("reaching the cap does not revoke the code", capAfter.revoked === false);

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
check("redemption endpoint enforces the per-code activation cap", redeemSource.includes("redemptionCapReached") && redeemSource.includes("resolveRedemptionMaxActivations"));
check("redemption endpoint refuses a capped code with the generic error", redeemSource.includes('return fail("cap_reached")'));
check("unlock labels the customer field Access code", /htmlFor="access-code"[\s\S]{0,80}Access code/.test(unlockSource));
check("unlock supports paste, auto-capitalization, and accessible status", unlockSource.includes("Paste code") && unlockSource.includes('autoCapitalize="characters"') && unlockSource.includes('role="status"'));
check("unlock never renders a signed entitlement", !/\{fulfillment\.(license|signedEntitlement)\}/.test(unlockSource));
check("mobile layout does not require a wide row", unlockSource.includes("min-w-0") && unlockSource.includes("flex-col"));
check("pricing uses access-code language", !/license key/i.test(pricingSource));
check("premium gate uses access-code language", !/license key/i.test(premiumAccessSource));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
