// Founder invite integrity: code comparison, disable/override behavior, and
// distinct Job Search license minting without exposing the signing key.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
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

const invite = loadTsModule(path.join(root, "src/lib/server/founder-invite.ts"));
const { verifyLicenseKey } = loadTsModule(path.join(root, "src/lib/license.ts"));

check("accepts the founder code", invite.founderInviteCodeMatches("lazyboikoi"));
check("accepts harmless case and whitespace differences", invite.founderInviteCodeMatches("  LazyBoiKoi  "));
check("rejects the wrong code", !invite.founderInviteCodeMatches("lazyboikoi2"));
check("rejects non-string input", !invite.founderInviteCodeMatches(null));
check("fails closed when disabled", !invite.founderInviteCodeMatches("lazyboikoi", null));

const originalConfiguredHash = process.env.FOUNDER_INVITE_CODE_SHA256;
process.env.FOUNDER_INVITE_CODE_SHA256 = "not-a-hash";
check("rejects malformed configured hashes", invite.getFounderInviteHash() === null);
if (originalConfiguredHash === undefined) delete process.env.FOUNDER_INVITE_CODE_SHA256;
else process.env.FOUNDER_INVITE_CODE_SHA256 = originalConfiguredHash;

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const license = invite.mintFounderInviteLicense(privateB64, 1_752_600_000, "founder-regression");
const verified = await verifyLicenseKey(license, publicB64);
check("mints a signed founder license", typeof license === "string" && license.startsWith("CF1."));
check("founder license unlocks Job Search", verified.ok && verified.payload.tier === "job-search");
check("founder license carries a support-safe reference", verified.ok && verified.payload.ref === "founder-regression");
check("minting fails closed without the signing key", invite.mintFounderInviteLicense(null) === null);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
