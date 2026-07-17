// Pilot-summary regression: the founding-user pilot export must carry correct
// timings/counts and can never contain résumé content — the content guard has
// to fail closed if the shape ever grows a content-bearing field.
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
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { buildPilotSummary, pilotSummaryContainsContent } = loadTsModule(path.join(root, "src/lib/pilot-metrics.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const T0 = "2026-07-01T10:00:00.000Z";
const T1 = "2026-07-01T10:25:00.000Z";
const T2 = "2026-07-01T11:40:00.000Z";
const SECRET = "Extremely identifying employer name: Meridian Logistics";

const approvedEv = { ...evidenceRecord("proof", SECRET, "manual", true, T0, { label: "Proof" }), createdAt: T0, updatedAt: T1 };
const state = {
  ...emptyState(),
  dossier: { ...emptyState().dossier, createdAt: T0, evidence: [approvedEv] },
  lanes: [{ id: "lane-1", title: "Lane", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: T0 }],
  resumePacks: [{
    id: "pack-1", dossierId: "d", status: "needs-review", lanePacks: [],
    variants: [{ id: "v1", laneId: "lane-1", kind: "ats", title: "T", status: "current", canonical: true, userEdited: true, resume: { summary: SECRET, coreSkills: [], experience: [], education: "", linkedinHeadline: "", linkedinSummary: "" }, template: "Modern ATS", evidenceReferences: [], userAuthoredPaths: ["summary", "education"], sectionOrder: ["summary", "skills", "experience", "projects", "education"], sourceDossierUpdatedAt: T0, baselineVariantId: null, applicationId: null, createdAt: T0, updatedAt: T0 }],
    linkedinHeadlines: [], linkedinAbout: "", linkedinSkills: [], masterProofBank: [], coverLetterFoundation: "",
    receipt: { id: "r", generatedAt: T0, evidenceUsed: [], evidenceOmitted: [], laneFraming: [], keywordsIncluded: [], gapsAvoided: [], unsupportedClaimsRefused: ["refused-1", "refused-2"], transferredClaims: [], gapsLeftUnclaimed: [] },
    createdAt: T1, updatedAt: T1
  }],
  exports: [{ id: "e1", packId: "pack-1", formats: ["pdf"], filenames: ["a.pdf", "a.docx"], exportedAt: T2 }]
};

const summary = buildPilotSummary(state, T2);

check("time to first approved evidence is computed in minutes", summary.journey.minutesFromStartToFirstApprovedEvidence === 25, JSON.stringify(summary.journey));
check("time to first export is computed in minutes", summary.journey.minutesFromStartToFirstExport === 100, JSON.stringify(summary.journey));
check("counts reflect edits, exports, and refused claims", summary.counts.userEditedVariants === 1 && summary.counts.userEditedFieldPaths === 2 && summary.counts.exportedFiles === 2 && summary.integrity.claimsRefusedByGenerator === 2, JSON.stringify(summary));
check("summary JSON contains no résumé content", !JSON.stringify(summary).includes("Meridian") && !JSON.stringify(summary).includes(SECRET));
check("content guard passes a clean summary", pilotSummaryContainsContent(summary) === false);
check("content guard fails closed when a content field sneaks into the shape", pilotSummaryContainsContent({ ...summary, extra: { detail: "leaked claim text" } }) === true);
check("content guard fails closed on nested résumé objects", pilotSummaryContainsContent({ ...summary, deep: [{ nested: { resume: {} } }] }) === true);

const empty = buildPilotSummary(emptyState(), T2);
check("empty state produces null timings, zero counts, and no crash", empty.journey.minutesFromStartToFirstExport === null && empty.counts.approvedEvidence === 0);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
