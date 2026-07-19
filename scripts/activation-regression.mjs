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
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} }; cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/") ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`)) : request.startsWith(".") ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const { emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const dossierLib = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { activationStages, currentActivationStage, variantPurpose } = loadTsModule(path.join(root, "src/lib/activation.ts"));
const { createBackup, validateBackup } = loadTsModule(path.join(root, "src/lib/backup.ts"));

let passed = 0;
function check(label, condition) { if (!condition) throw new Error(`FAIL ${label}`); passed += 1; console.log(`PASS ${label}`); }
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const NOW = "2026-07-15T12:00:00.000Z";

const home = source("src/app/page.tsx");
const profile = source("src/app/profile/page.tsx");
const versions = source("src/app/versions/page.tsx");
const sample = source("src/components/SampleExperience.tsx");
const feedback = source("src/components/ActivationFeedback.tsx");
const analytics = source("src/lib/analytics.ts");
const nav = source("src/components/CommandNav.tsx");

check("homepage explains the evidence compiler before input", home.includes("Your career is bigger than your last résumé.") && home.includes("Local-first career evidence compiler") && home.indexOf("What you get") < home.indexOf("Advanced workspace"));
check("primary CTA reaches import-first entrance", /href="\/profile#import"/.test(home) && home.includes("Import my résumés"));
check("import remains local and approval-gated", profile.includes("Processing happens in this browser") && profile.includes("Nothing becomes trusted evidence until you approve it"));
check("proposal review explains unusable-before-approval state", profile.includes("Nothing here supports readiness, lanes, résumés, matching, or answers until approved and saved"));
check("approval unlock messaging uses canonical readiness", profile.includes("readiness.level") && profile.includes("What your approvals unlock"));

let state = emptyState();
check("fresh progress begins with history", currentActivationStage(state).id === "history" && activationStages(state).filter((item) => item.complete).length === 0);
const proposals = dossierLib.parseResumePackToProposals([{ filename: "old-resume.txt", text: "Customer Support Specialist — Northstar Software | 2021–2026\nResolved difficult SaaS customer issues and documented repeatable fixes\nMaintained 40 verified troubleshooting articles\nTools: Zendesk, Jira" }]);
check("proposed evidence is unusable before approval", dossierLib.mergeImportProposals(state.dossier, proposals, NOW).evidence.every((item) => !item.approved));
const dossier = dossierLib.mergeImportProposals(state.dossier, proposals.map((item) => ({ ...item, status: "approved" })), NOW);
state = { ...state, dossier };
check("approved history persists progress across serialization", currentActivationStage(parseState(JSON.stringify(state))).id === "lanes");
const lane = { id: "lane-support", title: "Product Support Specialist", status: "active", whyFit: "Approved support evidence", resumeAngle: "Lead with issue resolution and documentation", proof: [], gaps: ["Salesforce administration is not approved"], keywords: ["SaaS", "Zendesk", "documentation"], source: "custom", createdAt: NOW };
const oneLanePack = generateResumePack(dossier, [lane], NOW);
check("one lane generates two distinct variants", oneLanePack.variants.length === 2 && oneLanePack.variants[0].resume.summary !== oneLanePack.variants[1].resume.summary);
const lanes = [lane, { ...lane, id: "lane-ops", title: "Product Operations" }, { ...lane, id: "lane-success", title: "Customer Success" }];
const threeLanePack = generateResumePack(dossier, lanes, NOW);
check("three lanes generate six variants", threeLanePack.variants.length === 6);
check("every variant has explicit use guidance", threeLanePack.variants.every((item) => variantPurpose(item.kind).purpose.startsWith("Use")) && versions.includes("Use this for:"));
check("pack completion leads directly to tailoring", versions.includes("Tailor a résumé to a real job") && /href="\/tailor"/.test(versions));

const sampleForbidden = /updateCommandCenter|localStorage|saveState|useCommandCenter/;
check("sample mode cannot contaminate user state", !sampleForbidden.test(sample) && sample.includes("never saved"));
const requiredEvents = ["landing_primary_cta_clicked", "import_started", "import_completed", "proposal_review_started", "first_evidence_approved", "dossier_activation_reached", "first_lane_activated", "resume_pack_started", "resume_pack_completed", "resume_variant_opened", "full_pack_exported", "tailor_started", "tailored_resume_completed", "application_saved", "activation_feedback_submitted"];
check("all content-free activation events are declared", requiredEvents.every((event) => analytics.includes(`\"${event}\"`)));
check("career analytics accept event names only", /function trackCareerEvent\(event: CareerForgeEventName\)\s*\{\s*track\(event\)/.test(analytics));
check("feedback contains no hidden career payload", !/useCommandCenter|resumeText|jobPost|employer|roleTitle|email|phone/.test(feedback) && feedback.includes("milestone, answer") && feedback.includes("createdAt"));

const stateWithPack = { ...state, lanes, resumePacks: [threeLanePack] };
const restored = validateBackup(JSON.stringify(createBackup(stateWithPack, NOW)));
check("backup and restore preserve activation stage", restored.ok && currentActivationStage(restored.state).id === "application");
const legacy = parseState(JSON.stringify({ ...stateWithPack, version: 1 }));
check("legacy users skip completed first-run stages", activationStages(legacy).filter((item) => item.complete).length >= 4);
check("navigation keeps one compact mobile menu and groups desktop tools", nav.includes("Career Forge mobile stations") && nav.includes("md:hidden") && nav.includes("primaryStations") && nav.includes("moreStations") && /<summary[\s\S]*?>\s*More\s*<\/summary>/.test(nav));
check("touch targets are explicit on primary workflow", [home, profile, versions].every((text) => text.includes("min-h-11")));
check("empty users receive honest guidance", profile.includes("Start with one real role or project") && profile.includes("Missing credentials and unverified duration remain visible gaps"));
check("variant distinction is semantic, not cosmetic", variantPurpose("ats").difference !== variantPurpose("recruiter").difference && variantPurpose("ats").purpose !== variantPurpose("recruiter").purpose);

console.log(`\n${passed} activation regression checks passed`);
