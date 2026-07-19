import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".")
      ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`))
      : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(
    localRequire,
    cjsModule,
    cjsModule.exports,
    path.dirname(absolute),
    absolute
  );
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

const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const nav = source("src/components/CommandNav.tsx");
const routerComponent = source("src/components/IntentRouter.tsx");
const routerLogic = source("src/lib/intent-router.ts");
const founding = source("src/app/founding-beta/page.tsx");

check("desktop navigation exposes four plain primary destinations", ["Today", "My Résumé", "Applications", "Interview"].every((label) => nav.includes(`[\"${label}\"`) || nav.includes(`["${label}"`)));
check("advanced workflow tools are grouped behind More", nav.includes("const moreStations") && /<summary[\s\S]*?>\s*More\s*<\/summary>/.test(nav) && nav.includes("Data & Backup"));
check("first-run router promises one clear next step", routerComponent.includes("One choice. One clear next step.") && routerComponent.includes("take you directly to the right starting point"));
check("returning progress uses plain-language milestones", ["Work history added", "Facts reviewed", "Target role chosen", "Résumé ready"].every((label) => routerLogic.includes(label)));
check("founding cohort routes to live pricing checkout", founding.includes('href="/pricing"') && founding.includes("Secure checkout is live"));
check("founding cohort no longer uses a mail application", !founding.includes("mailto:") && !founding.includes("Automated checkout is being finalized"));

const { createPendingImportReview } = loadTsModule(path.join(root, "src/lib/truth-inbox.ts"));
const proposal = (overrides = {}) => ({
  id: "proposal-1",
  group: "employment",
  kind: "role",
  label: "Employment record",
  detail: "Customer Support Specialist — Northstar Software — 2021–2026",
  sourceFilenames: ["resume.txt"],
  sourceExcerpts: ["Customer Support Specialist — Northstar Software — 2021–2026"],
  confidence: "high",
  status: "proposed",
  edited: false,
  likelyDuplicateOf: null,
  ...overrides
});
const review = createPendingImportReview("review-1", [
  proposal(),
  proposal({ id: "proposal-2", kind: "metric", group: "metrics-outcomes", detail: "Improved performance by 40%" }),
  proposal({ id: "proposal-3", kind: "skill", group: "skills", detail: "Incident response", confidence: "low" }),
  proposal({ id: "proposal-4", kind: "tool", group: "tools", detail: "Zendesk", status: "rejected" })
], "2026-07-19T16:00:00.000Z", false);

check("clear high-confidence facts are preselected", review.proposals.find((item) => item.id === "proposal-1")?.status === "approved");
check("metrics still require individual review", review.proposals.find((item) => item.id === "proposal-2")?.status === "proposed");
check("low-confidence facts still require individual review", review.proposals.find((item) => item.id === "proposal-3")?.status === "proposed");
check("explicit user decisions are never overwritten", review.proposals.find((item) => item.id === "proposal-4")?.status === "rejected");
check("filename privacy remains intact", review.sourceFilenames.length === 0 && review.proposals.every((item) => item.sourceFilenames.length === 0));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
