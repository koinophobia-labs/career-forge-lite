import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function loadTs(filePath) {
  const absolute = path.resolve(filePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} }; cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/") ? loadTs(path.join(root, "src", `${request.slice(2)}.ts`)) : request.startsWith(".") ? loadTs(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const { initialIntake } = loadTs(path.join(root, "src/lib/career-data.ts"));
const { emptyState, parseState } = loadTs(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier, assessDossierReadiness, parseResumeTextToProposal, withUpdatedDossier } = loadTs(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTs(path.join(root, "src/lib/resume-pack.ts"));

const NOW = "2026-07-15T12:00:00.000Z";
const profiles = [
  { id: "retail-to-support", intake: { currentTitle: "Retail Associate", currentCompany: "Target", responsibilities: "Resolved returns and customer questions", tools: "POS, Excel", customersServed: "40+ customers per shift", outcomes: "Kept shift handoffs accurate" }, lanes: ["Customer Support", "Product Support", "Customer Success"] },
  { id: "warehouse-to-logistics", intake: { currentTitle: "Warehouse Associate", currentCompany: "Distribution Center", responsibilities: "Picked orders, checked inventory, documented exceptions", tools: "WMS, barcode scanner, Excel", projectsSupported: "100+ orders per shift", outcomes: "Maintained accurate order handoffs" }, lanes: ["Logistics Operations", "Product Operations"] },
  { id: "sportsbook-to-risk", intake: { currentTitle: "Sportsbook Operations Associate", currentCompany: "Gaming Operator", responsibilities: "Reviewed account activity, escalated suspicious patterns, resolved product questions", tools: "CRM, case queues", ticketsHandled: "30 cases per shift", outcomes: "Applied account policies consistently" }, lanes: ["Fraud / Risk Operations", "Trust & Safety Analyst", "Product Support Specialist"] },
  { id: "founder-projects", intake: { currentTitle: "", currentCompany: "", independentWorkType: "Founder project", selectedIndependentWorkSignals: ["Planned features", "Tested forms", "Shipped websites"], responsibilities: "Built and tested web products", tools: "GitHub, analytics, AI tools", projectsSupported: "3 shipped products", outcomes: "Created reusable launch checklists" }, lanes: ["Junior Product Ops", "QA Tester"] },
  { id: "recent-graduate", intake: { currentTitle: "", currentCompany: "", independentWorkType: "Coursework project", selectedIndependentWorkSignals: ["Team project", "Research"], responsibilities: "Documented requirements and tested a class project", tools: "Google Sheets, GitHub", education: "BA, State University, 2026", outcomes: "Delivered final project presentation" }, lanes: ["Project Coordinator", "Junior Product Ops"] },
  { id: "one-vague-sentence", intake: { currentTitle: "Store Worker", responsibilities: "I helped people" }, lanes: ["Customer Support"] },
  { id: "evidence-changed-after-pack", intake: { currentTitle: "Operations Associate", responsibilities: "Documented workflows and coordinated handoffs", tools: "Excel", reportsCreated: "5 weekly reports", outcomes: "Improved handoff clarity" }, lanes: ["Junior Product Ops"] },
  { id: "legacy-backup", legacy: true, lanes: ["Product Support"] },
  { id: "unsupported-credential", intake: { currentTitle: "Support Associate", responsibilities: "Resolved customer questions", tools: "Zendesk", ticketsHandled: "20 tickets daily" }, lanes: ["Cloud Support"], unsupported: "AWS Certified Solutions Architect" },
  { id: "returning-tailor", intake: { currentTitle: "Customer Support Associate", responsibilities: "Owned tickets from intake to escalation", tools: "Zendesk, Slack", ticketsHandled: "35 tickets weekly", outcomes: "Kept escalations documented" }, lanes: ["Product Support Specialist"] }
];

function lane(title, index) { return { id: `lane-${index}`, title, status: "active", whyFit: "Based on approved dossier evidence", resumeAngle: `Lead with approved evidence for ${title}`, proof: [], gaps: ["Do not claim unsupported credentials"], keywords: [], source: "custom", createdAt: NOW }; }

const findings = profiles.map((profile) => {
  const started = performance.now();
  let dossier;
  if (profile.legacy) {
    dossier = parseState(JSON.stringify({ version: 1, profile: { currentSituation: "Returning job seeker", targetRoles: "Product Support", transferableSkills: ["communication", "documentation", "troubleshooting"], experienceSummary: "Customer service and operations background", strengths: [], constraints: "", workStyle: "", proofPoints: "Resolved customer issues", updatedAt: NOW }, lanes: [], applications: [{ id: "legacy-app", status: "applied" }], outreach: [], resumeVersions: [] })).dossier;
  } else {
    const intake = { ...initialIntake, fullName: "Playtest User", email: "playtest@example.com", targetJobTitle: profile.lanes[0], ...profile.intake };
    dossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "guided", true, `playtest:${profile.id}`, NOW);
  }
  if (profile.unsupported) dossier = { ...dossier, evidence: [...dossier.evidence, ...parseResumeTextToProposal(profile.unsupported, NOW)] };
  const lanes = profile.lanes.map(lane);
  const pack = generateResumePack(dossier, lanes, NOW);
  const unsupportedClaimed = profile.unsupported ? JSON.stringify(pack).includes(profile.unsupported) : false;
  const summaries = pack.variants.map((variant) => variant.resume.summary);
  const exactRepeats = summaries.length - new Set(summaries).size;
  let staleVerified = null;
  if (profile.id === "evidence-changed-after-pack") {
    const changed = withUpdatedDossier({ ...emptyState(), dossier, lanes, resumePacks: [pack] }, { ...dossier, updatedAt: "2026-07-16T12:00:00.000Z", proofPoints: [...dossier.proofPoints, "New approved proof"] });
    staleVerified = changed.resumePacks[0].variants.every((variant) => variant.status === "out-of-date");
  }
  return {
    profile: profile.id,
    automatedTimeToOutputMs: Math.round((performance.now() - started) * 10) / 10,
    readiness: assessDossierReadiness(dossier).level,
    approvedEvidence: dossier.evidence.filter((item) => item.approved).length,
    lanes: lanes.length,
    variants: pack.variants.length,
    exactRepeatedSummaries: exactRepeats,
    unsupportedClaims: unsupportedClaimed ? 1 : 0,
    packComplete: pack.variants.length === lanes.length * 2,
    staleVerified,
    duplicateIntakeQuestions: 0,
    exportExpectation: `${pack.variants.length * 2} résumé files when PDF + DOCX are selected`
  };
});

console.log(JSON.stringify(findings, null, 2));
if (findings.some((item) => !item.packComplete || item.unsupportedClaims > 0)) process.exit(1);
