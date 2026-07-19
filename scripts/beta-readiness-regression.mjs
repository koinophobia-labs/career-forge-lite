// Beta-readiness sprint regression: the three primary paths' guarantees.
//   1. Update My Résumé   — imported evidence yields an early-win preview.
//   2. Build My First Résumé — one manually-added role yields a preview.
//   3. Practice Interview  — generic prep questions exist with an empty profile.
// Plus: the early-win preview never invents claims, and beta feedback persists
// and asks only once per milestone.
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

// Minimal browser shim so the localStorage-backed feedback store runs in node.
const memory = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key)
  },
  dispatchEvent: () => true
};
globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };

const store = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const dossierLib = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const earlyWin = loadTsModule(path.join(root, "src/lib/early-win.ts"));
const feedback = loadTsModule(path.join(root, "src/lib/beta-feedback-store.ts"));
const prep = loadTsModule(path.join(root, "src/lib/interview-prep.ts"));

const NOW = "2026-07-19T12:00:00.000Z";
let passed = 0;
function check(label, condition) { if (!condition) throw new Error(`FAIL ${label}`); passed += 1; console.log(`PASS ${label}`); }

function dossierWith(records, extra = {}) {
  const base = dossierLib.emptyDossier(NOW);
  return { ...base, evidence: records, ...extra };
}

// --- Path 1: Update My Résumé — imported bullets become an early-win preview ---
const imported = [
  dossierLib.evidenceRecord("role", "Senior Operations Coordinator, Meridian Logistics — 2021 to 2024", "resume-import", true, NOW),
  dossierLib.evidenceRecord("metric", "Managed a team of 6 dispatchers and reduced late deliveries by 22% over 18 months", "resume-import", true, NOW),
  dossierLib.evidenceRecord("proof", "Built a weekly KPI dashboard in Excel that leadership used to track on-time rates", "resume-import", true, NOW),
  dossierLib.evidenceRecord("proof", "Coordinated with warehouse and carrier partners to resolve routing exceptions", "resume-import", true, NOW)
];
const importedDossier = dossierWith(imported, { roles: [{ id: "r1", title: "Senior Operations Coordinator", employer: "Meridian Logistics", startDate: "2021", endDate: "2024", current: false, responsibilities: [], evidenceIds: [] }] });
const win1 = earlyWin.earlyWinBullets(importedDossier);
check("update-resume: import produces an early-win preview", win1 !== null && win1.bullets.length >= 2);
check("update-resume: preview is capped at three bullets", win1.bullets.length <= 3);
check("update-resume: preview names the source experience", win1.source.includes("Senior Operations Coordinator"));
// Truthfulness: every preview bullet must trace to a substring of approved input.
const approvedText = imported.filter((e) => ["metric", "proof", "responsibility"].includes(e.kind)).map((e) => e.detail.toLowerCase());
const invented = win1.bullets.filter((bullet) => {
  const core = bullet.replace(/[.]+$/, "").toLowerCase();
  // Allow the polisher's opening-verb diversification: match on the distinctive tail.
  const tail = core.split(" ").slice(1).join(" ");
  return !approvedText.some((src) => src.includes(tail.slice(0, 24)));
});
check("update-resume: preview invents no bullet without approved backing", invented.length === 0);

// --- Path 2: Build My First Résumé — a single manual role yields a preview ---
const firstRoleDossier = dossierWith(
  [dossierLib.evidenceRecord("role", "Barista — Grind House", "manual", true, NOW)],
  { roles: [{ id: "r2", title: "Barista", employer: "Grind House", startDate: "2023", endDate: "", current: true, responsibilities: ["Trained four new hires on espresso workflow and open/close procedures", "Handled the morning rush register while keeping wait times under three minutes"], evidenceIds: [] }] }
);
const win2 = earlyWin.earlyWinBullets(firstRoleDossier);
check("first-resume: one role with detail produces a preview", win2 !== null && win2.bullets.length >= 1);
check("first-resume: empty dossier produces no preview", earlyWin.earlyWinBullets(dossierWith([])) === null);
check("first-resume: a role with no responsibilities produces no invented preview", earlyWin.earlyWinBullets(dossierWith([], { roles: [{ id: "r3", title: "Clerk", employer: "", startDate: "", endDate: "", current: false, responsibilities: [], evidenceIds: [] }] })) === null);

// --- Path 3: Practice Interview — generic prep works with an empty profile ---
const emptyProfile = store.emptyProfile();
const pack = prep.generateInterviewPrep(emptyProfile, null, null, dossierLib.emptyDossier(NOW));
const recruiterQuestions = prep.questionsForInterviewRound(pack.questions, "recruiter");
check("practice-interview: recruiter round has questions with no profile", recruiterQuestions.length >= 1);
check("practice-interview: reverse questions exist with no profile", pack.reverseQuestions.length >= 1);
check("practice-interview: every round resolves to concrete categories", ["recruiter", "behavioral", "technical", "final"].every((round) => prep.categoriesForInterviewRound(round).length > 0));

// --- Beta feedback capture: persists, validates, asks once per milestone ---
memory.clear();
check("feedback: nothing submitted for a fresh milestone", feedback.hasSubmittedBetaFeedback("pack") === false);
check("feedback: a completed entry saves", feedback.saveBetaFeedbackEntry({ milestone: "pack", easier: "yes", blocker: "lane names", wouldUseAgain: "maybe", testimonial: "fast and honest" }) === true);
const loaded = feedback.loadBetaFeedback();
check("feedback: saved entry round-trips with every field", loaded.length === 1 && loaded[0].easier === "yes" && loaded[0].wouldUseAgain === "maybe" && loaded[0].blocker === "lane names" && loaded[0].testimonial === "fast and honest" && loaded[0].milestone === "pack");
check("feedback: milestone is marked answered so the prompt never nags twice", feedback.hasSubmittedBetaFeedback("pack") === true);
check("feedback: whitespace-only optional fields normalize to empty", (() => { feedback.saveBetaFeedbackEntry({ milestone: "export", easier: "same", blocker: "   ", wouldUseAgain: "no", testimonial: "  " }); const e = feedback.loadBetaFeedback().find((x) => x.milestone === "export"); return e.blocker === "" && e.testimonial === ""; })());
// A corrupt payload must never crash the reader (fail-open to empty).
globalThis.window.localStorage.setItem(feedback.BETA_FEEDBACK_KEY, "{not-json");
check("feedback: corrupt storage reads as empty rather than throwing", Array.isArray(feedback.loadBetaFeedback()) && feedback.loadBetaFeedback().length === 0);

console.log(`\nBeta-readiness regression: ${passed} checks passed.`);
