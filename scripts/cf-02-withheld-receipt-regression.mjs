// CF-02 — separation-reason leak + falsely-clean receipt (red-team Moderate).
//
// Proves: (a) the phrasings that bypassed the strict guard are now stripped and
// counted; (b) exportSections no longer reports "nothing withheld" when a
// separation reason is present; (c) softer, unclassifiable end-of-employment
// context is surfaced as a review flag instead of a false all-clear; and
// (d) ordinary résumé content is neither stripped nor flagged (no over-reach).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function load(fp) {
  const abs = path.resolve(fp);
  if (cache.has(abs)) return cache.get(abs).exports;
  const src = fs.readFileSync(abs, "utf8");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: abs,
  });
  const m = { exports: {} };
  cache.set(abs, m);
  const dir = path.dirname(abs);
  const lr = (r) => {
    if (r.startsWith("@/")) return load(path.join(root, "src", r.slice(2) + ".ts"));
    if (r.startsWith(".")) return load(path.resolve(dir, r.endsWith(".ts") ? r : r + ".ts"));
    return require(r);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(lr, m, m.exports, dir, abs);
  return m.exports;
}

const tg = load(path.join(root, "src/lib/truth-guards.ts"));
const { exportSections } = load(path.join(root, "src/lib/pack-export.ts"));

let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; console.log(`PASS ${label}`); } else { fail++; console.error(`FAIL ${label}`); } };

// (a) The red-team bypass phrasings are now DEFINITE termination reasons.
const bypasses = [
  "Managed vendor contracts worth $2M annually until the company ran out of funding. My position was cut in June 2026.",
  "Senior PM role sunset when priorities shifted.",
  "They eliminated my seat during Q2.",
  "Left after being pushed out in the reorg.",
  "Took a severance package after the department was dissolved.",
  "My contract was not renewed after the acquisition.",
];
for (const t of bypasses) {
  const r = tg.stripTerminationReasons(t);
  check(`strips + withholds: "${t.slice(0, 42)}…"`, r.withheld === true);
}

// (b) Receipt honesty: a resume carrying a separation reason reports it withheld.
const mkResume = (summary) => ({
  summary,
  coreSkills: ["Product Strategy", "SQL"],
  experience: [{ title: "Senior PM", company: "Acme", time: "2023–2026", bullets: ["Shipped v2"], kind: "role" }],
  education: "B.S. Computer Science",
  linkedinHeadline: "PM",
  linkedinSummary: "",
});
const leaky = exportSections(mkResume("Drove roadmap until my position was cut in the layoffs."));
check("receipt: withheldFacts populated when a separation reason is present", leaky.withheldFacts.length === 1 && leaky.withheldFacts[0] === "reason for leaving");
check("receipt: separation reason does NOT appear in exported summary", !JSON.stringify(leaky.sections).toLowerCase().includes("position was cut"));

// (c) Uncertainty: soft/unclassified context is flagged for review, not silently cleared.
check("soft cue flagged: 'no longer with the company'", tg.hasPossibleSeparationContext("Contributed to launches; no longer with the company as of 2026."));
check("soft cue flagged: 'parted ways'", tg.hasPossibleSeparationContext("We parted ways in early 2026."));
const uncertain = exportSections(mkResume("Led analytics after the 2026 reorg reshuffled the team."));
check("receipt: reviewFlags surfaced for possible separation context", uncertain.reviewFlags.length === 1);

// (d) No over-reach: ordinary résumé content is neither stripped nor flagged.
const legit = [
  "Cut cloud infrastructure costs by 30% through rightsizing.",
  "Managed a cross-functional team of 12 engineers.",
  "Eliminated 200 hours of manual reporting per quarter.",
  "Led the migration of the payments platform to Kubernetes.",
];
for (const t of legit) {
  check(`no false strip: "${t.slice(0, 40)}…"`, tg.stripTerminationReasons(t).withheld === false);
}
const clean = exportSections(mkResume("Grew ARR from $2M to $9M by leading a new enterprise motion."));
check("receipt: clean pack reports nothing withheld AND nothing to review", clean.withheldFacts.length === 0 && clean.reviewFlags.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
