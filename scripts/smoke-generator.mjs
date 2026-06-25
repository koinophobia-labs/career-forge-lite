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
const {
  allToolOptions,
  careerTargets,
  companySuggestions,
  findJobArsenal,
  initialIntake,
  jobArsenals,
  responsibilitySuggestions,
  toolSuggestionsByFamily
} = loadTsModule(path.join(root, "src/lib/career-data.ts"));
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

function findCareerTarget(title) {
  return careerTargets.find((target) => target.title.toLowerCase() === title.toLowerCase());
}

function searchableCareerTargets(query) {
  const normalizedQuery = query.toLowerCase();
  return careerTargets
    .filter((target) => {
      const title = target.title.toLowerCase();
      const family = target.roleFamily.toLowerCase();
      const aliases = target.aliases?.join(" ").toLowerCase() ?? "";
      return title.includes(normalizedQuery) || family.includes(normalizedQuery) || aliases.includes(normalizedQuery);
    })
    .slice(0, 12);
}

function searchableOptions(options, query) {
  const normalizedQuery = query.toLowerCase();
  return options.filter((option) => option.toLowerCase().includes(normalizedQuery)).slice(0, 10);
}

const roleMappingChecks = [
  ["Warehouse Operations Coordinator", "Operations"],
  ["Manual QA Tester", "Tech"],
  ["Field Support Technician", "IT Support"],
  ["Client Implementation Coordinator", "Project Coordination"],
  ["Customer Care Specialist", "Customer Success"],
  ["Executive Assistant", "Admin"],
  ["Sales Enablement Coordinator", "Sales"],
  ["Reporting Analyst", "Business"]
];

assert(careerTargets.length >= 150 && careerTargets.length <= 250, `career target count ${careerTargets.length}`);
assert(allToolOptions.length >= 150 && allToolOptions.length <= 300, `tool option count ${allToolOptions.length}`);
assert(companySuggestions.length >= 300 && companySuggestions.length <= 500, `company suggestion count ${companySuggestions.length}`);
assert(jobArsenals.length >= 75 && jobArsenals.length <= 100, `job arsenal count ${jobArsenals.length}`);

for (const [title, roleFamily] of roleMappingChecks) {
  const target = findCareerTarget(title);
  assert(target, `career target exists: ${title}`);
  assert(target.roleFamily === roleFamily, `${title} maps to ${roleFamily}`);
}

assert(searchableCareerTargets("client success representative").some((target) => target.title === "Customer Success Associate"), "role aliases are searchable");
assert(searchableCareerTargets("support specialist").some((target) => target.title === "Support Specialist"), "role search filters mapped titles");
assert(searchableCareerTargets("warehouse ops").length <= 12, "role search caps visible results");
assert(searchableOptions(toolSuggestionsByFamily["IT Support"], "service").includes("ServiceNow"), "tool search finds ServiceNow");
assert(searchableOptions(companySuggestions, "draft").includes("DraftKings"), "company search finds DraftKings");
assert(searchableOptions(companySuggestions, "local").includes("Local Business"), "company search finds local fallback");
assert(searchableOptions(responsibilitySuggestions["Customer Success"], "ticket").includes("Support tickets"), "responsibility search filters role-aware options");

const supportSpecialistTarget = findCareerTarget("Support Specialist");
assert(supportSpecialistTarget?.roleFamily === "Customer Success", "known role auto-maps to role family");
const sportsbookArsenal = findJobArsenal("Sportsbook Ticket Writer");
assert(sportsbookArsenal?.responsibilities.includes("Cash handling"), "sportsbook arsenal includes cash handling");
assert(sportsbookArsenal?.workflows.includes("Shift balancing"), "sportsbook arsenal includes workflow prompts");
assert(findJobArsenal("Security Officer")?.skills.includes("De-escalation"), "security arsenal includes de-escalation");

const customRoleData = {
  ...initialIntake,
  fullName: "Custom Role Candidate",
  email: "custom.role@example.com",
  targetJobTitle: "Neighborhood Experience Wrangler",
  roleFamily: "Customer Success",
  currentTitle: "Community Support Associate",
  currentCompany: "Koi Local Studio",
  currentTime: "2024 - Present",
  tools: "Koi Desk, servicenow, macos, google sheets",
  selectedResponsibilities: ["Client communication", "Support tickets"],
  selectedActions: ["resolved issues", "documented updates"],
  customersServed: "40+ weekly customers",
  selectedOutcomes: ["Customer satisfaction"]
};
const customRoleResume = generateResumePackage(customRoleData);
const customRoleExport = resumeToText(customRoleData, customRoleResume);
assert(customRoleExport.includes("Neighborhood Experience Wrangler"), "custom role appears in output");
assert(customRoleExport.includes("Koi Local Studio"), "custom company appears in output");
assert(customRoleResume.coreSkills.includes("Koi Desk"), "custom tool normalizes into skills");
assert(customRoleResume.coreSkills.includes("ServiceNow"), "known tool normalizes ServiceNow");
assert(customRoleResume.coreSkills.includes("macOS"), "known tool normalizes macOS");
assert(customRoleResume.coreSkills.includes("Google Sheets"), "known tool normalizes Google Sheets");

const overrideRoleResume = generateResumePackage({
  ...initialIntake,
  fullName: "Lane Override Candidate",
  email: "lane.override@example.com",
  targetJobTitle: "Support Specialist",
  roleFamily: "Admin",
  currentTitle: "Office Assistant",
  currentCompany: "Local Business",
  currentTime: "2024 - Present",
  tools: "Google Workspace, Excel",
  selectedResponsibilities: ["Scheduling", "Records management"],
  selectedActions: ["maintained records"],
  selectedOutcomes: ["Accuracy"]
});
assert(overrideRoleResume.coreSkills.includes("Calendar Management"), "role family override powers skills");
assert(overrideRoleResume.linkedinHeadline.includes("Administrative Reliability"), "role family override powers LinkedIn value area");

const arsenalResume = generateResumePackage({
  ...initialIntake,
  fullName: "Arsenal Candidate",
  email: "arsenal@example.com",
  targetJobTitle: "Customer Success Associate",
  roleFamily: "Customer Success",
  currentTitle: "Sportsbook Ticket Writer",
  currentCompany: "DraftKings",
  currentTime: "2024 - Present",
  tools: "Payment Systems, ID Verification Systems",
  selectedResponsibilities: ["Cash handling", "Transaction accuracy", "Responsible gaming compliance", "Shift balancing"],
  selectedActions: ["documented updates", "routed escalations"],
  customersServed: "75+ weekly customers",
  selectedOutcomes: ["Accuracy", "Customer satisfaction"]
});
const arsenalText = resumeToText({ ...initialIntake, fullName: "Arsenal Candidate", email: "arsenal@example.com" }, arsenalResume);
assert(arsenalResume.coreSkills.includes("Cash Handling"), "confirmed arsenal responsibility reaches skills");
assert(/transaction accuracy|cash handling|responsible gaming/i.test(arsenalText), "confirmed arsenal language reaches resume text");

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
