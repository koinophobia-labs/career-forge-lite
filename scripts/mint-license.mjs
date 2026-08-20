// Manually mints a Career Forge license key — for support replacements,
// review copies, or owner QA. Usage:
//
//   LICENSE_SIGNING_PRIVATE_KEY=... node scripts/mint-license.mjs <tier> [ref]
//   LICENSE_SIGNING_PRIVATE_KEY=... node scripts/mint-license.mjs --tier <tier> --session <cs_...> [--issued-at <unix>]
//
// tier: resume | job | career | all-access
// ref:  optional purchase reference shown in support conversations (default "manual")

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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

const { isPackageTier } = loadTsModule(path.join(root, "src/lib/packages.ts"));
const { mintLicenseKey } = loadTsModule(path.join(root, "src/lib/server/license-mint.ts"));

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const tier = option("--tier") ?? process.argv[2];
const ref = option("--session") ?? option("--ref") ?? (process.argv.includes("--tier") ? "manual" : process.argv[3]) ?? "manual";
const issuedAtInput = option("--issued-at");
const issuedAt = issuedAtInput === null ? Math.floor(Date.now() / 1000) : Number(issuedAtInput);

if (!isPackageTier(tier)) {
  console.error("Usage: node scripts/mint-license.mjs <resume|job|career|all-access> [ref]");
  console.error("   or: node scripts/mint-license.mjs --tier <tier> --session <cs_...> [--issued-at <unix>]");
  process.exit(1);
}
if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) {
  console.error("--issued-at must be a positive Unix timestamp.");
  process.exit(1);
}
if (tier === "all-access" && issuedAtInput === null) {
  console.error("All Access recovery requires --issued-at from the Stripe Session creation time so expiry is not extended.");
  process.exit(1);
}
if (!process.env.LICENSE_SIGNING_PRIVATE_KEY) {
  console.error("LICENSE_SIGNING_PRIVATE_KEY is not set. Generate one with scripts/generate-license-keys.mjs");
  process.exit(1);
}

const license = mintLicenseKey(tier, ref, issuedAt);
if (!license) {
  console.error("Minting failed — is LICENSE_SIGNING_PRIVATE_KEY a valid base64 PKCS8 P-256 key?");
  process.exit(1);
}
console.log(license);
