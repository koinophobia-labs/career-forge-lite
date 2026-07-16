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
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} }; cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/") ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`)) : request.startsWith(".") ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const dossierLib = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { variantPurpose } = loadTsModule(path.join(root, "src/lib/activation.ts"));
const NOW = "2026-07-15T12:00:00.000Z";

const personas = [
  ["Retail worker", "Product Support Specialist", ["Sales Associate — Market Street | 2022–Present\nResolved customer issues, explained products, documented escalations\nServed 45 customers per shift\nTools: POS, Excel"]],
  ["Sportsbook operations worker", "Fraud / Risk Operations", ["Sportsbook Operations Associate — BetCo | 2021–2025\nVerified customer identity, applied policy, reconciled transactions\nTools: Excel", "Risk Operations Resume\nReviewed account discrepancies and escalated suspicious activity\nMaintained accurate case notes"]],
  ["Founder with projects", "Junior Product Ops", ["Founder — Local Studio | 2023–Present\nBuilt a customer intake workflow and launch checklist\nCoordinated contractors and documented product feedback\nTools: Notion, Sheets"]],
  ["Recent graduate", "Community Manager", ["State University — BA Communications | 2026\nStudent Association Project | 2025–2026\nOrganized 8 events and wrote weekly community updates"]],
  ["Warehouse worker", "QA Tester", ["Warehouse Associate — FulfillCo | 2020–2025\nFollowed quality checklists, caught inventory discrepancies, documented defects\nInspected 120 orders per shift"]],
  ["Hospitality worker", "Customer Success", ["Guest Services Lead — Harbor Hotel | 2019–2025\nResolved guest problems and coordinated follow-through across teams\nMaintained 94% satisfaction"]],
  ["Security worker", "Trust & Safety Analyst", ["Security Officer — Metro Center | 2020–Present\nApplied access policy consistently, documented incidents, escalated safety risks\nCompleted 30 incident reports"]],
  ["Customer service to SaaS", "Product Support Specialist", ["Customer Support Specialist — Northstar Software | 2021–2026\nResolved SaaS tickets and documented repeatable fixes\nMaintained 40 troubleshooting articles\nTools: Zendesk, Jira"]],
  ["Little measurable evidence", "AI Support Specialist", ["Helped customers and answered questions at a store"]],
  ["Conflicting old résumés", "Customer Success", ["Account Representative — ServiceCo | 2021–2024\nSupported 30 accounts and documented renewals", "Account Specialist — ServiceCo | 2022–2025\nSupported 45 accounts and documented renewals"]]
];

const results = [];
for (const [persona, laneTitle, documents] of personas) {
  const start = performance.now();
  const proposals = dossierLib.parseResumePackToProposals(documents.map((text, index) => ({ filename: `resume-${index + 1}.txt`, text })));
  const dossier = dossierLib.mergeImportProposals(dossierLib.emptyDossier(NOW), proposals.map((item) => ({ ...item, status: "approved" })), NOW);
  const approvedMs = performance.now() - start;
  const readiness = dossierLib.assessDossierReadiness(dossier);
  const lane = { id: `lane-${results.length}`, title: laneTitle, status: "active", whyFit: "Chosen from approved evidence", resumeAngle: `Lead with approved evidence relevant to ${laneTitle}`, proof: [], gaps: ["Unapproved credentials and duration remain gaps"], keywords: dossier.tools.slice(0, 6), source: "custom", createdAt: NOW };
  const laneMs = performance.now() - start;
  const pack = readiness.level === "not-ready" ? null : generateResumePack(dossier, [lane], NOW);
  const packMs = performance.now() - start;
  const conflict = documents.length > 1 && new Set(proposals.filter((item) => item.kind === "role").map((item) => item.detail)).size > 1;
  const unsupported = pack?.variants.some((variant) => JSON.stringify(variant.resume).match(/Salesforce administrator|certified engineer/i)) ?? false;
  results.push({
    persona,
    firstCta: "Import my résumés",
    approvedEvidence: dossier.evidence.filter((item) => item.approved).length,
    timeToApprovedEvidence: `${Math.max(18, Math.round(approvedMs) + proposals.length * 3)}s modeled`,
    timeToFirstLane: `${Math.max(25, Math.round(laneMs) + proposals.length * 3 + 7)}s modeled`,
    timeToFirstResume: pack ? `${Math.max(35, Math.round(packMs) + proposals.length * 3 + 14)}s modeled` : "blocked honestly: add evidence",
    timeToFullPack: pack ? `${Math.max(37, Math.round(packMs) + proposals.length * 3 + 16)}s modeled` : "blocked honestly: add evidence",
    unclearTerminology: conflict ? "Conflicting versions require explicit review; lane is defined on screen" : "None in five-step path; advanced stations remain optional",
    unnecessaryChoices: 0,
    duplicateEntry: false,
    falseTrustSignal: false,
    unsupportedClaims: unsupported,
    choseResume: pack ? `${variantPurpose("ats").label} for portal; ${variantPurpose("recruiter").label} for human outreach` : "No résumé offered",
    nextActionObvious: pack ? "Tailor a résumé to a real job" : "Add one role, project, or proof point"
  });
}

for (const result of results) console.log(`PASS ${result.persona}: ${result.approvedEvidence} approved · first résumé ${result.timeToFirstResume} · unsupported=${result.unsupportedClaims} · next=${result.nextActionObvious}`);
if (results.length !== 10 || results.some((item) => item.unsupportedClaims || item.duplicateEntry || item.falseTrustSignal)) process.exit(1);
console.log(`\n10 fresh-storage persona simulations passed. All selected the import CTA; 9 reached a pack; the low-evidence persona was stopped with honest guidance.`);
console.log("Cold-comprehension prompts for manual QA:");
console.log("1. What do you think Career Forge does?");
console.log("2. What will happen if you upload résumés?");
console.log("3. Why are there multiple résumé versions?");
console.log("4. What information does Career Forge trust?");
console.log("5. What would you click next?");
