import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "fixtures/private/blake-redacted-resume-pack.json");
if (!fs.existsSync(fixturePath)) throw new Error("Private redacted acceptance fixture is missing.");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (/@gmail\.|@yahoo\.|\+?1?\s*\(?\d{3}\)?[-\s]\d{3}/i.test(JSON.stringify(fixture))) throw new Error("Fixture appears to contain unredacted personal contact data.");

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

const dossierLib = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { analyzeJobPost } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));
const { draftApplicationQuestion } = loadTsModule(path.join(root, "src/lib/application-questions.ts"));
const { createPackBundle } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const { createBackup, validateBackup } = loadTsModule(path.join(root, "src/lib/backup.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { addDays, APPLICATION_FOLLOW_UP_DAYS } = loadTsModule(path.join(root, "src/lib/command-center-insights.ts"));

let passed = 0;
function verify(label, condition) { if (!condition) throw new Error(`FAIL ${label}`); passed += 1; console.log(`PASS ${label}`); }
const NOW = "2026-07-15T12:00:00.000Z";
const proposals = dossierLib.parseResumePackToProposals(fixture.documents).map((item) => ({ ...item, status: "approved" }));
let dossier = dossierLib.mergeImportProposals(dossierLib.emptyDossier(NOW), proposals, NOW);
const projectNames = ["Koinophobia Labs", "Career Forge", "Trendi", "You Know Ball", "Website Teardown AI"];
const projects = projectNames.flatMap((name) => {
  const evidence = dossier.evidence.filter((item) => item.detail.includes(name));
  return evidence.length ? [{ id: `project-${name.toLowerCase().replace(/\W+/g, "-")}`, name, organization: name === "Koinophobia Labs" ? "Independent" : "Koinophobia Labs", dates: "2024–Present", description: evidence[0].detail, responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: evidence.map((item) => item.id) }] : [];
});
dossier = { ...dossier, identity: { ...dossier.identity, fullName: "Blake Example" }, projects };
const lanes = ["AI Product Support / QA", "Customer Success / Implementation", "Fraud & Risk Operations"].map((title, index) => ({ id: `lane-${index}`, title, status: "active", whyFit: "", resumeAngle: title, proof: [], gaps: [], keywords: index === 0 ? ["regression", "QA"] : index === 1 ? ["customer implementation"] : ["policy enforcement", "risk"], source: "custom", createdAt: NOW }));
const pack = generateResumePack(dossier, lanes, NOW);
verify("six baselines created", pack.variants.length === 6);
verify("ATS and recruiter variants are substantively distinct", lanes.every((lane) => { const variants = pack.variants.filter((item) => item.laneId === lane.id); return variants[0].resume.summary !== variants[1].resume.summary && variants[0].sectionOrder.join() !== variants[1].sectionOrder.join(); }));
verify("projects appear without pretending to be conventional employers", pack.variants.some((variant) => variant.resume.experience.some((item) => projectNames.includes(item.title))));
verify("no unsupported credentials appear", !pack.variants.some((variant) => JSON.stringify(variant.resume).includes("Salesforce") || JSON.stringify(variant.resume).includes("certified")));
verify("each claim has narrowly relevant evidence", pack.variants.every((variant) => variant.evidenceReferences.every((reference) => reference.evidenceIds.length > 0 && reference.evidenceIds.length < dossier.evidence.length)));

const postings = [
  ["Fin", "Technical Support Engineer", "- Experience with technical support and regression testing required"],
  ["Enova", "Fraud Operations", "- Experience with policy enforcement, ID verification, and fraud investigation required"],
  ["Implementation Co", "Customer Implementation", "- Experience with customer implementation and product support required"]
];
const applications = postings.map(([company, roleTitle, post], index) => {
  const analysis = analyzeJobPost(post, emptyState().profile, lanes[index], dossier);
  verify(`${company} posting analyzed honestly`, analysis.requirements.length > 0 && analysis.requirements.every((item) => item.evidenceIds.every((id) => dossier.evidence.some((evidence) => evidence.id === id))));
  const questions = ["What excites you most about this opportunity?", "Why are you interested in this role?", "Describe a time you solved a difficult customer problem."].map((prompt, questionIndex) => draftApplicationQuestion(prompt, dossier, `app-${index}-q-${questionIndex}`));
  verify(`${company} answers use approved evidence`, questions.every((question) => question.evidenceIds.every((id) => dossier.evidence.some((item) => item.id === id && item.approved))));
  return { id: `app-${index}`, company, roleTitle, laneId: lanes[index].id, status: "applied", jobPostUrl: `https://linkedin.example/${index}`, source: "linkedin", discoveryUrl: `https://linkedin.example/${index}`, applicationUrl: `https://${company.toLowerCase().replace(/\s/g, "")}.example/apply/${index}`, postingDate: NOW, deadline: null, contactName: "", contactUrl: "", resumeVariantId: pack.variants[index * 2].id, applicationQuestions: questions, resumeVersionId: null, appliedAt: NOW, nextFollowUpAt: addDays(NOW, APPLICATION_FOLLOW_UP_DAYS), followUpsSent: [], interviewAt: null, notes: "", analysisKeywords: analysis.keywords.map((item) => item.term), analysisGaps: analysis.requirements.filter((item) => item.status === "gap").map((item) => item.requirement), analysisWeakSpots: analysis.weakSpots, createdAt: NOW };
});
verify("all applications retain source and both URLs", applications.every((app) => app.source === "linkedin" && app.discoveryUrl && app.applicationUrl));
verify("follow-up dates calculate correctly", applications.every((app) => app.nextFollowUpAt === addDays(NOW, APPLICATION_FOLLOW_UP_DAYS)));
const bundle = await createPackBundle(pack, dossier, lanes, ["pdf", "docx"]);
verify("ZIP contains every promised resume plus materials", bundle.filenames.length === 14 && bundle.filenames.filter((filename) => filename.endsWith(".pdf")).length === pack.variants.length && bundle.filenames.filter((filename) => filename.endsWith(".docx")).length === pack.variants.length);
const state = { ...emptyState(), dossier, lanes, applications, resumePacks: [pack], exports: [{ id: "export-1", packId: pack.id, formats: ["pdf", "docx"], filenames: bundle.filenames, exportedAt: NOW }] };
const restored = validateBackup(JSON.stringify(createBackup(state, NOW)));
verify("backup and restore preserve every workflow record", restored.ok && restored.state.applications.length === 3 && restored.state.resumePacks[0].variants.length === 6 && restored.state.applications.every((app) => app.discoveryUrl && app.applicationQuestions.length === 3));
console.log(`\n${passed} private acceptance checks passed`);
