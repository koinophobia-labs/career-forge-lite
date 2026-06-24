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

const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));
const { educationPlaceholder, resumeToText } = loadTsModule(path.join(root, "src/lib/resume-export.ts"));

const personas = [
  {
    name: "Sportsbook Ticket Writer",
    targetJobTitle: "Customer Success Associate",
    roleFamily: "Customer Success",
    currentTitle: "Sportsbook Ticket Writer",
    currentCompany: "DraftKings",
    currentTime: "Jan 2024 - Present",
    previousTitle: "Retail Associate",
    previousCompany: "Target",
    previousTime: "Jun 2022 - Dec 2023",
    tools: "Zendesk, Slack, Excel",
    selectedResponsibilities: ["Support tickets", "Client communication", "Escalation handling", "CRM updates"],
    selectedActions: ["resolved issues", "documented updates", "followed up with customers"],
    customersServed: "50+ weekly customers",
    ticketsHandled: "25+ tickets",
    callsHandled: "25+ weekly calls",
    selectedOutcomes: ["Customer satisfaction", "Accuracy"]
  },
  {
    name: "Sportsbook Supervisor",
    targetJobTitle: "Operations Associate",
    roleFamily: "Operations",
    currentTitle: "Sportsbook Supervisor",
    currentCompany: "Riverline Sportsbook",
    currentTime: "Feb 2023 - Present",
    previousTitle: "Sportsbook Ticket Writer",
    previousCompany: "DraftKings",
    previousTime: "Jan 2021 - Jan 2023",
    tools: "Excel, Google Sheets, Slack",
    selectedResponsibilities: ["Task coordination", "Reporting", "Scheduling", "Process improvement"],
    selectedActions: ["tracked work", "prepared reports", "coordinated schedules"],
    customersServed: "100+ weekly customers",
    teamSizeSupported: "6-10 people",
    reportsCreated: "5+ weekly reports",
    selectedOutcomes: ["Accuracy", "Efficiency"]
  },
  {
    name: "Security Officer",
    targetJobTitle: "Operations Associate",
    roleFamily: "Operations",
    currentTitle: "Security Officer",
    currentCompany: "United Airlines",
    currentTime: "Mar 2023 - Present",
    previousTitle: "Front Desk Associate",
    previousCompany: "Best Buy",
    previousTime: "May 2021 - Feb 2023",
    tools: "Excel, Google Sheets, Microsoft Teams",
    selectedResponsibilities: ["Reporting", "Task coordination", "Scheduling"],
    selectedActions: ["prepared reports", "tracked work", "maintained records"],
    customersServed: "100+ weekly customers",
    teamSizeSupported: "3-5 people",
    reportsCreated: "5+ weekly reports",
    selectedOutcomes: ["Reliability", "Compliance"]
  },
  {
    name: "Retail Associate",
    targetJobTitle: "Administrative Assistant",
    roleFamily: "Admin",
    currentTitle: "Retail Associate",
    currentCompany: "Target",
    currentTime: "Jun 2022 - Present",
    previousTitle: "Cashier",
    previousCompany: "Walgreens",
    previousTime: "May 2021 - May 2022",
    tools: "Google Workspace, Excel, Outlook",
    selectedResponsibilities: ["Scheduling", "Records management", "Office support", "Data entry"],
    selectedActions: ["coordinated schedules", "maintained records", "entered data accurately"],
    callsHandled: "25+ weekly calls",
    reportsCreated: "10+ weekly reports",
    teamSizeSupported: "3-5 people",
    selectedOutcomes: ["Accuracy", "Efficiency"]
  },
  {
    name: "Entry-level IT Support",
    targetJobTitle: "Help Desk Technician",
    roleFamily: "IT Support",
    currentTitle: "IT Support Intern",
    currentCompany: "CloudDesk",
    currentTime: "Apr 2024 - Present",
    previousTitle: "Retail Associate",
    previousCompany: "Best Buy",
    previousTime: "Jan 2022 - Mar 2024",
    tools: "Active Directory, ServiceNow, Windows, Office 365",
    selectedResponsibilities: ["Troubleshooting", "Ticket management", "Documentation", "User support"],
    selectedActions: ["troubleshot issues", "resolved tickets", "documented fixes"],
    ticketsHandled: "50+ tickets",
    customersServed: "50+ weekly users",
    reportsCreated: "5+ weekly reports",
    selectedOutcomes: ["Speed", "Reliability"]
  },
  {
    name: "Project Coordinator",
    targetJobTitle: "Project Coordinator",
    roleFamily: "Project Coordination",
    currentTitle: "Project Coordinator",
    currentCompany: "BrightBuild Studio",
    currentTime: "Sep 2023 - Present",
    previousTitle: "Administrative Coordinator",
    previousCompany: "Northstar Services",
    previousTime: "Jan 2022 - Aug 2023",
    tools: "Asana, Google Sheets, Slack, Notion",
    selectedResponsibilities: ["Timeline tracking", "Status reporting", "Documentation", "Stakeholder communication"],
    selectedActions: ["tracked milestones", "updated stakeholders", "prepared status notes"],
    projectsSupported: "3-5 active projects",
    teamSizeSupported: "6-10 people",
    reportsCreated: "5+ weekly reports",
    selectedOutcomes: ["Efficiency", "Reliability"]
  }
];

const weakTerms = [" ee ", "test", "asdf", "candidate targeting", "customers customers", "tickets tickets", "Copy Summary", "Copy Skills", "Copy Experience"];
const unnaturalToolPattern = /managed onboarding using python/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sentenceCount(value) {
  return (value.match(/[^.!?]+[.!?]+/g) || []).length;
}

for (const persona of personas) {
  const data = {
    ...initialIntake,
    fullName: `${persona.name} Candidate`,
    email: `${persona.name.toLowerCase().replaceAll(" ", ".")}@example.com`,
    ...persona
  };
  const resume = generateResumePackage(data);
  const exportText = resumeToText(data, resume);
  const allBullets = resume.experience.flatMap((role) => role.bullets);
  const uniqueBullets = new Set(allBullets.map((bullet) => bullet.toLowerCase()));

  assert(sentenceCount(resume.summary) <= 3 && sentenceCount(resume.summary) >= 1, `${persona.name}: summary sentence count`);
  assert(resume.summary.includes(persona.targetJobTitle), `${persona.name}: summary includes target role`);
  assert(resume.experience.length >= 1, `${persona.name}: generated experience`);
  assert(allBullets.every((bullet) => bullet.trim()), `${persona.name}: no blank bullets`);
  assert(uniqueBullets.size === allBullets.length, `${persona.name}: no duplicate bullets`);
  assert(resume.experience.every((role) => role.bullets.length >= 2 && role.bullets.length <= 4), `${persona.name}: reasonable bullet count`);
  assert(!weakTerms.some((term) => exportText.toLowerCase().includes(term.toLowerCase())), `${persona.name}: weak/UI term leaked`);
  assert(!unnaturalToolPattern.test(exportText), `${persona.name}: unnatural tool phrase`);
  assert(!exportText.includes(educationPlaceholder), `${persona.name}: placeholder education omitted from export`);
  assert(exportText.includes(persona.targetJobTitle), `${persona.name}: export includes selected target`);
}

console.log(`Generator smoke passed for ${personas.length} personas.`);
