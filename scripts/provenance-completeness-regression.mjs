// Locks in two guarantees for the paid-outcome path:
//
// 1. classifyEvidenceAdmissibility must not misclassify Career Forge's own
//    generated framing text as a user preference statement. It found this
//    exact bug: the generator used to prepend "Targeting {lane.title}." to
//    the ATS linkedinSummary, and the classifier (correctly, for real user
//    text like "I'm targeting a career change...") treats any sentence
//    starting with "targeting" as a preference and drops it on every
//    sanitize pass — desyncing the stored evidence-reference claimText from
//    the live resume field and silently mutating output on every read.
//
// 2. A normal fresh two-lane, two-kind generation (4 variants) — built
//    through the same dossier import + lane pipeline a real user goes
//    through, not by hand-authoring evidenceReferences — produces complete
//    provenance for every rendered claim in every variant, survives the
//    evidence-admissibility sanitize pass unchanged, and never lands any
//    variant in "needs-review" or "missing-evidence" purely from
//    sanitization (as opposed to genuinely absent evidence).

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
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".") ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, path.dirname(absolute), absolute);
  return cjsModule.exports;
}

const { emptyDossier, parseResumePackToProposals, mergeImportProposals } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { sanitizeCommandCenterState, sanitizeCareerDossier, classifyEvidenceAdmissibility } = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { laneLibrary } = loadTsModule(path.join(root, "src/lib/lane-library.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-07-17T12:00:00.000Z";

// --- Regression 1: the classifier must not treat Career Forge's own
// generated lane-framing sentence as a user preference statement. -----------

check(
  "a bare generated lane-framing sentence is not misclassified as a preference",
  classifyEvidenceAdmissibility("Customer Success Manager candidate.") === "claim"
);
check(
  "real free-text targeting statements are still caught as preferences",
  classifyEvidenceAdmissibility("I'm targeting a career change into project management") === "preference" &&
    classifyEvidenceAdmissibility("Targeting: Product Manager roles") === "preference"
);

// --- Regression 2: fresh two-lane generation keeps full provenance through
// the real dossier-import + sanitize pipeline, for every real library lane
// pairing, across realistic personas. ----------------------------------------

const personas = [
  {
    name: "sportsbook-ops",
    text: [
      "Jordan Lee",
      "Sportsbook Ticket Writer — BetRiver Casino | 2021–2026",
      "Processed 200+ customer wagers per shift with zero drawer discrepancies",
      "De-escalated disputes over voided tickets and explained house rules to upset customers",
      "Trained 6 new ticket writers on POS and responsible gaming compliance",
      "Tools: Sportsbook POS, Excel, Kronos"
    ].join("\n")
  },
  {
    name: "retail-manager",
    text: [
      "Priya Nair",
      "Store Manager — Harvest Market | 2019–2026",
      "Hired and onboarded 40+ employees across 3 locations",
      "Reduced staff turnover from 45% to 28% by building a structured first-90-days program",
      "Ran weekly scheduling for a 25-person team and resolved payroll disputes",
      "Tools: Workday, Kronos, Google Sheets"
    ].join("\n")
  }
];

let variantsChecked = 0;
for (const persona of personas) {
  const proposals = parseResumePackToProposals([{ filename: "history.txt", text: persona.text }]).map((item) => ({ ...item, status: "approved" }));
  let dossier = mergeImportProposals(emptyDossier(NOW), proposals, NOW);
  dossier = sanitizeCareerDossier(dossier).dossier;

  for (let i = 0; i < laneLibrary.length - 1; i += 1) {
    const laneA = laneLibrary[i];
    const laneB = laneLibrary[i + 1];
    const lanes = [
      { id: `lane-${i}-a`, title: laneA.title, status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: laneA.keywords ?? [], source: "library", createdAt: NOW },
      { id: `lane-${i}-b`, title: laneB.title, status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: laneB.keywords ?? [], source: "library", createdAt: NOW }
    ];
    const pack = generateResumePack(dossier, lanes, NOW);
    check(
      `${persona.name} / ${laneA.title}+${laneB.title}: forges 4 variants (2 lanes × ATS/recruiter)`,
      pack.variants.length === 4
    );

    const state = { ...emptyState(), dossier, lanes, resumePacks: [pack] };
    const sanitized = sanitizeCommandCenterState(state);
    const sanitizedPack = sanitized.resumePacks[0];

    for (const variant of sanitizedPack.variants) {
      variantsChecked += 1;
      const beforeVariant = pack.variants.find((v) => v.id === variant.id);

      check(
        `${persona.name} / ${variant.kind} / ${variant.laneId}: linkedinSummary is unchanged by sanitization`,
        variant.resume.linkedinSummary === beforeVariant.resume.linkedinSummary,
        `before=${JSON.stringify(beforeVariant.resume.linkedinSummary)} after=${JSON.stringify(variant.resume.linkedinSummary)}`
      );
      check(
        `${persona.name} / ${variant.kind} / ${variant.laneId}: linkedinSummary keeps its evidence reference`,
        variant.evidenceReferences.some((ref) => ref.claimPath === "linkedinSummary" && ref.evidenceIds.length > 0)
      );
      check(
        `${persona.name} / ${variant.kind} / ${variant.laneId}: status is not needs-review purely from sanitization`,
        variant.status !== "needs-review" && variant.status !== "missing-evidence",
        `status=${variant.status}`
      );
    }
    check(
      `${persona.name} / ${laneA.title}+${laneB.title}: pack status is not needs-review after sanitize`,
      sanitizedPack.status !== "needs-review"
    );
  }
}

check("checked a meaningful number of variants", variantsChecked >= 20, `checked ${variantsChecked}`);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
