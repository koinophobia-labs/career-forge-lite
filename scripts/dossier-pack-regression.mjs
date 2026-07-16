import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
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

const { emptyState, parseState, deleteResumeVersion } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier, intakeFromDossier, withUpdatedDossier, assessDossierReadiness } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack, updatePackVariant } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { recordTailoredResumeVersion, buildHandoff } = loadTsModule(path.join(root, "src/lib/tailor-handoff.ts"));
const { resumeVariantFilename } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const { createBackup, validateBackup, BACKUP_SCHEMA_VERSION } = loadTsModule(path.join(root, "src/lib/backup.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-07-15T12:00:00.000Z";
const legacy = {
  version: 1,
  profile: { currentSituation: "Moving from retail to support", targetRoles: "Product Support", transferableSkills: ["de-escalation", "documentation", "troubleshooting"], experienceSummary: "Retail Associate at ShopCo", strengths: ["calm communication"], constraints: "Remote preferred", workStyle: "Collaborative", proofPoints: "Resolved customer issues during peak shifts", updatedAt: NOW },
  lanes: [{ id: "lane-existing", title: "Product Support", status: "active", whyFit: "Customer support", resumeAngle: "Lead with support", proof: ["Resolved issues"], gaps: [], keywords: ["support"], source: "custom", createdAt: NOW }],
  applications: [{ id: "app-existing", company: "Acme", roleTitle: "Support", laneId: "lane-existing", status: "applied", jobPostUrl: "", resumeVersionId: "resume-existing", appliedAt: NOW, nextFollowUpAt: null, followUpsSent: [], interviewAt: null, notes: "", analysisKeywords: [], analysisGaps: [], analysisWeakSpots: [], createdAt: NOW }],
  outreach: [{ id: "contact-existing", name: "Pat", company: "Acme", role: "Recruiter", channel: "linkedin", status: "sent", laneId: "lane-existing", lastContactedAt: NOW, nextFollowUpAt: null, followUpCount: 0, notes: "", createdAt: NOW }],
  resumeVersions: [{ id: "resume-existing", label: "Legacy", laneId: "lane-existing", notes: "", source: "builder", applicationId: "app-existing", targetCompany: "", targetTitle: "Support", keywordsUsed: [], gapsAcknowledged: [], influenceSummary: "", resumeText: "legacy text", resumeSnapshot: null, createdAt: NOW }]
};

const migrated = parseState(JSON.stringify(legacy));
check("legacy state migrates to v2", migrated.version === 2 && migrated.dossier.id === "dossier-local");
check("migration preserves applications, outreach, lanes, and versions", migrated.applications[0]?.id === "app-existing" && migrated.outreach[0]?.id === "contact-existing" && migrated.lanes[0]?.id === "lane-existing" && migrated.resumeVersions[0]?.id === "resume-existing");
check("legacy summary retained for migration review", migrated.dossier.unstructuredNotes.includes("Retail Associate at ShopCo") && migrated.dossier.migrationReview.length > 0);
check("migration is idempotent", JSON.stringify(parseState(JSON.stringify(migrated))) === JSON.stringify(migrated));

const intake = { ...initialIntake, fullName: "Riley Example", email: "riley@example.com", phone: "555-0100", website: "riley.example", targetJobTitle: "Product Support Specialist", currentTitle: "Retail Associate", currentCompany: "ShopCo", currentTime: "2022–Present", tools: "Zendesk, Excel", responsibilities: "Resolved customer questions\nDocumented escalations", customRoleTransferableSkills: ["de-escalation", "written communication"], outcomes: "Improved handoff clarity", customersServed: "40+ customers per shift", education: "Associate degree" };
const guidedDossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "guided", true, "guided source", NOW);
check("guided setup writes structured canonical dossier", guidedDossier.roles.length === 1 && guidedDossier.tools.includes("Zendesk") && guidedDossier.evidence.every((item) => item.approved));
check("normal generation can hydrate from dossier without duplicate intake", intakeFromDossier(guidedDossier, "Product Support Specialist").currentTitle === "Retail Associate" && intakeFromDossier(guidedDossier).email === "riley@example.com");
const storyDossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "story", true, "I worked at ShopCo", NOW);
check("Tell My Story writes source-linked canonical evidence", storyDossier.evidence.some((item) => item.source === "story" && item.sourceText === "I worked at ShopCo"));
check("Story Mode dossier survives refresh", parseState(JSON.stringify({ ...emptyState(), dossier: storyDossier })).dossier.roles[0]?.title === "Retail Associate");
check("readiness considers evidence quality", assessDossierReadiness(guidedDossier).level === "resume-ready");

const lanes = ["Product Support", "Fraud & Risk", "Operations"].map((title, index) => ({ id: `lane-${index}`, title, status: "active", whyFit: "Verified fit", resumeAngle: `Angle ${index}`, proof: [], gaps: [`Unsupported credential ${index}`], keywords: index === 0 ? ["Zendesk", "Salesforce"] : ["Excel"], source: "custom", createdAt: NOW }));
const pack = generateResumePack(guidedDossier, lanes, NOW);
check("three active lanes produce six variants", pack.variants.length === 6);
check("variants are distinct ATS and recruiter documents", lanes.every((lane) => { const variants = pack.variants.filter((item) => item.laneId === lane.id); return variants.length === 2 && variants[0].resume.summary !== variants[1].resume.summary; }));
const approvedIds = new Set(guidedDossier.evidence.filter((item) => item.approved).map((item) => item.id));
check("every generated claim references approved dossier evidence", pack.variants.every((variant) => variant.evidenceReferences.length > 0 && variant.evidenceReferences.every((ref) => ref.evidenceIds.length > 0 && ref.evidenceIds.every((id) => approvedIds.has(id)))));
check("unsupported job keywords stay gaps without invented refusal semantics", pack.receipt.keywordsIncluded.includes("Zendesk") && !pack.receipt.keywordsIncluded.includes("Salesforce") && pack.receipt.gapsLeftUnclaimed.includes("Unsupported credential 0") && pack.receipt.unsupportedClaimsRefused.length === 0);
check("pack documents are grouped by lane", pack.lanePacks.length === 3 && pack.lanePacks.every((lanePack) => lanePack.variantIds.length === 2));

const stateWithPack = { ...emptyState(), dossier: guidedDossier, profile: migrated.profile, lanes, resumePacks: [pack] };
const changedDossier = { ...guidedDossier, proofPoints: [...guidedDossier.proofPoints, "New verified proof"], updatedAt: "2026-07-16T12:00:00.000Z" };
const stale = withUpdatedDossier(stateWithPack, changedDossier);
check("dossier changes mark affected outputs stale", stale.resumePacks[0].status === "out-of-date" && stale.resumePacks[0].variants.every((item) => item.status === "out-of-date"));
const edited = updatePackVariant(pack, pack.variants[0].id, { ...pack.variants[0].resume, summary: "User-authored summary" }, NOW);
const afterDossierChange = withUpdatedDossier({ ...stateWithPack, resumePacks: [edited] }, changedDossier);
check("user-edited résumé text is never overwritten", afterDossierChange.resumePacks[0].variants[0].resume.summary === "User-authored summary" && afterDossierChange.resumePacks[0].variants[0].userEdited);

const fakeAnalysis = { keywords: [], requirements: [], weakSpots: [], bulletSuggestions: [] };
const handoff = buildHandoff({ analysis: fakeAnalysis, lane: lanes[0], company: "Acme", roleTitle: "Support", applicationId: "app-existing", baselineVariantId: pack.variants[0].id, nowIso: NOW });
check("job-specific tailoring begins from selected baseline", handoff.baselineVariantId === pack.variants[0].id);
const tailored = recordTailoredResumeVersion({ ...stateWithPack, applications: legacy.applications }, handoff, NOW, "", "tailored", null);
check("job-specific version keeps dossier, lane, baseline, analysis, and application lineage", tailored.resumeVersions[0].dossierId === guidedDossier.id && tailored.resumeVersions[0].laneId === lanes[0].id && tailored.resumeVersions[0].baselineVariantId === pack.variants[0].id && tailored.resumeVersions[0].jobPostAnalysisId && tailored.resumeVersions[0].applicationId === "app-existing");
check("job-specific version does not replace canonical pack résumé", tailored.resumePacks[0].variants.length === 6 && tailored.resumePacks[0].variants[0].canonical);
const deleted = deleteResumeVersion(tailored, tailored.resumeVersions[0].id);
check("version deletion safely preserves application record", deleted.applications[0].id === "app-existing" && deleted.applications[0].resumeVersionId === null);

const backup = createBackup(stateWithPack, NOW);
const restored = validateBackup(JSON.stringify(backup));
check("backup v2 contains dossier, packs, evidence links, and export metadata", BACKUP_SCHEMA_VERSION === 2 && restored.ok && restored.state.dossier.evidence.length === guidedDossier.evidence.length && restored.state.resumePacks[0].variants[0].evidenceReferences.length > 0 && Array.isArray(restored.state.exports));
check("legacy backups still restore", validateBackup(JSON.stringify({ app: "career-forge", schemaVersion: 1, exportedAt: NOW, state: legacy })).ok);
check("export filenames are deterministic and sanitized", resumeVariantFilename("Riley / Example", "Fraud & Risk", "ats", "pdf") === "Riley-Example-Resume-Fraud-Risk-ATS.pdf");

const analyticsSource = fs.readFileSync(path.join(root, "src/lib/analytics.ts"), "utf8");
check("career workflow analytics are event-name only", /function trackCareerEvent[\s\S]*?track\(event\)/.test(analyticsSource) && !/trackCareerEvent[\s\S]*?properties/.test(analyticsSource));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
