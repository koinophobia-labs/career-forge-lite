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

const { emptyDossier, evidenceRecord, parseResumePackToProposals, mergeImportProposals } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack, updatePackVariant } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { analyzeJobPost } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));
const { draftApplicationQuestion } = loadTsModule(path.join(root, "src/lib/application-questions.ts"));
const { parseState, emptyProfile } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-07-15T12:00:00.000Z";
const files = [
  { filename: "ats.txt", text: "Associate Sportsbook Writer — DraftKings | 2021–2024\nPolicy enforcement and ID verification\nMaintained transaction accuracy\nEarlham College — Bachelor's degree\nTools: Excel, Internal sportsbook tools" },
  { filename: "human.txt", text: "Associate Sportsbook Writer — DraftKings | 2021–2024\nPolicy enforcement and ID verification\nResolved customer disputes\nFounder — Koinophobia Labs | 2024–Present\nCareer Forge project\nMaintained 13 automated regression suites" }
];
const proposals = parseResumePackToProposals(files);
check("multi-file import deduplicates repeated roles", proposals.filter((item) => /Associate Sportsbook Writer/i.test(item.detail)).length === 1);
const repeatedRole = proposals.find((item) => /Associate Sportsbook Writer/i.test(item.detail));
check("deduplicated records retain all source filenames", repeatedRole?.sourceFilenames.length === 2);
check("import proposals are grouped", new Set(proposals.map((item) => item.group)).size >= 4);
check("import proposals begin unusable", proposals.every((item) => item.status === "proposed"));

const reviewed = proposals.map((item) => ({ ...item, status: "approved" }));
let dossier = mergeImportProposals(emptyDossier(NOW), reviewed, NOW, true);
check("structured approval promotes only reviewed records", dossier.evidence.length === reviewed.length && dossier.evidence.every((item) => item.approved));
check("source text and filenames survive approval", dossier.evidence.every((item) => item.sourceExcerpts.length && item.sourceFilenames.length));
check("filenames are not persisted without explicit opt-in", mergeImportProposals(emptyDossier(NOW), reviewed, NOW).evidence.every((item) => item.sourceFilenames.length === 0));
check("approved import materializes structured roles and education", dossier.roles.some((item) => item.title.includes("Associate Sportsbook Writer") && item.employer === "DraftKings") && dossier.education.length > 0, JSON.stringify({ roles: dossier.roles, education: dossier.education }));

const add = (kind, detail) => evidenceRecord(kind, detail, "manual", true, NOW, { label: kind, sourceText: detail });
const projectEvidence = [add("project", "Career Forge — local-first career command center"), add("responsibility", "Built automated regression testing for shipped web products"), add("metric", "Maintained 13 automated regression suites")];
dossier = {
  ...dossier,
  evidence: [...dossier.evidence, ...projectEvidence],
  projects: [{ id: "project-career-forge", name: "Career Forge", organization: "Koinophobia Labs", dates: "2024–Present", description: "Career Forge — local-first career command center", responsibilities: ["Built automated regression testing for shipped web products"], tools: [], outcomes: [], metrics: ["Maintained 13 automated regression suites"], links: [], defaultPlacement: "projects", evidenceIds: projectEvidence.map((item) => item.id) }],
  approvedClaims: [...dossier.approvedClaims, ...projectEvidence.map((item) => item.detail)],
  updatedAt: NOW
};
const lanes = ["AI Product Support / QA", "Customer Success / Implementation", "Fraud & Risk Operations"].map((title, index) => ({ id: `lane-${index}`, title, status: "active", whyFit: "", resumeAngle: title, proof: [], gaps: [], keywords: index === 0 ? ["Salesforce", "regression"] : index === 2 ? ["policy enforcement"] : ["customer support"], source: "custom", createdAt: NOW }));
const pack = generateResumePack(dossier, lanes, NOW);
check("three lanes generate six baseline resumes", pack.variants.length === 6);
check("projects can carry a resume", pack.variants.some((variant) => variant.resume.experience.some((entry) => entry.title === "Career Forge")));
check("ATS and recruiter variants differ structurally", lanes.every((lane) => { const [ats, recruiter] = pack.variants.filter((item) => item.laneId === lane.id); return ats.sectionOrder.join() !== recruiter.sectionOrder.join() && ats.template !== recruiter.template && ats.resume.summary !== recruiter.resume.summary; }));
const approvedIds = new Set(dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => item.id));
check("every shipped claim has relevant approved support",
  pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.length > 0 && ref.evidenceIds.every((id) => approvedIds.has(id)))) &&
  pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.length < approvedIds.size)));
check("claim references carry support type", pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ["direct", "combined", "transferred"].includes(ref.supportType))));
check("lane-only Salesforce is refused", !pack.receipt.keywordsIncluded.includes("Salesforce"));

const profile = { ...emptyProfile(), transferableSkills: ["customer service"], experienceSummary: "Resolved customer disputes" };
const salesforce = analyzeJobPost("Requirements:\n- Experience with Salesforce is required", profile, lanes[0], dossier);
check("Salesforce lane keyword does not become proof", salesforce.requirements[0]?.status === "gap");
const degree = analyzeJobPost("Requirements:\n- Bachelor's degree required", profile, lanes[0], { ...dossier, evidence: dossier.evidence.filter((item) => item.kind !== "education") });
check("degree requirement remains gap without approved education", degree.requirements[0]?.status === "gap");
const policy = analyzeJobPost("Requirements:\n- Experience with policy enforcement and fraud investigation", profile, lanes[2], dossier);
check("sportsbook policy enforcement supports risk as direct or transferred", policy.requirements[0]?.status !== "gap" && policy.requirements[0]?.evidenceIds.length > 0);
const riskTransfer = analyzeJobPost("Requirements:\n- Experience with fraud investigation required", profile, lanes[2], dossier);
check("policy enforcement alone marks fraud investigation partial", riskTransfer.requirements[0]?.status === "partial" && riskTransfer.requirements[0]?.supportType === "transferred");
const saasTransfer = analyzeJobPost("Requirements:\n- Experience with SaaS support required", profile, lanes[0], dossier);
check("customer service marks SaaS support partial not covered", saasTransfer.requirements[0]?.status === "partial" && saasTransfer.requirements[0]?.supportType === "transferred");

const question = draftApplicationQuestion("Describe a time you solved a difficult customer problem.", dossier, "question-1");
check("application answer is evidence backed", question.evidenceIds.length > 0 && question.evidenceIds.every((id) => approvedIds.has(id)));
check("application answer refuses when evidence is absent", draftApplicationQuestion("Why this role?", emptyDossier(NOW)).evidenceIds.length === 0);

const edited = updatePackVariant(pack, pack.variants[0].id, { ...pack.variants[0].resume, summary: "User-authored truthful summary" }, NOW, ["summary"]);
check("manual edits are marked and preserved", edited.variants[0].userEdited && edited.variants[0].userAuthoredPaths.includes("summary") && edited.variants[0].resume.summary === "User-authored truthful summary");

const legacyApp = parseState(JSON.stringify({ version: 2, profile, dossier, applications: [{ id: "legacy-app", company: "Acme", roleTitle: "Support", jobPostUrl: "https://linkedin.example/job", createdAt: NOW }] })).applications[0];
check("legacy jobPostUrl migrates to discoveryUrl", legacyApp.discoveryUrl === "https://linkedin.example/job" && legacyApp.source === "other" && Array.isArray(legacyApp.applicationQuestions));

const projectOnly = { ...emptyDossier(NOW), evidence: projectEvidence, projects: dossier.projects, approvedClaims: projectEvidence.map((item) => item.detail), updatedAt: NOW };
check("project-only candidates generate without fake employers", generateResumePack(projectOnly, [lanes[0]], NOW).variants.some((variant) => variant.resume.experience.some((item) => item.title === "Career Forge" && item.company === "Koinophobia Labs")));
const largeEvidence = Array.from({ length: 500 }, (_, index) => add("proof", `Verified support outcome ${index}`));
const largeDossier = { ...projectOnly, evidence: [...projectEvidence, ...largeEvidence], approvedClaims: [...projectOnly.approvedClaims, ...largeEvidence.map((item) => item.detail)] };
check("large dossiers generate deterministically", generateResumePack(largeDossier, [lanes[0]], NOW).variants.length === 2 && generateResumePack(largeDossier, [lanes[0]], NOW).receipt.evidenceUsed.length <= 18);
check("corrupt localStorage payload revives safely", parseState("{not json").dossier.evidence.length === 0);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
