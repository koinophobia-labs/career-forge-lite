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

const { primaryStations, secondaryStations } = loadTsModule(path.join(root, "src/lib/nav-stations.ts"));

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

// --- Primary nav: exactly the five core workflow stations -------------------

const expectedPrimary = [
  ["Today", "/"],
  ["Tailor", "/tailor"],
  ["Applications", "/applications"],
  ["Outreach", "/outreach"],
  ["Interview", "/interview"]
];
check(
  "primary nav is exactly the five core routes, in order",
  JSON.stringify(primaryStations) === JSON.stringify(expectedPrimary),
  JSON.stringify(primaryStations)
);

// --- Secondary nav: support routes present, none promoted -------------------

const secondaryHrefs = secondaryStations.map(([, href]) => href);
for (const href of ["/profile", "/targets", "/versions", "/resume-builder", "/weekly", "/settings"]) {
  check(`secondary nav contains ${href}`, secondaryHrefs.includes(href));
}
check("Resume Builder remains accessible from nav", secondaryHrefs.includes("/resume-builder"));
check("Data/settings remains accessible for backup safety", secondaryHrefs.includes("/settings"));

const primaryHrefs = primaryStations.map(([, href]) => href);
check(
  "no station appears in both tiers",
  primaryHrefs.every((href) => !secondaryHrefs.includes(href))
);

// --- Every nav href resolves to a real route file ---------------------------

function routeFileFor(href) {
  return href === "/" ? path.join(root, "src/app/page.tsx") : path.join(root, "src/app", href.slice(1), "page.tsx");
}

for (const [label, href] of [...primaryStations, ...secondaryStations]) {
  check(`nav "${label}" (${href}) resolves to an existing page file`, fs.existsSync(routeFileFor(href)));
}

// --- No existing route was deleted (full inventory, including off-nav) ------

const allRoutes = [
  "/",
  "/weekly",
  "/profile",
  "/targets",
  "/tailor",
  "/applications",
  "/outreach",
  "/resume-builder",
  "/versions",
  "/versions/view",
  "/interview",
  "/story",
  "/settings"
];
for (const route of allRoutes) {
  check(`route ${route} still exists`, fs.existsSync(routeFileFor(route)));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
