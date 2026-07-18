// Pilot-summary regression: timings/counts remain durable after the Truth Inbox
// is completed and evidence is later edited; the export can never contain
// résumé content.
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
const { createPendingImportReview, commitTruthInboxReview } = loadTsModule(path.join(root, "src/lib/truth-inbox.ts"));
const { buildPilotSummary, pilotSummaryContainsContent } = loadTsModule(path.join(root, "src/lib/pilot-metrics.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const T0 = "2026-07-01T10:00:00.000Z";
const T1 = "2026-07-01T10:25:00.000Z";
const T2 = "2026-07-01T10:50:00.000Z";
const T3 = "2026-07-01T11:40:00.000Z";
const SECRET = "Extremely identifying employer name: Meridian Logistics";
const proposals = [
  { id: "p-proof", group: "metrics-outcomes", kind: "proof", label: "Proof", detail: SECRET, sourceFilenames: [], sourceExcerpts: [SECRET], confidence: "high", status: "approved", edited: false, likelyDuplicateOf: null },
  { id: "p-pref", group: "other", kind: "goal", label: "Target preference (context only)", detail: "Target roles: Product Operations", sourceFilenames: [], sourceExcerpts: ["Target roles: Product Operations"], confidence: "high", status: "approved", edited: false, likelyDuplicateOf: null },
  { id: "p-gap", group: "other", kind: "constraint", label: "Evidence gap (not career-material content)", detail: "No SaaS implementation experience", sourceFilenames: [], sourceExcerpts: ["No SaaS implementation experience"], confidence: "high", status: "rejected", edited: false, likelyDuplicateOf: null }
];
const batch = createPendingImportReview("review-1", proposals, T0, false);
const initial = { ...emptyState(), pendingImportReviews: [batch] };
const committed = commitTruthInboxReview(initial, batch.id, T1);
check("completed Truth Inbox is removed from the active queue", committed.completed && committed.state.pendingImportReviews.length === 0);
check("a durable content-free integrity marker remains", committed.state.dossier.migrationReview.some((item) => item.includes("2 context-only imported item(s)")));
const approvedEvidence = committed.state.dossier.evidence.map((item) => item.approved ? { ...item, updatedAt: T2 } : item);
const state = {
  ...committed.state,
  dossier: { ...committed.state.dossier, evidence: approvedEvidence },
  lanes: [{ id: "lane-1", title: "Lane", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: T1 }],
  resumePacks: [{
    id: "pack-1", dossierId: "d", status: "needs-review", lanePacks: [],
    variants: [{ id: "v1", laneId: "lane-1", kind: "ats", title: "T", status: "current", canonical: true, userEdited: true, resume: { summary: SECRET, coreSkills: [], experience: [], education: "", linkedinHeadline: "", linkedinSummary: "" }, template: "Modern ATS", evidenceReferences: [], userAuthoredPaths: ["summary", "education"], sectionOrder: ["summary", "skills", "experience", "projects", "education"], sourceDossierUpdatedAt: T1, baselineVariantId: null, applicationId: null, createdAt: T1, updatedAt: T2 }],
    linkedinHeadlines: [], linkedinAbout: "", linkedinSkills: [], masterProofBank: [], coverLetterFoundation: "",
    receipt: { id: "r", generatedAt: T1, evidenceUsed: [], evidenceOmitted: [], laneFraming: [], keywordsIncluded: [], gapsAvoided: [], unsupportedClaimsRefused: ["refused-1", "refused-2"], transferredClaims: [], gapsLeftUnclaimed: [] },
    createdAt: T1, updatedAt: T2
  }],
  exports: [{ id: "e1", packId: "pack-1", formats: ["pdf"], filenames: ["a.pdf", "a.docx"], exportedAt: T3 }]
};

const summary = buildPilotSummary(state, T3);
check("time starts at the durable import timestamp, not the 1970 empty-state sentinel", summary.journey.dossierStartedAt === T0, JSON.stringify(summary.journey));
check("time to first approved evidence is stable after a later evidence edit", summary.journey.minutesFromStartToFirstApprovedEvidence === 25, JSON.stringify(summary.journey));
check("time to first export is sane", summary.journey.minutesFromStartToFirstExport === 100, JSON.stringify(summary.journey));
check("wrong-category count survives completion of the review queue", summary.integrity.wrongCategoryItemsCaught === 2, JSON.stringify(summary.integrity));
check("counts reflect edits, exports, and refused claims", summary.counts.userEditedVariants === 1 && summary.counts.userEditedFieldPaths === 2 && summary.counts.exportedFiles === 2 && summary.integrity.claimsRefusedByGenerator === 2, JSON.stringify(summary));
check("summary JSON contains no résumé content", !JSON.stringify(summary).includes("Meridian") && !JSON.stringify(summary).includes(SECRET));
check("content guard passes a clean summary", pilotSummaryContainsContent(summary) === false);
check("content guard fails closed when a content field sneaks into the shape", pilotSummaryContainsContent({ ...summary, extra: { detail: "leaked claim text" } }) === true);
check("content guard fails closed on nested résumé objects", pilotSummaryContainsContent({ ...summary, deep: [{ nested: { resume: {} } }] }) === true);

const empty = buildPilotSummary(emptyState(), T3);
check("literal emptyState produces null timings instead of a 29-million-minute journey", empty.journey.dossierStartedAt === null && empty.journey.minutesFromStartToFirstExport === null && empty.counts.approvedEvidence === 0, JSON.stringify(empty.journey));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
