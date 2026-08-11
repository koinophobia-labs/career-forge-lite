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
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute
  });
  const mod = { exports: {} };
  cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".")
      ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`))
      : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const { emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { createBackup, validateBackup } = loadTsModule(path.join(root, "src/lib/backup.ts"));
const integrity = loadTsModule(path.join(root, "src/lib/evidence-integrity.ts"));
const { createPackBundle, createVariantFile, validatedVariantPlainText } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const JSZip = require("jszip");

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-08-11T12:00:00.000Z";
const record = (id, kind, detail) => ({ id, kind, label: kind, detail, source: "resume-import", sourceText: detail, confidence: "high", approved: true, rejected: false, sourceFilenames: ["resume.txt"], sourceExcerpts: [detail], createdAt: NOW, updatedAt: NOW });
function dossierWith(records) {
  const dossier = { ...emptyState().dossier, identity: { fullName: "Morgan Lee", email: "morgan@example.com", phone: "", location: "", links: [] }, evidence: records, updatedAt: NOW };
  dossier.roles = [{ id: "role-1", title: "Support Lead", employer: "Northstar", startDate: "2021", endDate: "2024", current: false, responsibilities: [records[0]?.detail ?? ""], tools: [], outcomes: [], evidenceIds: records.map((item) => item.id) }];
  dossier.projects = [{ id: "project-1", name: "Triage tracker", organization: "Volunteer", dates: "2023", description: "Built an intake tracker", responsibilities: [], tools: ["Excel"], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: records.filter((item) => item.kind === "project").map((item) => item.id) }];
  return dossier;
}
function rawVariant(references, overrides = {}) {
  return { id: "variant-ats", laneId: "lane-1", kind: "ats", title: "Support — ATS", status: "current", canonical: true, userEdited: false, resume: { summary: "Reduced median response time by 28%.", coreSkills: ["Excel"], experience: [{ title: "Support Lead", company: "Northstar", time: "2021–2024", bullets: ["Reduced median response time by 28%."] }], education: "", linkedinHeadline: "Support Lead", linkedinSummary: "Reduced median response time by 28%." }, template: "Modern ATS", evidenceReferences: references, userAuthoredPaths: [], reviewedUserAuthoredPaths: [], sectionOrder: ["summary", "skills", "experience", "projects", "education"], sourceDossierUpdatedAt: NOW, baselineVariantId: null, applicationId: null, createdAt: NOW, updatedAt: NOW, ...overrides };
}

const metric = record("metric-1", "metric", "Reduced median response time by 28%.");
const skill = record("skill-1", "skill", "Excel");
const project = record("project-evidence", "project", "Built a volunteer intake tracker");
const dossier = dossierWith([metric, skill, project]);
const reorderedMetric = Object.fromEntries(Object.entries(metric).reverse());
const reorderedDossier = dossierWith([reorderedMetric, skill, project]);
check("canonical revision ignores source object property insertion order", integrity.evidenceRevision(metric, dossier) === integrity.evidenceRevision(reorderedMetric, reorderedDossier));
const refs = [
  { claimPath: "summary", claimText: "Reduced median response time by 28%.", evidenceIds: [metric.id], supportType: "direct" },
  { claimPath: "coreSkills.0", claimText: "Excel", evidenceIds: [skill.id], supportType: "direct" },
  { claimPath: "experience.0.bullets.0", claimText: "Reduced median response time by 28%.", evidenceIds: [metric.id, project.id], supportType: "combined" }
];
const bound = rawVariant(integrity.bindEvidenceRevisions(refs, dossier));
check("generation-time bindings validate", integrity.validateVariantEvidenceIntegrity(bound, dossier).valid);
check("one claim persists bindings for multiple evidence records", Object.keys(bound.evidenceReferences.find((reference) => reference.claimPath === "experience.0.bullets.0")?.evidenceRevisions ?? {}).length === 2);
const whitespaceDossier = dossierWith([{ ...metric, detail: "  Reduced   median response time by 28%.\r\n", sourceText: metric.sourceText }, skill, project]);
check("inconsequential whitespace and line endings normalize", integrity.validateVariantEvidenceIntegrity(bound, whitespaceDossier).valid);
const changedMetric = dossierWith([{ ...metric, detail: "Reduced median response time.", sourceText: metric.sourceText, sourceExcerpts: metric.sourceExcerpts }, skill, project]);
const metricResult = integrity.validateVariantEvidenceIntegrity(bound, changedMetric);
check("same id with removed metric fails closed", !metricResult.valid && metricResult.issues.some((issue) => issue.reason === "evidence-changed"));
check("one evidence record invalidates multiple generated claims", !metricResult.valid && metricResult.issues.filter((issue) => issue.evidenceId === metric.id).length === 2);
const onlyMetricChanged = structuredClone(dossier);
onlyMetricChanged.evidence[0] = { ...onlyMetricChanged.evidence[0], detail: "Reduced median response time.", sourceText: "Reduced median response time.", sourceExcerpts: ["Reduced median response time."] };
const onlyMetricResult = integrity.validateVariantEvidenceIntegrity(bound, onlyMetricChanged);
check("changing only one of several referenced records invalidates the combined claim", !onlyMetricResult.valid && onlyMetricResult.issues.some((issue) => issue.claimPath === "experience.0.bullets.0" && issue.evidenceId === metric.id) && !onlyMetricResult.issues.some((issue) => issue.evidenceId === project.id));

for (const [label, mutate] of [
  ["date", (d) => { d.roles[0].startDate = "2022"; }], ["employer", (d) => { d.roles[0].employer = "Southstar"; }],
  ["title", (d) => { d.roles[0].title = "Support Specialist"; }], ["responsibility", (d) => { d.roles[0].responsibilities = ["Handled tickets"]; }],
  ["project description", (d) => { d.projects[0].description = "Built a different tracker"; }]
]) {
  const changed = structuredClone(dossier); mutate(changed);
  check(`${label} change invalidates dependent output`, !integrity.validateVariantEvidenceIntegrity(bound, changed).valid);
}
check("skill removal invalidates dependent output", !integrity.validateVariantEvidenceIntegrity(bound, dossierWith([metric, { ...skill, detail: "Salesforce" }, project])).valid);
for (const [label, changed] of [
  ["rejected evidence", dossierWith([{ ...metric, approved: false, rejected: true }, skill, project])],
  ["otherwise ineligible evidence", dossierWith([{ ...metric, disclosureReview: "needs_review" }, skill, project])],
  ["deleted evidence", dossierWith([skill, project])],
  ["referenced evidence record missing", dossierWith([skill, project])]
]) check(`${label} fails closed`, !integrity.validateVariantEvidenceIntegrity(bound, changed).valid);

check("legacy output without revision bindings fails closed", !integrity.validateVariantEvidenceIntegrity(rawVariant(refs), dossier).valid);
const userEdited = { ...bound, userEdited: true, userAuthoredPaths: ["summary"], reviewedUserAuthoredPaths: [] };
check("unreviewed user-authored content is blocked without deletion", !integrity.validateVariantEvidenceIntegrity(userEdited, dossier).valid && userEdited.resume.summary.includes("28%"));
check("unreviewed user-authored content stays blocked after its generated reference is reconciled away", !integrity.validateVariantEvidenceIntegrity({ ...userEdited, evidenceReferences: userEdited.evidenceReferences.filter((reference) => reference.claimPath !== "summary") }, dossier).valid);
check("explicitly reviewed user-authored path is allowed", integrity.validateVariantEvidenceIntegrity({ ...userEdited, reviewedUserAuthoredPaths: ["summary"] }, dossier).valid);
const correctedRef = [{ claimPath: "summary", claimText: "Reduced median response time.", evidenceIds: [metric.id], supportType: "direct" }];
const regenerated = rawVariant(integrity.bindEvidenceRevisions(correctedRef, changedMetric), { resume: { ...bound.resume, summary: "Reduced median response time.", linkedinSummary: "Reduced median response time.", experience: [{ ...bound.resume.experience[0], bullets: ["Reduced median response time."] }] } });
check("regeneration from corrected evidence restores validity", integrity.validateVariantEvidenceIntegrity(regenerated, changedMetric).valid);
check("regenerated clipboard text excludes obsolete metric", !validatedVariantPlainText(changedMetric, regenerated).includes("28%"));

let clipboardBlocked = false; try { validatedVariantPlainText(changedMetric, bound); } catch { clipboardBlocked = true; }
check("clipboard serializer blocks stale output before bytes", clipboardBlocked);
let pdfBlocked = false; try { await createVariantFile(bound, changedMetric, "Support", "pdf"); } catch { pdfBlocked = true; }
check("PDF builder blocks stale output before bytes", pdfBlocked);
let docxBlocked = false; try { await createVariantFile(bound, changedMetric, "Support", "docx"); } catch { docxBlocked = true; }
check("DOCX builder blocks stale output before bytes", docxBlocked);

const pack = { id: "pack-1", dossierId: dossier.id, status: "current", lanePacks: [{ laneId: "lane-1", positioningPitch: "Support", variantIds: [bound.id], evidenceUsed: [metric.id], evidenceOmitted: [], gapsAvoided: [] }], variants: [bound], linkedinHeadlines: [], linkedinAbout: "", linkedinSkills: [], masterProofBank: [], coverLetterFoundation: "", receipt: { id: "receipt-1", generatedAt: NOW, evidenceUsed: [metric.id], evidenceOmitted: [], laneFraming: [], keywordsIncluded: [], gapsAvoided: [], unsupportedClaimsRefused: [], transferredClaims: [], gapsLeftUnclaimed: [] }, createdAt: NOW, updatedAt: NOW };
let zipBlocked = false; try { await createPackBundle(pack, changedMetric, [{ id: "lane-1", title: "Support", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }], ["pdf", "docx"]); } catch { zipBlocked = true; }
check("ZIP and supporting-material generation block stale output before bytes", zipBlocked);

const state = { ...emptyState(), dossier, resumePacks: [pack] };
const restored = validateBackup(JSON.stringify(createBackup(state, NOW)));
check("backup and restore preserve revision bindings", restored.ok && integrity.validateVariantEvidenceIntegrity(restored.state.resumePacks[0].variants[0], restored.state.dossier).valid);
const roundTrip = parseState(JSON.stringify(state));
check("localStorage revival preserves revision bindings", integrity.validateVariantEvidenceIntegrity(roundTrip.resumePacks[0].variants[0], roundTrip.dossier).valid);
const recruiter = { ...bound, id: "variant-recruiter", kind: "recruiter", title: "Support — Recruiter" };
const secondLane = { ...bound, id: "variant-ops", laneId: "lane-2", title: "Operations — ATS" };
check("multiple lanes and ATS/recruiter variants validate independently", [bound, recruiter, secondLane].every((variant) => integrity.validateVariantEvidenceIntegrity(variant, dossier).valid));

const validPdf = await createVariantFile(regenerated, changedMetric, "Support", "pdf");
const validDocx = await createVariantFile(regenerated, changedMetric, "Support", "docx");
const pdfBytes = new Uint8Array(await validPdf.blob.arrayBuffer());
const pdfText = new TextDecoder().decode(pdfBytes);
const docxZip = await JSZip.loadAsync(await validDocx.blob.arrayBuffer());
const docxXml = await docxZip.file("word/document.xml").async("string");
check("regenerated PDF is non-empty and excludes obsolete metric", pdfBytes.length > 500 && !pdfText.includes("28%") && pdfText.includes("Reduced median response time"));
check("regenerated DOCX excludes obsolete metric", !docxXml.includes("28%") && docxXml.includes("Reduced median response time"));
const correctedPack = { ...pack, variants: [regenerated], lanePacks: [{ ...pack.lanePacks[0], variantIds: [regenerated.id] }] };
const correctedBundle = await createPackBundle(correctedPack, changedMetric, [{ id: "lane-1", title: "Support", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }], ["pdf", "docx"]);
const correctedZip = await JSZip.loadAsync(await correctedBundle.blob.arrayBuffer());
let zipContainsObsoleteMetric = false;
for (const [name, entry] of Object.entries(correctedZip.files)) {
  if (entry.dir) continue;
  if (name.endsWith(".docx")) {
    const nested = await JSZip.loadAsync(await entry.async("uint8array"));
    zipContainsObsoleteMetric ||= (await nested.file("word/document.xml").async("string")).includes("28%");
  } else {
    zipContainsObsoleteMetric ||= (await entry.async("string")).includes("28%");
  }
}
check("regenerated complete ZIP excludes obsolete metric from every file", !zipContainsObsoleteMetric);

console.log(`\n${passes} evidence revision integrity checks passed; ${failures} failed.`);
if (failures) process.exitCode = 1;
