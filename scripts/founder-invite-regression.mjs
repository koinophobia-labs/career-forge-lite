// Founder-invite integrity + CF-01 remediation proof.
//
// CF-01 (red-team, High): a default-ENABLED, guessable, unsalted-hash founder
// invite minted an UNLIMITED number of higher-tier ($79 job-search) licenses for
// free via one unauthenticated POST, bypassing every sell-approval gate.
//
// This suite proves the executed attack now fails and the invite only works when
// a deployment explicitly opts in AND the human sell-approval gate is satisfied:
//   * OFF by default — the old brand word "lazyboikoi" is rejected.
//   * No shipped default hash anywhere in src.
//   * Opt-in requires BOTH FOUNDER_INVITE_ENABLED=true AND a configured hash.
//   * The route is bound to canSellSafely (Blake's approval), rate-limited, and
//     capped, and comps only the entry "reset" tier — never a higher tier.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// A module loader that transpiles the app's TS and lets a test inject stubs for
// specific specifiers (used to isolate the route handler from next/server and
// the sell-verdict gate).
function makeLoader(stubs = {}) {
  const moduleCache = new Map();
  function load(filePath) {
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
    const cjsModule = { exports: {} };
    moduleCache.set(absolute, cjsModule);
    const dirname = path.dirname(absolute);
    const localRequire = (request) => {
      if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
      if (request.startsWith("@/")) return load(path.join(root, "src", `${request.slice(2)}.ts`));
      if (request.startsWith("."))
        return load(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
      return require(request);
    };
    const fn = new Function("require", "module", "exports", "__dirname", "__filename", outputText);
    fn(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
    return cjsModule.exports;
  }
  return { load, moduleCache };
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

const sha256hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// Clean env baseline for every block.
function resetInviteEnv() {
  delete process.env.FOUNDER_INVITE_ENABLED;
  delete process.env.FOUNDER_INVITE_CODE_SHA256;
  delete process.env.FOUNDER_INVITE_MAX_TOTAL;
  delete process.env.FOUNDER_INVITE_MAX_PER_HOUR;
}

/* ============================ 1. library units ============================ */
{
  resetInviteEnv();
  const { load } = makeLoader();
  const invite = load(path.join(root, "src/lib/server/founder-invite.ts"));
  const { verifyLicenseKey } = load(path.join(root, "src/lib/license.ts"));

  // --- CF-01 core: the executed attack now fails by default ---
  check("CF-01 backdoor closed: 'lazyboikoi' rejected by default", !invite.founderInviteCodeMatches("lazyboikoi"));
  check("CF-01 backdoor closed: case/space variants of the brand word rejected", !invite.founderInviteCodeMatches("  LazyBoiKoi  "));
  check("disabled by default: getFounderInviteHash() is null with no env", invite.getFounderInviteHash() === null);

  // --- no shipped default hash anywhere in src ---
  const OLD_DEFAULT_HASH = "5216551874a15fa31d3f90385cde3755058a97ac8df1a94e5f9e2fda3251e1cf";
  const srcDump = fs.readFileSync(path.join(root, "src/lib/server/founder-invite.ts"), "utf8");
  check("no hardcoded default invite hash in founder-invite.ts", !srcDump.includes(OLD_DEFAULT_HASH));

  // --- opt-in requires BOTH signals ---
  process.env.FOUNDER_INVITE_ENABLED = "true";
  check("enabled but no configured hash => still null (no default)", invite.getFounderInviteHash() === null);
  process.env.FOUNDER_INVITE_CODE_SHA256 = "not-a-hash";
  check("enabled + malformed hash => null", invite.getFounderInviteHash() === null);

  const testCode = "s3cure-founder-code-9f3a";
  process.env.FOUNDER_INVITE_CODE_SHA256 = sha256hex(testCode);
  check("enabled + valid configured hash => matches the configured code", invite.founderInviteCodeMatches(testCode));
  check("enabled + valid configured hash => still rejects the brand word", !invite.founderInviteCodeMatches("lazyboikoi"));
  check("only 'true' enables (FOUNDER_INVITE_ENABLED=1 does not)", (() => {
    process.env.FOUNDER_INVITE_ENABLED = "1";
    const off = invite.getFounderInviteHash() === null;
    process.env.FOUNDER_INVITE_ENABLED = "true";
    return off;
  })());
  check("rejects non-string input", !invite.founderInviteCodeMatches(null));
  check("fails closed when hash is explicitly null", !invite.founderInviteCodeMatches(testCode, null));

  // --- tier lowered to entry 'reset', and mint/sign integrity intact ---
  check("FOUNDER_INVITE_TIER lowered to 'reset'", invite.FOUNDER_INVITE_TIER === "reset");

  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const license = invite.mintFounderInviteLicense(privateB64, 1_752_600_000, "founder-regression");
  const verified = await verifyLicenseKey(license, publicB64);
  check("mints a signed founder license", typeof license === "string" && license.startsWith("CF1."));
  check("founder license now unlocks the entry 'reset' tier (not job-search)", verified.ok && verified.payload.tier === "reset");
  check("founder license carries a support-safe reference", verified.ok && verified.payload.ref === "founder-regression");
  check("minting fails closed without the signing key", invite.mintFounderInviteLicense(null) === null);
  resetInviteEnv();
}

/* ============================ 2. quota / cap ============================== */
{
  const { load } = makeLoader();
  const store = load(path.join(root, "src/lib/server/fulfillment-store.ts"));
  const quota = load(path.join(root, "src/lib/server/founder-invite-quota.ts"));

  resetInviteEnv();
  // No durable store => refuse rather than mint blind.
  const noStore = await quota.reserveFounderInvite(null);
  check("quota: no durable store => refused", !noStore.allowed && noStore.reason === "no_durable_store");

  // Lifetime cap.
  process.env.FOUNDER_INVITE_MAX_TOTAL = "2";
  process.env.FOUNDER_INVITE_MAX_PER_HOUR = "100";
  const cap = new store.MemoryFulfillmentStore();
  const a = await quota.reserveFounderInvite(cap);
  const b = await quota.reserveFounderInvite(cap);
  const c = await quota.reserveFounderInvite(cap);
  check("quota: under cap allowed, remaining decrements", a.allowed && a.remaining === 1 && b.allowed && b.remaining === 0);
  check("quota: lifetime cap enforced (3rd refused)", !c.allowed && c.reason === "total_cap_reached");

  // Per-window rate limit.
  process.env.FOUNDER_INVITE_MAX_TOTAL = "100";
  process.env.FOUNDER_INVITE_MAX_PER_HOUR = "2";
  const rl = new store.MemoryFulfillmentStore();
  await quota.reserveFounderInvite(rl);
  await quota.reserveFounderInvite(rl);
  const throttled = await quota.reserveFounderInvite(rl);
  check("quota: per-hour rate limit enforced", !throttled.allowed && throttled.reason === "rate_limited");
  resetInviteEnv();
}

/* ======================= 3. route handler (end-to-end) =================== */
// Stubs isolate the route from next/server and the async sell-verdict gate so we
// can exercise its full control flow deterministically (no DB, no Stripe, no Next).
function loadRoute({ canSellSafely }) {
  const nextServerStub = {
    NextResponse: { json: (body, init) => ({ status: (init && init.status) || 200, body }) },
  };
  const readinessStub = { sellVerdict: async () => ({ canSellSafely, blockers: canSellSafely ? [] : ["not ready"] }) };
  const commerceLogStub = { logCommerceEvent: () => {} };
  const { load } = makeLoader({
    "next/server": nextServerStub,
    "@/lib/server/fulfillment-readiness": readinessStub,
    "@/lib/server/commerce-log": commerceLogStub,
  });
  // Share ONE fulfillment-store instance between the route's quota module and the
  // test so an injected MemoryStore is visible to reserveFounderInvite().
  const store = load(path.join(root, "src/lib/server/fulfillment-store.ts"));
  const route = load(path.join(root, "src/app/api/invite/route.ts"));
  return { route, store };
}
const req = (code) => ({ json: async () => ({ code }) });

// 3a. Default env (feature OFF) => the executed attack POST {code:"lazyboikoi"} is 403.
{
  resetInviteEnv();
  const { route } = loadRoute({ canSellSafely: true });
  const res = await route.POST(req("lazyboikoi"));
  check("route: default env rejects 'lazyboikoi' with 403 (backdoor closed E2E)", res.status === 403);
}

// 3b. Valid code but NOT sell-safe => 503 (human sell-approval gate is wired).
{
  resetInviteEnv();
  const code = "s3cure-founder-code-9f3a";
  process.env.FOUNDER_INVITE_ENABLED = "true";
  process.env.FOUNDER_INVITE_CODE_SHA256 = sha256hex(code);
  const { route } = loadRoute({ canSellSafely: false });
  const res = await route.POST(req(code));
  check("route: valid code but not sell-safe => 503 not_sell_safe", res.status === 503 && res.body.code === "not_sell_safe");
}

// 3c. Valid code + sell-safe + signing key + durable store => 200 mint of 'reset'.
{
  resetInviteEnv();
  const code = "s3cure-founder-code-9f3a";
  process.env.FOUNDER_INVITE_ENABLED = "true";
  process.env.FOUNDER_INVITE_CODE_SHA256 = sha256hex(code);
  process.env.FOUNDER_INVITE_MAX_TOTAL = "1"; // also lets us prove the cap end-to-end
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.LICENSE_SIGNING_PRIVATE_KEY = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");

  const { route, store } = loadRoute({ canSellSafely: true });
  store.__setFulfillmentStoreForTests(new store.MemoryFulfillmentStore());

  const ok = await route.POST(req(code));
  check("route: sell-safe mint returns 200", ok.status === 200);
  check("route: minted tier is 'reset' (not job-search)", ok.body.tier === "reset");
  check("route: returns a signed CF1 entitlement", typeof ok.body.signedEntitlement === "string" && ok.body.signedEntitlement.startsWith("CF1."));
  check("route: package name is the Career Reset Pack", ok.body.packageName === "Career Reset Pack");

  const capped = await route.POST(req(code));
  check("route: second mint over the cap => 429 total_cap_reached", capped.status === 429 && capped.body.code === "total_cap_reached");

  delete process.env.LICENSE_SIGNING_PRIVATE_KEY;
  resetInviteEnv();
}

// 3d. Malformed body => 400.
{
  resetInviteEnv();
  const { route } = loadRoute({ canSellSafely: true });
  const res = await route.POST({ json: async () => { throw new Error("bad json"); } });
  check("route: malformed body => 400", res.status === 400);
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
