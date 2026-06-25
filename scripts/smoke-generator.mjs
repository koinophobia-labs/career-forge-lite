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
const {
  canUseInterviewMode,
  getFeatureAccess,
  getInterviewModeLimitState
} = loadTsModule(path.join(root, "src/lib/feature-access.ts"));
const {
  canGenerateResumeFromInterview,
  convertInterviewDraftToExistingResumeInput,
  createInitialInterviewSession,
  createUserInterviewMessage,
  generateResumePackageFromInterview,
  getInterviewCoachingMessages,
  getCurrentFieldStatuses,
  getInterviewResumeReadinessSummary,
  getInterviewResumeStrengthLabel,
  getMissingOrWeakFields,
  getNextAssistantQuestion,
  getWeakestInterviewStage,
  updateInterviewDraftFromUserAnswer
} = loadTsModule(path.join(root, "src/lib/interview-mode.ts"));

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

function hasKnownRole(title) {
  const normalized = title.toLowerCase();
  return careerTargets.some((target) => target.title.toLowerCase() === normalized) || Boolean(findJobArsenal(title));
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
assert(hasKnownRole("Support Specialist"), "known role does not need fallback");
assert(!hasKnownRole("Casino Cage Cashier"), "unknown role triggers fallback context path");
const sportsbookArsenal = findJobArsenal("Sportsbook Ticket Writer");
assert(sportsbookArsenal?.responsibilities.includes("Cash handling"), "sportsbook arsenal includes cash handling");
assert(sportsbookArsenal?.workflows.includes("Shift balancing"), "sportsbook arsenal includes workflow prompts");
assert(findJobArsenal("Security Officer")?.skills.includes("De-escalation"), "security arsenal includes de-escalation");

let interviewSession = createInitialInterviewSession();
assert(interviewSession.currentStage === "role_targeting", "interview starts at role targeting");
assert(interviewSession.messages[0]?.role === "assistant", "interview starts with assistant question");
assert(getMissingOrWeakFields(interviewSession).some((field) => field.fieldKey === "targetRole"), "initial interview tracks missing target role");
assert(!canGenerateResumeFromInterview(interviewSession), "interview cannot generate before required fields");
assert(getFeatureAccess("static_builder").accessLevel === "free", "static builder remains free");
assert(getFeatureAccess("interview_mode").accessLevel === "premium_preview", "interview mode defaults to premium preview");
assert(canUseInterviewMode(), "interview mode can be used in preview");
assert(getInterviewModeLimitState(interviewSession).answerLimit === 6, "interview preview has answer limit");
assert(!getInterviewModeLimitState(interviewSession).isLocked, "fresh interview preview is not locked");
assert(getInterviewCoachingMessages(interviewSession).some((message) => /target role/i.test(message)), "weak target coaching exists");

let weakInterviewSession = updateInterviewDraftFromUserAnswer(
  createInitialInterviewSession(),
  createUserInterviewMessage("cs")
);
assert(weakInterviewSession.currentStage === "role_targeting", "weak target answer stays on target stage");
assert(/exact job title|targeting|industry|lane/i.test(getNextAssistantQuestion(weakInterviewSession)), "weak target gets focused follow-up");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("Customer Success Associate in technology")
);
assert(interviewSession.resumeDraft.targetRole.includes("Customer Success Associate"), "interview captures target role");
assert(interviewSession.resumeDraft.targetIndustry.toLowerCase().includes("technology"), "interview captures target industry");
assert(interviewSession.currentStage === "background_overview", "usable target advances to background stage");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("I have customer-facing gaming experience and operations support background.")
);
assert(interviewSession.currentStage === "current_or_recent_role", "usable background advances to role stage");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("I worked as a Sportsbook Ticket Writer at DraftKings from Jan 2024 - Present.")
);
assert(interviewSession.resumeDraft.roles[0]?.title === "Sportsbook Ticket Writer", "interview extracts role title");
assert(interviewSession.resumeDraft.roles[0]?.company === "DraftKings", "interview extracts role company");
assert(interviewSession.currentStage === "responsibilities", "usable role advances to responsibilities");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("I handled customer communication, payment processing, issue escalation, accurate records, and wagering transactions.")
);
assert(interviewSession.resumeDraft.responsibilities.some((item) => /customer communication/i.test(item)), "interview extracts responsibilities");
assert(!canGenerateResumeFromInterview(interviewSession), "interview still requires tools or skills and achievement/project");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("I improved response consistency, reduced transaction errors, and supported 50+ weekly customers.")
);
assert(interviewSession.resumeDraft.achievements.some((item) => /improved response consistency/i.test(item)), "interview extracts achievements");
assert(interviewSession.resumeDraft.metrics.some((item) => /50\+ weekly customers/i.test(item)), "interview extracts metrics");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("I used Zendesk, Excel, Slack, and internal payment systems. Skills include documentation and record keeping.")
);
assert(interviewSession.resumeDraft.tools.includes("Zendesk"), "interview extracts known tools");
assert(interviewSession.resumeDraft.skills.some((item) => /Documentation/i.test(item)), "interview extracts skills");
assert(canGenerateResumeFromInterview(interviewSession), "interview can generate after minimum fields are usable");
assert(/project|education|certifications|training|resume draft|generate/i.test(getNextAssistantQuestion(interviewSession)), "assistant question progresses after readiness");
assert(["Usable", "Strong", "Application Ready"].includes(getInterviewResumeStrengthLabel(interviewSession)), "review strength label is available");

const statuses = getCurrentFieldStatuses(interviewSession);
assert(statuses.find((field) => field.fieldKey === "responsibilities")?.status === "strong", "responsibility status uses specificity");
assert(["usable", "strong"].includes(statuses.find((field) => field.fieldKey === "metrics")?.status), "metric status becomes usable or strong");

interviewSession = {
  ...interviewSession,
  resumeDraft: {
    ...interviewSession.resumeDraft,
    achievements: ["improved response consistency"],
    metrics: ["50+ weekly customers"],
    tools: ["Zendesk", "Excel"],
    skills: ["Customer Communication", "Record Keeping"],
    education: "",
    certifications: []
  }
};
const interviewInput = convertInterviewDraftToExistingResumeInput(interviewSession);
assert(interviewInput.targetJobTitle.includes("Customer Success Associate"), "interview converts target role to existing input");
assert(interviewInput.currentTitle === "Sportsbook Ticket Writer", "interview converts current title to existing input");
assert(interviewInput.currentCompany === "DraftKings", "interview converts company to existing input");
assert(interviewInput.selectedResponsibilities.includes("Customer Communication"), "interview conversion keeps skills/responsibilities");
const interviewResume = generateResumePackage(interviewInput);
const interviewExport = resumeToText(interviewInput, interviewResume);
assert(interviewExport.includes("Customer Success Associate"), "interview-generated export includes target role");
assert(!interviewExport.includes(educationPlaceholder), "interview-generated export omits placeholder education");
assert(!weakTerms.some((term) => interviewExport.toLowerCase().includes(term.toLowerCase())), "interview-generated export avoids weak/UI leakage");

const interviewGeneratedPackage = generateResumePackageFromInterview(interviewSession);
assert(interviewGeneratedPackage.resume.summary.trim(), "interview package has summary");
assert(interviewGeneratedPackage.resume.experience.flatMap((role) => role.bullets).length >= 2, "interview package has bullets");
assert(interviewGeneratedPackage.resume.coreSkills.length >= 3, "interview package has skills");
assert(interviewGeneratedPackage.resume.linkedinHeadline.includes("Customer Success Associate"), "interview package has headline");
assert(resumeToText(interviewGeneratedPackage.intake, interviewGeneratedPackage.resume).includes("SUMMARY"), "interview package has copy-safe resume text");
assert(interviewGeneratedPackage.evidence.some((item) => item.evidence.length), "interview package exposes evidence");

let noMetricSession = createInitialInterviewSession();
for (const answer of [
  "Administrative Assistant in business services",
  "I have office support and customer-facing retail experience.",
  "I worked as a Retail Associate at Target from 2022 - 2024.",
  "I handled scheduling support, customer communication, records, returns, and store presentation.",
  "I improved record accuracy and created smoother follow-up notes.",
  "I used Google Workspace, Excel, Outlook, documentation, and data entry."
]) {
  noMetricSession = updateInterviewDraftFromUserAnswer(noMetricSession, createUserInterviewMessage(answer));
}
assert(canGenerateResumeFromInterview(noMetricSession), "interview can generate without metrics when other proof exists");
const noMetricSummary = getInterviewResumeReadinessSummary(noMetricSession);
assert(noMetricSummary.weakAreas.some((area) => /Scope or metrics/i.test(area)), "missing metrics appear as coaching note");
assert(getInterviewCoachingMessages(noMetricSession).some((message) => /Numbers help recruiters/i.test(message)), "weak metrics coaching exists");
const noMetricPackage = generateResumePackageFromInterview(noMetricSession);
const noMetricText = resumeToText(noMetricPackage.intake, noMetricPackage.resume);
assert(!/fake metric|measurable impact|customers helped/i.test(noMetricText), "missing metrics coaching does not enter resume output");
noMetricSession = {
  ...noMetricSession,
  resumeDraft: { ...noMetricSession.resumeDraft, gapsOrWeakAreas: ["still learning SQL"] }
};
const gapPackage = generateResumePackageFromInterview(noMetricSession);
assert(!resumeToText(gapPackage.intake, gapPackage.resume).includes("still learning SQL"), "gap notes stay out of resume output");
assert(getWeakestInterviewStage(noMetricSession) === "metrics", "Improve Weak Areas routes to weakest useful stage");

let limitSession = createInitialInterviewSession();
for (const answer of [
  "Customer Success Associate in technology",
  "I have customer-facing support experience.",
  "I worked as a Support Associate at Local Business from 2023 - 2024.",
  "I handled customer communication, support tickets, CRM updates, and issue escalation.",
  "I improved follow-up consistency and created cleaner records.",
  "I used Zendesk, Excel, Slack, documentation, and record keeping."
]) {
  limitSession = updateInterviewDraftFromUserAnswer(limitSession, createUserInterviewMessage(answer));
}
const limitState = getInterviewModeLimitState(limitSession);
assert(limitState.answerCount === 6, "preview answer count tracks user turns");
assert(limitState.isLocked, "preview locks after answer limit");
assert(limitState.label.includes("Premium Preview"), "preview state has premium label");

const interviewModeSource = fs.readFileSync(path.join(root, "src/components/InterviewMode.tsx"), "utf8");
const premiumSource = fs.readFileSync(path.join(root, "src/components/PremiumAccess.tsx"), "utf8");
const landingSource = fs.readFileSync(path.join(root, "src/components/LandingPage.tsx"), "utf8");
assert(interviewModeSource.includes("Stop filling out forms"), "premium interview page copy exists");
assert(interviewModeSource.includes("Resume Strength"), "review screen strength label copy exists");
assert(premiumSource.includes("Interview Mode is planned as a premium feature"), "locked panel copy exists");
assert(landingSource.includes("Premium Preview"), "landing page premium badge copy exists");
assert(!/stripe|paymentintent|price_id|publishable_key/i.test(`${interviewModeSource}\n${premiumSource}`), "no real payment integration required");

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

const unknownRoleData = {
  ...initialIntake,
  fullName: "Unknown Role Candidate",
  email: "unknown.role@example.com",
  targetJobTitle: "Customer Success Associate",
  roleFamily: "Customer Success",
  currentTitle: "Casino Cage Cashier",
  currentCompany: "Local Casino",
  currentTime: "2023 - Present",
  customRoleIndustry: "Gaming / Sportsbook",
  customRoleWorkStyles: ["Customer-facing", "Cash handling", "Compliance / safety"],
  customRoleTransferableSkills: ["Payment processing", "Record keeping", "Issue escalation", "Policy enforcement"],
  customersServed: "80+ weekly customers",
  selectedOutcomes: ["Accuracy", "Compliance"]
};
const unknownRoleResume = generateResumePackage(unknownRoleData);
const unknownRoleExport = resumeToText(unknownRoleData, unknownRoleResume);
assert(unknownRoleResume.coreSkills.includes("Payment Processing"), "fallback skills reach core skills");
assert(/gaming and customer transaction environment|payment handling|policy enforcement|record keeping/i.test(unknownRoleExport), "fallback context reaches output");
assert(unknownRoleResume.experience.flatMap((role) => role.bullets).every((bullet) => bullet.trim()), "unknown role has no blank bullets");
assert(!unknownRoleExport.includes(educationPlaceholder), "unknown role export omits placeholder education");
assert(!weakTerms.some((term) => unknownRoleExport.toLowerCase().includes(term.toLowerCase())), "unknown role has no weak leakage");

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
