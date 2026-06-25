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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
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

const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));
const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { educationPlaceholder, resumeToText } = loadTsModule(path.join(root, "src/lib/resume-export.ts"));
const { analyzeResumeQuality, polishResumeSentence } = loadTsModule(path.join(root, "src/lib/resume-intelligence.ts"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function intake(overrides) {
  return {
    ...initialIntake,
    fullName: "Jordan Rivera",
    email: "jordan@example.com",
    targetJobTitle: "Customer Success Associate",
    roleFamily: "Customer Success",
    currentTitle: "Customer Service Associate",
    currentCompany: "Local Business",
    currentTime: "2024 - Present",
    selectedOutcomes: ["Accuracy"],
    ...overrides
  };
}

const directTransformations = [
  {
    before: "i helped customers",
    expected: /Assisted customers by resolving questions and providing accurate support\./
  },
  {
    before: "i did cash register",
    expected: /Processed customer transactions accurately using point-of-sale systems\./
  },
  {
    before: "i answered phones",
    expected: /Managed inbound calls while assisting customers and routing requests appropriately\./
  },
  {
    before: "i stocked shelves",
    expected: /Maintained organized inventory and restocked merchandise to support daily operations\./
  },
  {
    before: "customer sucess with comunication and crm",
    expected: /Customer success with communication and CRM\./
  },
  {
    before: "responsible for records and various things",
    expected: /Managed records\./
  }
];

const profiles = [
  {
    id: "terrible_grammar",
    raw: "i helped customers and comunication was big no punctuation",
    data: intake({
      targetJobTitle: "Customer Support Specialist",
      currentTitle: "customer suport helper",
      currentCompany: "walgreens",
      tools: "crm, excel",
      responsibilities: "i helped customers and comunication was big no punctuation",
      selectedResponsibilities: ["Customer communication", "Support tickets"],
      selectedActions: ["resolved issues"],
      customersServed: "40+ customers per shift"
    }),
    expectedTerms: [/Customer Support Specialist/i, /CRM|Excel/i, /40\+ customers/i]
  },
  {
    id: "no_punctuation",
    raw: "answered phones helped people routed questions wrote notes",
    data: intake({
      targetJobTitle: "Administrative Assistant",
      roleFamily: "Admin",
      currentTitle: "Front Desk Associate",
      currentCompany: "Clinic Office",
      tools: "Microsoft Office, Outlook",
      responsibilities: "answered phones helped people routed questions wrote notes",
      selectedResponsibilities: ["Scheduling", "Records management", "Office support"],
      callsHandled: "25+ calls daily"
    }),
    expectedTerms: [/Administrative Assistant/i, /25\+ calls/i]
  },
  {
    id: "one_word_answers",
    raw: "customers excel",
    data: intake({
      targetJobTitle: "Customer Success Associate",
      currentTitle: "Cashier",
      currentCompany: "Target",
      tools: "Excel",
      responsibilities: "customers",
      selectedResponsibilities: ["Customer communication"],
      selectedActions: ["followed up with customers"]
    }),
    expectedTerms: [/Customer Success Associate/i, /Excel/i]
  },
  {
    id: "very_short_answers",
    raw: "tickets zendesk 30 weekly",
    data: intake({
      targetJobTitle: "Support Specialist",
      currentTitle: "Support Clerk",
      currentCompany: "Helpdesk Co",
      tools: "Zendesk",
      responsibilities: "tickets",
      selectedResponsibilities: ["Support tickets", "Escalation handling"],
      ticketsHandled: "30 weekly tickets"
    }),
    expectedTerms: [/Zendesk/i, /30 weekly tickets/i]
  },
  {
    id: "run_on_sentences",
    raw: "i worked at amazon and helped with schedules and reports and orders and updates and people asked me questions and i fixed them",
    data: intake({
      targetJobTitle: "Operations Associate",
      roleFamily: "Operations",
      currentTitle: "Operations Associate",
      currentCompany: "Amazon",
      tools: "Excel, Slack",
      responsibilities: "i worked at amazon and helped with schedules and reports and orders and updates and people asked me questions and i fixed them",
      selectedResponsibilities: ["Reporting", "Scheduling", "Task coordination"],
      reportsCreated: "5 weekly reports",
      selectedOutcomes: ["Efficiency"]
    }),
    expectedTerms: [/Operations Associate/i, /5 weekly reports/i]
  },
  {
    id: "non_native_english",
    raw: "i make reports for manager and support customer question using excel",
    data: intake({
      targetJobTitle: "Business Operations Associate",
      roleFamily: "Business",
      currentTitle: "Office Assistant",
      currentCompany: "Small Business",
      tools: "Excel, Google Sheets",
      responsibilities: "i make reports for manager and support customer question using excel",
      selectedResponsibilities: ["Reporting", "Stakeholder support", "Documentation"],
      selectedActions: ["prepared reports"],
      reportsCreated: "3 weekly reports"
    }),
    expectedTerms: [/Business Operations Associate/i, /Excel/i]
  },
  {
    id: "customer_service",
    raw: "helped upset customers returns register questions",
    data: intake({
      targetJobTitle: "Customer Success Associate",
      currentTitle: "Customer Service Representative",
      currentCompany: "Best Buy",
      tools: "POS Systems, Microsoft Teams",
      responsibilities: "helped upset customers returns register questions",
      selectedResponsibilities: ["Client communication", "Escalation handling", "CRM updates"],
      selectedActions: ["resolved issues", "routed escalations"],
      customersServed: "60+ customers per shift"
    }),
    expectedTerms: [/60\+ customers/i, /POS Systems/i]
  },
  {
    id: "retail",
    raw: "stocked shelves did cash register helped shoppers",
    data: intake({
      targetJobTitle: "Administrative Assistant",
      roleFamily: "Admin",
      currentTitle: "Retail Associate",
      currentCompany: "Target",
      tools: "POS Systems, Excel",
      responsibilities: "stocked shelves did cash register helped shoppers",
      selectedResponsibilities: ["Records management", "Data entry", "Office support"],
      customersServed: "80+ customers weekly"
    }),
    expectedTerms: [/Administrative Assistant/i, /80\+ customers/i]
  },
  {
    id: "restaurant",
    raw: "took orders kept area clean helped guests",
    data: intake({
      targetJobTitle: "Customer Experience Associate",
      currentTitle: "Server",
      currentCompany: "Local Restaurant",
      tools: "Toast, Square",
      responsibilities: "took orders kept area clean helped guests",
      selectedResponsibilities: ["Customer communication", "Client communication"],
      callsHandled: "40+ orders per shift"
    }),
    expectedTerms: [/Customer Experience Associate/i, /40\+ orders/i]
  },
  {
    id: "warehouse",
    raw: "scanned boxes moved stuff inventory things",
    data: intake({
      targetJobTitle: "Operations Coordinator",
      roleFamily: "Operations",
      currentTitle: "Warehouse Associate",
      currentCompany: "FedEx",
      tools: "RF Scanners, WMS",
      responsibilities: "scanned boxes moved stuff inventory things",
      selectedResponsibilities: ["Task coordination", "Process improvement", "Reporting"],
      selectedActions: ["tracked work"],
      projectsSupported: "200+ packages per shift"
    }),
    expectedTerms: [/Operations Coordinator/i, /200\+ packages/i]
  },
  {
    id: "healthcare_support",
    raw: "scheduled patients records phones insurance questions",
    data: intake({
      targetJobTitle: "Administrative Coordinator",
      roleFamily: "Admin",
      currentTitle: "Patient Services Representative",
      currentCompany: "Northwestern Medicine",
      tools: "Epic, Outlook, Excel",
      responsibilities: "scheduled patients records phones insurance questions",
      selectedResponsibilities: ["Scheduling", "Records management", "Office support"],
      callsHandled: "35+ calls daily",
      selectedOutcomes: ["Accuracy"]
    }),
    expectedTerms: [/Administrative Coordinator/i, /35\+ calls/i]
  },
  {
    id: "student",
    raw: "school project github class no job",
    data: intake({
      targetJobTitle: "Junior QA Analyst",
      roleFamily: "Tech",
      currentTitle: "Student Project Lead",
      currentCompany: "Course Project",
      currentTime: "2025",
      tools: "GitHub, Google Sheets",
      responsibilities: "school project github class no job",
      selectedResponsibilities: ["Testing", "Documentation"],
      selectedActions: ["documented fixes"],
      projectsSupported: "2 class projects"
    }),
    expectedTerms: [/Junior QA Analyst/i, /GitHub/i]
  },
  {
    id: "career_changer",
    raw: "retail but want office admin i did schedule stuff and records",
    data: intake({
      targetJobTitle: "Administrative Assistant",
      roleFamily: "Admin",
      currentTitle: "Retail Associate",
      currentCompany: "Walmart",
      tools: "Excel, Microsoft Office",
      responsibilities: "retail but want office admin i did schedule stuff and records",
      selectedResponsibilities: ["Scheduling", "Records management", "Data entry"],
      teamSizeSupported: "8-person store team"
    }),
    expectedTerms: [/Administrative Assistant/i, /8-person store team/i]
  },
  {
    id: "technical_founder",
    raw: "built apps github vercel nextjs did everything",
    data: intake({
      targetJobTitle: "Technical Product Analyst",
      roleFamily: "Tech",
      currentTitle: "Founder",
      currentCompany: "Koinophobia Labs",
      tools: "GitHub, Vercel, Next.js, TypeScript",
      responsibilities: "built apps github vercel nextjs did everything",
      selectedResponsibilities: ["Documentation", "Testing", "Implementation support"],
      selectedActions: ["documented fixes", "tracked work"],
      projectsSupported: "4 shipped projects"
    }),
    expectedTerms: [/Technical Product Analyst/i, /4 shipped projects/i]
  },
  {
    id: "developer",
    raw: "coded frontend fixed bugs used api and sql",
    data: intake({
      targetJobTitle: "Junior Software Developer",
      roleFamily: "Tech",
      currentTitle: "Web Developer Intern",
      currentCompany: "Startup Studio",
      tools: "React, SQL, API, GitHub",
      responsibilities: "coded frontend fixed bugs used api and sql",
      selectedResponsibilities: ["Testing", "Documentation", "Troubleshooting"],
      selectedActions: ["troubleshot issues", "documented fixes"],
      projectsSupported: "3 web features"
    }),
    expectedTerms: [/Junior Software Developer/i, /SQL|API/i]
  },
  {
    id: "security",
    raw: "watched doors wrote incident stuff helped people",
    data: intake({
      targetJobTitle: "Operations Associate",
      roleFamily: "Operations",
      currentTitle: "Security Officer",
      currentCompany: "United Airlines",
      tools: "Microsoft Teams, Excel",
      responsibilities: "watched doors wrote incident stuff helped people",
      selectedResponsibilities: ["Reporting", "Task coordination", "Scheduling"],
      selectedActions: ["maintained records", "prepared reports"],
      reportsCreated: "6 incident reports weekly"
    }),
    expectedTerms: [/Operations Associate/i, /6 incident reports/i]
  },
  {
    id: "construction",
    raw: "helped crew tracked materials safety daily tasks",
    data: intake({
      targetJobTitle: "Operations Coordinator",
      roleFamily: "Operations",
      currentTitle: "Construction Laborer",
      currentCompany: "Local Contractor",
      tools: "Excel, Mobile Forms",
      responsibilities: "helped crew tracked materials safety daily tasks",
      selectedResponsibilities: ["Task coordination", "Scheduling", "Reporting"],
      teamSizeSupported: "5-person crew",
      selectedOutcomes: ["Safety", "Efficiency"]
    }),
    expectedTerms: [/Operations Coordinator/i, /5-person crew/i]
  },
  {
    id: "office_administrator",
    raw: "calendar emails records meetings responsible for office things",
    data: intake({
      targetJobTitle: "Office Coordinator",
      roleFamily: "Admin",
      currentTitle: "Office Administrator",
      currentCompany: "Small Business",
      tools: "Outlook, Microsoft Office, DocuSign",
      responsibilities: "calendar emails records meetings responsible for office things",
      selectedResponsibilities: ["Calendar management", "Records management", "Office support"],
      reportsCreated: "10+ weekly documents"
    }),
    expectedTerms: [/Office Coordinator/i, /10\+ weekly documents/i]
  },
  {
    id: "project_heavy",
    raw: "managed projects timelines meetings reports asana stakeholders",
    data: intake({
      targetJobTitle: "Project Coordinator",
      roleFamily: "Project Coordination",
      currentTitle: "Project Assistant",
      currentCompany: "BrightBuild Studio",
      tools: "Asana, Slack, Notion",
      responsibilities: "managed projects timelines meetings reports asana stakeholders",
      selectedResponsibilities: ["Timeline tracking", "Status reporting", "Stakeholder communication"],
      selectedActions: ["tracked milestones", "updated stakeholders"],
      projectsSupported: "5 active projects"
    }),
    expectedTerms: [/Project Coordinator/i, /5 active projects/i]
  },
  {
    id: "low_confidence",
    raw: "i dont know i just helped and did my job",
    data: intake({
      targetJobTitle: "Customer Support Specialist",
      currentTitle: "Team Member",
      currentCompany: "Local Business",
      tools: "Google Workspace",
      responsibilities: "i dont know i just helped and did my job",
      selectedResponsibilities: ["Customer communication", "Documentation"],
      selectedActions: ["followed up with customers"]
    }),
    expectedTerms: [/Customer Support Specialist/i, /Google Workspace/i]
  }
];

const weakTerms = /\bstuff\b|\bthings\b|\bvarious\b|candidate targeting|customers customers|tickets tickets|Copy Summary|Copy Skills|Copy Experience/i;
const fabricatedMetricTerms = /guaranteed|fake metric|invented|\b30% faster\b|\b10x\b/i;
const forbiddenFormatting = /<table|<\/table|📊|✅|⭐|skill bar|sidebar/i;

const transformationResults = directTransformations.map((item) => {
  const after = polishResumeSentence(item.before);
  assert(item.expected.test(after), `direct transformation failed: ${item.before} -> ${after}`);
  assert(/^[A-Z]/.test(after) && /[.!?]$/.test(after), `direct transformation has readable sentence flow: ${after}`);
  return { before: item.before, after };
});

const results = profiles.map((profile) => {
  const resume = generateResumePackage(profile.data);
  const exportText = resumeToText(profile.data, resume);
  const quality = analyzeResumeQuality(profile.data, resume);
  const bullets = resume.experience.flatMap((role) => role.bullets);
  const openers = bullets.map((bullet) => bullet.split(" ")[0]?.toLowerCase()).filter(Boolean);
  const uniqueOpeners = new Set(openers);

  assert(resume.summary.trim().length > 40, `${profile.id}: summary is present`);
  assert(resume.coreSkills.length >= 4, `${profile.id}: skills are present`);
  assert(bullets.length >= 2, `${profile.id}: bullets are present`);
  assert(bullets.every((bullet) => /^[A-Z]/.test(bullet) && /[.!?]$/.test(bullet)), `${profile.id}: bullets are readable sentences`);
  assert(new Set(bullets.map((bullet) => bullet.toLowerCase())).size === bullets.length, `${profile.id}: no duplicate bullets`);
  assert(uniqueOpeners.size >= Math.min(openers.length, 2), `${profile.id}: action verb diversity exists`);
  assert(!weakTerms.test(exportText), `${profile.id}: weak terms and UI labels do not leak`);
  assert(!fabricatedMetricTerms.test(exportText), `${profile.id}: no fabricated metric language`);
  assert(!forbiddenFormatting.test(exportText), `${profile.id}: ATS-safe text export`);
  assert(!exportText.includes(educationPlaceholder), `${profile.id}: placeholder education omitted`);
  assert(exportText.includes("SUMMARY") && exportText.includes("CORE SKILLS") && exportText.includes("EXPERIENCE"), `${profile.id}: standard headings exist`);
  assert(["Good", "Strong", "Excellent"].includes(quality.rating), `${profile.id}: quality rating is usable`);
  assert(quality.suggestedImprovements.length > 0, `${profile.id}: coaching notes exist`);
  profile.expectedTerms.forEach((pattern) => {
    assert(pattern.test(exportText), `${profile.id}: expected truthful term missing: ${pattern}`);
  });

  return {
    id: profile.id,
    raw: profile.raw,
    rating: quality.rating,
    score: quality.score,
    coaching: quality.suggestedImprovements.slice(0, 2),
    actionVerbDiversity: `${uniqueOpeners.size}/${openers.length}`,
    sampleBullet: bullets[0],
    sampleHeadline: resume.linkedinHeadline
  };
});

const ratingCounts = results.reduce((counts, result) => {
  counts[result.rating] = (counts[result.rating] ?? 0) + 1;
  return counts;
}, {});

console.log(
  JSON.stringify(
    {
      transformations: transformationResults,
      profilesTested: results.length,
      ratingCounts,
      sampleResults: results.slice(0, 5)
    },
    null,
    2
  )
);
