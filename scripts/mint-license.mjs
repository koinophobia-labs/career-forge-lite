// Manually mints a Career Forge license key — for support replacements,
// review copies, or owner QA. Usage:
//
//   LICENSE_SIGNING_PRIVATE_KEY=... node scripts/mint-license.mjs <tier> [ref]
//
// tier: reset | job-search | career-switch
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

const tier = process.argv[2];
const ref = process.argv[3] ?? "manual";

if (!isPackageTier(tier)) {
  console.error("Usage: node scripts/mint-license.mjs <reset|job-search|career-switch> [ref]");
  process.exit(1);
}
if (!process.env.LICENSE_SIGNING_PRIVATE_KEY) {
  console.error("LICENSE_SIGNING_PRIVATE_KEY is not set. Generate one with scripts/generate-license-keys.mjs");
  process.exit(1);
}

const license = mintLicenseKey(tier, ref, Math.floor(Date.now() / 1000));
if (!license) {
  console.error("Minting failed — is LICENSE_SIGNING_PRIVATE_KEY a valid base64 PKCS8 P-256 key?");
  process.exit(1);
}
console.log(license);
