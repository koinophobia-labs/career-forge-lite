// Entitlement + license integrity checks: mint/verify round-trips, tampering,
// tier feature grants, and Stripe webhook signature verification.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHmac, generateKeyPairSync } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  const fn = new Function("require", "module", "exports", "__dirname", "__filename", outputText);
  fn(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

let failures = 0;
let passes = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const { mintLicenseKey } = loadTsModule(path.join(root, "src/lib/server/license-mint.ts"));
const { parseLicenseKey, verifyLicenseKey } = loadTsModule(path.join(root, "src/lib/license.ts"));
const { PACKAGES, PACKAGE_ORDER, isPackageTier, tierHasFeature, tierLaneLimit } = loadTsModule(
  path.join(root, "src/lib/packages.ts")
);
const { verifyStripeWebhookSignature } = loadTsModule(path.join(root, "src/lib/server/stripe.ts"));

// --- Test keypair (never the production keys) -----------------------------------------------------

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");

const { privateKey: wrongPrivate } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const wrongPrivateB64 = wrongPrivate.export({ format: "der", type: "pkcs8" }).toString("base64");

const NOW = 1_752_600_000; // fixed timestamp keeps this suite deterministic

// --- Mint + verify round-trip ----------------------------------------------------------------------

for (const tier of PACKAGE_ORDER) {
  const key = mintLicenseKey(tier, "test-ref", NOW, privateB64);
  check(`mints a ${tier} license`, typeof key === "string" && key.startsWith("CF1."));
  const verified = await verifyLicenseKey(key, publicB64);
  check(`verifies a ${tier} license`, verified.ok === true && verified.payload.tier === tier);
  check(`${tier} license carries the purchase ref`, verified.ok && verified.payload.ref === "test-ref");
}

// --- Tampering and forgery --------------------------------------------------------------------------

const genuine = mintLicenseKey("reset", "ref-1", NOW, privateB64);
const genuineParts = parseLicenseKey(genuine);

// Upgrade attack: swap the payload to career-switch but keep the reset signature.
const forgedPayload = Buffer.from(JSON.stringify({ v: 1, tier: "career-switch", ref: "ref-1", iat: NOW }), "utf8")
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");
const upgraded = `CF1.${forgedPayload}.${genuineParts.signatureB64}`;
const upgradeResult = await verifyLicenseKey(upgraded, publicB64);
check("payload-swap upgrade attack is rejected", upgradeResult.ok === false && upgradeResult.reason === "bad-signature");

// Key minted with a different private key must not verify.
const foreign = mintLicenseKey("career-switch", "ref-2", NOW, wrongPrivateB64);
const foreignResult = await verifyLicenseKey(foreign, publicB64);
check("license from a different signing key is rejected", foreignResult.ok === false);

// Signature bit-flip. Flip a real bit in the DECODED signature bytes and
// re-encode: mutating the base64url string's trailing characters was flaky,
// because the final character only carries 2 significant bits — a signature
// ending in "BA" mutated to "BB" decodes to byte-identical signature bytes
// (A and B share the same top 2 bits), which then correctly verified.
const flippedSigBytes = Buffer.from(genuineParts.signatureB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
flippedSigBytes[10] ^= 0x01;
const flippedSigB64 = flippedSigBytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const flipped = `CF1.${genuineParts.payloadB64}.${flippedSigB64}`;
check("bit-flipped signature is rejected", (await verifyLicenseKey(flipped, publicB64)).ok === false);

// Structural garbage.
for (const junk of ["", "CF1", "CF1.only-two", "CF2.a.b", "not a key at all", "CF1..", `CF1.${forgedPayload}.`]) {
  check(`malformed key ${JSON.stringify(junk.slice(0, 20))} is rejected`, (await verifyLicenseKey(junk, publicB64)).ok === false);
}

// Valid signature over an invalid payload (unknown tier) must be rejected.
const badTierPayload = { v: 1, tier: "supreme", ref: "x", iat: NOW };
{
  const { sign, createPrivateKey } = await import("node:crypto");
  const payloadBytes = Buffer.from(JSON.stringify(badTierPayload), "utf8");
  const sig = sign("sha256", payloadBytes, {
    key: createPrivateKey({ key: Buffer.from(privateB64, "base64"), format: "der", type: "pkcs8" }),
    dsaEncoding: "ieee-p1363"
  });
  const b64u = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const badTierKey = `CF1.${b64u(payloadBytes)}.${b64u(sig)}`;
  const badTierResult = await verifyLicenseKey(badTierKey, publicB64);
  check("signed-but-unknown tier is rejected", badTierResult.ok === false && badTierResult.reason === "bad-payload");
}

// Missing public key configuration never grants.
check("verification without a public key is rejected", (await verifyLicenseKey(genuine, null)).ok === false);

// Minting without a private key fails closed.
check("minting without a private key returns null", mintLicenseKey("reset", "r", NOW, null) === null);
check("minting with garbage private key returns null", mintLicenseKey("reset", "r", NOW, "bm90IGEga2V5") === null);

// --- Package config sanity ---------------------------------------------------------------------------

check("three packages defined", PACKAGE_ORDER.length === 3);
check("prices ascend with tier", PACKAGES["reset"].priceUsd < PACKAGES["job-search"].priceUsd && PACKAGES["job-search"].priceUsd < PACKAGES["career-switch"].priceUsd);
check(
  "higher tiers include every lower-tier feature",
  PACKAGES["reset"].features.every((f) => PACKAGES["job-search"].features.includes(f)) &&
    PACKAGES["job-search"].features.every((f) => PACKAGES["career-switch"].features.includes(f))
);
check("lane limits ascend", tierLaneLimit("reset") === 1 && tierLaneLimit("job-search") === 2 && tierLaneLimit("career-switch") === 3);
check("no tier grants nothing", PACKAGE_ORDER.every((tier) => PACKAGES[tier].features.length > 0));
check("unentitled lane limit is 1", tierLaneLimit(null) === 1);
check("tierHasFeature rejects null tier", tierHasFeature(null, "export_baseline_pack") === false);
check("isPackageTier rejects junk", !isPackageTier("premium") && !isPackageTier(null) && !isPackageTier(1));
check(
  "interview stays gated below job-search",
  !tierHasFeature("reset", "interview_unlimited") && tierHasFeature("job-search", "interview_unlimited")
);
check(
  "career-switch toolkit is exclusive to the top tier",
  !tierHasFeature("job-search", "career_switch_toolkit") && tierHasFeature("career-switch", "career_switch_toolkit")
);

// --- Stripe webhook signature verification ------------------------------------------------------------

const endpointSecret = "whsec_test_secret";
const body = JSON.stringify({ type: "checkout.session.completed" });
const timestamp = NOW;
const hmac = createHmac("sha256", endpointSecret).update(`${timestamp}.${body}`, "utf8").digest("hex");

check(
  "valid webhook signature accepted",
  verifyStripeWebhookSignature(body, `t=${timestamp},v1=${hmac}`, endpointSecret, 300, timestamp + 10) === true
);
check(
  "wrong-secret webhook signature rejected",
  verifyStripeWebhookSignature(body, `t=${timestamp},v1=${hmac}`, "whsec_other", 300, timestamp + 10) === false
);
check(
  "stale webhook timestamp rejected",
  verifyStripeWebhookSignature(body, `t=${timestamp},v1=${hmac}`, endpointSecret, 300, timestamp + 3600) === false
);
check(
  "tampered webhook body rejected",
  verifyStripeWebhookSignature(body + " ", `t=${timestamp},v1=${hmac}`, endpointSecret, 300, timestamp + 10) === false
);
check("missing signature header rejected", verifyStripeWebhookSignature(body, null, endpointSecret, 300, timestamp) === false);
check(
  "signature list with one valid candidate accepted",
  verifyStripeWebhookSignature(body, `t=${timestamp},v1=deadbeef,v1=${hmac}`, endpointSecret, 300, timestamp + 10) === true
);

// --- Result -------------------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
