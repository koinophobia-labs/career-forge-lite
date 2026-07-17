// Manual release-candidate inspection: generates eight Career Packs across
// the release personas through the REAL pipelines and prints the full
// deliverables for human review. Not a pass/fail suite — an evidence dump.

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
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  const fn = new Function("require", "module", "exports", "__dirname", "__filename", outputText);
  fn(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { emptyDossier, parseResumePackToProposals, mergeImportProposals } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));
const { generateInterviewPrep } = loadTsModule(path.join(root, "src/lib/interview-prep.ts"));
const { analyzeJobPost } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));

const NOW = "2026-07-16T12:00:00.000Z";

function dossierFromText(text) {
  const proposals = parseResumePackToProposals([{ filename: "history.txt", text }]).map((p) => ({ ...p, status: "approved" }));
  return mergeImportProposals(emptyDossier(NOW), proposals, NOW);
}

function lane(title, keywords, angle = "") {
  return { id: `lane-${title.toLowerCase().replace(/\W+/g, "-")}`, title, status: "active", whyFit: "", resumeAngle: angle, proof: [], gaps: [], keywords, source: "custom", createdAt: NOW };
}

function printPack(name, pack, dossier) {
  const ats = pack.variants.find((v) => v.kind === "ats");
  const rec = pack.variants.find((v) => v.kind === "recruiter");
  console.log(`\n${"#".repeat(80)}\n# ${name}\n${"#".repeat(80)}`);
  console.log(`\n--- ATS SUMMARY ---\n${ats.resume.summary}`);
  console.log(`\n--- RECRUITER SUMMARY ---\n${rec.resume.summary}`);
  console.log(`\n--- SKILLS ---\n${ats.resume.coreSkills.join(" | ") || "(none)"}`);
  console.log(`\n--- EXPERIENCE (ATS) ---`);
  ats.resume.experience.forEach((role) => {
    console.log(`  ${[role.title, role.company, role.time].filter(Boolean).join(" · ")}`);
    role.bullets.forEach((b) => console.log(`    • ${b}`));
  });
  console.log(`\n--- EDUCATION ---\n${ats.resume.education || "(none)"}`);
  console.log(`\n--- LINKEDIN HEADLINE ---\n${ats.resume.linkedinHeadline}`);
  console.log(`\n--- LINKEDIN ABOUT ---\n${pack.linkedinAbout}`);
  console.log(`\n--- POSITIONING PITCH(ES) ---\n${pack.lanePacks.map((lp) => lp.positioningPitch).join("\n")}`);
  console.log(`\n--- PROOF BANK ---\n${pack.masterProofBank.map((p) => `  - ${p}`).join("\n") || "(empty)"}`);
  console.log(`\n--- RECEIPT: refused/withheld ---\n${pack.receipt.unsupportedClaimsRefused.map((r) => `  - ${r}`).join("\n") || "(none)"}`);
  console.log(`--- RECEIPT: used ${pack.receipt.evidenceUsed.length} / omitted ${pack.receipt.evidenceOmitted.length} of ${dossier ? dossier.evidence.filter((e) => e.approved && !e.rejected).length : "?"} approved`);
}

function printGuided(name, resume) {
  console.log(`\n${"#".repeat(80)}\n# ${name} (guided builder)\n${"#".repeat(80)}`);
  console.log(`\n--- SUMMARY ---\n${resume.summary}`);
  console.log(`\n--- SKILLS ---\n${resume.coreSkills.join(" | ")}`);
  console.log(`\n--- EXPERIENCE ---`);
  resume.experience.forEach((role) => {
    console.log(`  ${[role.title, role.company, role.time].filter(Boolean).join(" · ")}`);
    role.bullets.forEach((b) => console.log(`    • ${b}`));
  });
  console.log(`\n--- EDUCATION ---\n${resume.education}`);
  console.log(`\n--- LINKEDIN ---\n${resume.linkedinHeadline}\n${resume.linkedinSummary}`);
}

// 1. Laid-off sportsbook/customer-operations employee → salaried ops role
const p1 = dossierFromText([
  "Marcus Bell",
  "marcus.bell@example.com",
  "Sportsbook Ticket Writer — BetRiver Casino | 2021–2026",
  "Processed 200+ customer wagers per shift with zero drawer discrepancies until I was laid off in March 2026",
  "De-escalated disputes over voided tickets and explained house rules to upset customers",
  "Trained 6 new ticket writers on POS and responsible gaming compliance",
  "Tools: Sportsbook POS, Excel, Kronos",
  "Riverside Community College — Associate of Arts",
].join("\n"));
printPack("1. LAID-OFF SPORTSBOOK → CUSTOMER OPERATIONS", generateResumePack(p1, [lane("Customer Operations Specialist", ["customer", "operations", "compliance", "training"])], NOW), p1);

// 2. Founder → AI implementation / product operations
const p2 = dossierFromText([
  "Dana Osei",
  "dana@example.com",
  "Founder — Loomwork Studio | 2023–Present",
  "Built and shipped 4 client websites and 2 internal automation tools using AI coding assistants",
  "Set up automated intake workflows that cut client onboarding from 2 weeks to 3 days",
  "Wrote product specs, ran user testing with 15 beta users, and shipped weekly releases",
  "Tools: Claude, Zapier, Airtable, Next.js, Figma",
  "State University — BS in Communications | 2019",
].join("\n"));
printPack("2. FOUNDER → AI IMPLEMENTATION / PRODUCT OPS", generateResumePack(p2, [lane("AI Implementation Specialist", ["ai", "automation", "workflow", "implementation"])], NOW), p2);

// 3. Career switcher: retail management → HR/people operations
const p3 = dossierFromText([
  "Priya Nair",
  "priya.nair@example.com",
  "Store Manager — Harvest Market | 2019–2026",
  "Hired and onboarded 40+ employees across 3 locations",
  "Reduced staff turnover from 45% to 28% by building a structured first-90-days program",
  "Ran weekly scheduling for a 25-person team and resolved payroll disputes",
  "Handled workers compensation claims and return-to-work coordination",
  "Tools: Workday, Kronos, Google Sheets",
  "City College — Associate degree in Business",
].join("\n"));
printPack("3. CAREER SWITCHER: RETAIL MGMT → HR/PEOPLE OPS", generateResumePack(p3, [lane("HR Coordinator", ["hiring", "onboarding", "hr", "people", "payroll"])], NOW), p3);

// 4. Early-career: projects, minimal formal employment
const p4 = dossierFromText([
  "Jordan Wu",
  "jordan.wu@example.com",
  "Capstone Project — Community Food Finder | 2025–2026",
  "Built a mobile-friendly site mapping 60+ food pantries with open hours and transit directions",
  "Interviewed 12 pantry coordinators to design the data model",
  "Barista — Corner Beans | 2024–2025",
  "Opened the store 3 mornings a week and handled cash and mobile orders during rush",
  "Volunteer — Northside Shelter | 2023–Present",
  "Organize weekly meal service for 80 guests and coordinate 5 other volunteers",
  "Tools: HTML, CSS, JavaScript, Google Sheets",
  "Lakeview Community College — Associate of Science | 2026",
].join("\n"));
printPack("4. EARLY-CAREER: PROJECTS + PART-TIME + VOLUNTEER", generateResumePack(p4, [lane("Community Program Assistant", ["community", "coordination", "program", "service"])], NOW), p4);

// 5. No numerical metrics (guided builder path)
const p5intake = {
  ...initialIntake,
  fullName: "Sam Ortiz",
  email: "sam.ortiz@example.com",
  targetJobTitle: "Office Administrator",
  roleFamily: "Admin",
  currentTitle: "Office Assistant",
  currentCompany: "Bright Dental",
  currentTime: "2022 – Present",
  responsibilities: "Answer phones and schedule patient appointments. Keep supply closet stocked and order what we run low on. File insurance paperwork and follow up on unpaid claims.",
  tools: "Google Calendar, Dentrix, Excel",
  outcomes: "The office manager relies on me to keep the front desk running when she is out.",
  education: "High school diploma"
};
printGuided("5. NO METRICS USER (guided)", generateResumePackage(p5intake));

// 6. Conflicting / incomplete dates
const p6 = dossierFromText([
  "Alex Reyes",
  "alex.reyes@example.com",
  "Warehouse Associate — Fulfillment Co | 2024–2022",
  "Picked and packed 300+ orders daily with 99.8% accuracy",
  "Forklift certified and trained on pallet jack safety",
  "Delivery Driver — QuickShip",
  "Delivered 80-100 packages per route and kept a clean driving record",
  "Tools: RF scanners, route apps",
].join("\n"));
printPack("6. CONFLICTING/INCOMPLETE DATES", generateResumePack(p6, [lane("Logistics Coordinator", ["warehouse", "logistics", "delivery", "safety"])], NOW), p6);

// 7. Multiple unrelated roles
const p7 = dossierFromText([
  "Casey Tran",
  "casey.tran@example.com",
  "Substitute Teacher — Metro School District | 2023–2026",
  "Covered K-8 classrooms on short notice and left detailed handoff notes for returning teachers",
  "Line Cook — Pho Palace | 2021–2023",
  "Worked the wok station during 200-cover dinner rushes and kept food safety logs",
  "Tax Preparer (seasonal) — QuickTax | 2020–2021",
  "Prepared 150+ individual returns per season and caught filing errors before submission",
  "Tools: Google Classroom, POS, TaxSlayer",
].join("\n"));
printPack("7. MULTIPLE UNRELATED ROLES", generateResumePack(p7, [lane("Operations Coordinator", ["operations", "coordination", "accuracy", "documentation"])], NOW), p7);

// 8. Interview-only user: existing résumé + job description
const p8 = dossierFromText([
  "Robin Clarke",
  "robin.clarke@example.com",
  "Customer Success Manager — CloudDesk | 2022–2026",
  "Managed a book of 45 mid-market accounts worth $3.2M ARR",
  "Reduced churn from 14% to 8% by building a quarterly business review program",
  "Maintained 96% CSAT across 400+ support escalations",
  "Tools: Salesforce, Zendesk, Gainsight",
  "State University — BA in Psychology | 2018",
].join("\n"));
const jd = `Customer Success Manager — Meridian Software
We're looking for a CSM to own a portfolio of 50+ B2B accounts.
What you'll do:
- Own onboarding, adoption, and renewals for mid-market customers
- Run quarterly business reviews and expansion conversations
- Partner with support to resolve escalations
What we're looking for:
- 3+ years in customer success or account management
- Experience with Salesforce and support tooling
- Strong written communication and de-escalation skills`;
const analysis = analyzeJobPost(jd, { currentSituation: "", targetRoles: "", transferableSkills: [], experienceSummary: "", strengths: [], constraints: "", workStyle: "", proofPoints: "", updatedAt: null }, lane("Customer Success Manager", ["customer success", "onboarding", "renewals"]), p8);
const emptyProfile = { currentSituation: "", targetRoles: "", transferableSkills: [], experienceSummary: "", strengths: [], constraints: "", workStyle: "", proofPoints: "", updatedAt: null };
const prep = generateInterviewPrep(emptyProfile, lane("Customer Success Manager", ["customer success", "onboarding", "renewals"]), null, p8);
console.log(`\n${"#".repeat(80)}\n# 8. INTERVIEW-ONLY USER (existing résumé + JD)\n${"#".repeat(80)}`);
console.log(`\n--- JD ANALYSIS: requirements ---`);
(analysis.requirements ?? []).forEach((r) => console.log(`  [${r.status}] ${r.requirement}\n      evidence: ${r.evidence}`));
console.log(`\n--- PREP QUESTIONS (first 8) ---`);
(prep.questions ?? []).slice(0, 8).forEach((q) => console.log(`  [${q.category ?? q.kind ?? "?"}] ${q.question}\n      why/basis: ${(q.why ?? q.basedOn ?? "").slice(0, 140)}`));
console.log(`\n--- REVERSE QUESTIONS ---`);
(prep.reverseQuestions ?? []).forEach((q) => console.log(`  - ${q.question ?? q}`));
