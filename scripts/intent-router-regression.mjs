import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} }; cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/") ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`)) : request.startsWith(".") ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const store = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const dossier = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const router = loadTsModule(path.join(root, "src/lib/intent-router.ts"));
const backup = loadTsModule(path.join(root, "src/lib/backup.ts"));
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const NOW = "2026-07-16T12:00:00.000Z";
let passed = 0;
function check(label, condition) { if (!condition) throw new Error(`FAIL ${label}`); passed += 1; console.log(`PASS ${label}`); }

const empty = store.emptyState();
check("fresh state has no active goal", empty.activeGoal === null && router.isIntentFirstRun(empty));
check("legacy state revives without inventing a goal", store.parseState(JSON.stringify({ profile: store.emptyProfile() })).activeGoal === null);
check("unknown goal fails closed", store.parseState(JSON.stringify({ ...empty, activeGoal: { kind: "be-famous", selectedAt: NOW, updatedAt: NOW } })).activeGoal === null);
const selected = { ...empty, activeGoal: { kind: "career-change", selectedAt: NOW, updatedAt: NOW } };
check("valid goal persists across serialization", store.parseState(JSON.stringify(selected)).activeGoal.kind === "career-change");
check("router offers five distinct meaningful goals", router.CAREER_GOALS.length === 5 && new Set(router.CAREER_GOALS.map((item) => item.kind)).size === 5 && router.CAREER_GOALS.every((item) => item.description.length > 20));
check("goal choices materially change workflow entry", router.goalEntryAction(empty, "practice-interview").href === "/interview" && router.goalEntryAction(empty, "first-resume").href === "/profile#manual-history");
check("evidence is explained before import", router.goalEntryAction(empty, "new-job").detail.includes("explain") && router.goalEntryAction(empty, "new-job").href === "/profile#import");

const evidence = [dossier.evidenceRecord("role", "Support Specialist — Northstar · 2021–2026", "manual", true, NOW), dossier.evidenceRecord("responsibility", "Resolved difficult customer issues", "manual", true, NOW), dossier.evidenceRecord("metric", "Maintained 40 troubleshooting articles", "manual", true, NOW)];
const ready = { ...selected, dossier: { ...empty.dossier, evidence, approvedClaims: evidence.map((item) => item.detail), responsibilities: [evidence[1].detail], metrics: [evidence[2].detail], proofPoints: [evidence[2].detail], updatedAt: NOW } };
const pending = { ...ready, pendingImportReviews: [{ id: "review", version: 1, proposals: [], sourceFileCount: 1, sourceFilenames: [], retainSourceFilenames: false, createdAt: NOW, updatedAt: NOW }] };
check("pending Truth Inbox dominates the next move", router.intentNextMove(pending).href === "/profile#review");
check("career change routes approved evidence to target selection", router.goalEntryAction(ready, "career-change").href === "/targets");
check("legacy activity infers a useful continuation", router.inferCareerGoal({ ...ready, activeGoal: null }) === "new-job" && router.careerGoalLabel({ ...ready, activeGoal: null }).includes("Job Search"));
check("milestones expose audited booleans only", router.intentMilestones(ready).every((item) => typeof item.complete === "boolean"));
const restored = backup.validateBackup(JSON.stringify(backup.createBackup(selected, NOW)));
check("backup and restore preserve active goal", restored.ok && restored.state.activeGoal.kind === "career-change");

const ui = source("src/components/IntentRouter.tsx");
const home = source("src/app/page.tsx");
const analytics = source("src/lib/analytics.ts");
check("first-run UI renders every one-tap goal", ui.includes("CAREER_GOALS.map") && ui.includes("option.label") && ui.includes("option.description") && ui.includes("What are you working toward?"));
check("returning UI has one dominant next move and recent work", ui.includes("Your next move") && ui.includes("Recent") && ui.includes("Other actions"));
check("router uses no theatrical percentage", !/%|progress-bar|progressBar/.test(ui));
check("homepage places intent before marketing and hides workspace on first run", home.indexOf("<IntentRouter") < home.indexOf('id="landing"') && home.includes("hydrated && !isFirstRun"));
check("manual first-résumé entry anchor exists", source("src/app/profile/page.tsx").includes('id="manual-history"'));
check("intent analytics remain event-name only", analytics.includes('"intent_goal_selected"') && analytics.includes('"intent_goal_resumed"') && /function trackCareerEvent\(event: CareerForgeEventName\)\s*\{\s*track\(event\)/.test(analytics));

console.log(`\n${passed} intent router regression checks passed`);
