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
const resumePreviewSource = fs.readFileSync(path.join(root, "src/components/ResumePreview.tsx"), "utf8");
const globalCssSource = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const tellMyStorySource = fs.existsSync(path.join(root, "src/components/TellMyStoryMode.tsx"))
  ? fs.readFileSync(path.join(root, "src/components/TellMyStoryMode.tsx"), "utf8")
  : "";
const storyModeSource = fs.existsSync(path.join(root, "src/lib/story-mode.ts"))
  ? fs.readFileSync(path.join(root, "src/lib/story-mode.ts"), "utf8")
  : "";

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
  analyzeResumeQuality,
  polishBullets,
  polishResumePackage,
  polishResumeSentence
} = loadTsModule(path.join(root, "src/lib/resume-intelligence.ts"));
const {
  formatParsedRoleConfirmation,
  parseRoleAnswer
} = loadTsModule(path.join(root, "src/lib/natural-role-parser.ts"));
const { parseStoryToDossier } = loadTsModule(path.join(root, "src/lib/story-mode.ts"));
const {
  canUseInterviewMode,
  getFeatureAccess,
  getInterviewModeLimitState
} = loadTsModule(path.join(root, "src/lib/feature-access.ts"));
const {
  canGenerateResumeFromInterview,
  convertInterviewDraftToExistingResumeInput,
  createInitialInterviewSession,
  createNextAssistantInterviewTurn,
  createUserInterviewMessage,
  generateResumePackageFromInterview,
  getInterviewCoachingMessages,
  getCurrentFieldStatuses,
  getInterviewResumeReadinessSummary,
  getInterviewResumeStrengthLabel,
  getMissingOrWeakFields,
  getNextAssistantQuestion,
  getSmartInterviewSummary,
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
assert(resumePreviewSource.includes("ATS Resume") && resumePreviewSource.includes("Visual Portfolio Resume"), "resume view toggle includes ATS and visual modes");
assert(
  ["Professional Sans", "Editorial Serif", "Modern Mono", "Clean System"].every((option) => resumePreviewSource.includes(option)),
  "visual font options are available"
);
assert(
  ["Gold", "Cyan", "Ember", "Slate", "Emerald"].every((option) => resumePreviewSource.includes(option)),
  "visual accent options are available"
);
assert(
  ["Classic Card", "Sidebar Profile", "Portfolio Sheet", "Product Lab"].every((option) => resumePreviewSource.includes(option)),
  "visual layout options are available"
);
assert(["Compact", "Balanced", "Spacious"].every((option) => resumePreviewSource.includes(option)), "visual density options are available");
assert(
  ["Summary", "Strengths", "Experience Highlights", "Skills/Tools", "LinkedIn Headline", "Contact"].every((section) => resumePreviewSource.includes(section)),
  "visual section organization controls are available"
);
assert(resumePreviewSource.includes("moveSection") && resumePreviewSource.includes("toggleSection"), "visual sections can be toggled and reordered");
assert(
  ["data-accent", "data-density", "data-font", "data-layout"].every((hook) => resumePreviewSource.includes(hook)),
  "visual resume exposes print customization hooks"
);
assert(resumePreviewSource.includes("Use ATS Resume for job applications"), "ATS safety copy is visible");
assert(globalCssSource.includes("#print-visual-resume") && globalCssSource.includes(".visual-resume-paper"), "visual resume print target is styled");

assert(polishResumeSentence("i helped customers").includes("Assisted customers"), "grammar pipeline strengthens weak customer phrasing");
assert(polishResumeSentence("i stocked shelves").includes("Maintained organized inventory"), "grammar pipeline rewrites stock phrasing professionally");
const diversifiedBullets = polishBullets(["Managed customer requests.", "Managed customer records.", "Managed follow-ups."]);
assert(new Set(diversifiedBullets.map((bullet) => bullet.split(" ")[0])).size === diversifiedBullets.length, "action verb diversity helper varies repeated openers");
const polishedPackage = polishResumePackage({
  summary: "customer sucess candidate with comunication experience",
  coreSkills: ["crm", "crm", "adminstrative support"],
  experience: [
    {
      title: "Support Associate",
      company: "Example Co",
      time: "2024",
      bullets: ["helped customers", "worked on records", "stuff and things"]
    }
  ],
  education: educationPlaceholder,
  linkedinHeadline: "Customer Success Associate | crm | Client Experience",
  linkedinSummary: "i helped customers"
});
assert(/customer success/i.test(polishedPackage.summary) && polishedPackage.summary.endsWith("."), "resume intelligence fixes spelling and punctuation");
assert(polishedPackage.coreSkills.filter((skill) => skill === "CRM").length === 1, "resume intelligence normalizes and deduplicates skills");
assert(!/stuff|things/i.test(polishedPackage.experience[0].bullets.join(" ")), "resume intelligence removes weak filler terms");

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
assert(interviewSession.memory.repeatedQuestionProtection.length >= 1, "initial conversation memory tracks asked question");

let weakInterviewSession = updateInterviewDraftFromUserAnswer(
  createInitialInterviewSession(),
  createUserInterviewMessage("cs")
);
assert(weakInterviewSession.currentStage === "role_targeting", "weak target answer stays on target stage");
const weakFollowUp = getNextAssistantQuestion(weakInterviewSession);
assert(/That is a start|helpful|Got it/i.test(weakFollowUp), "assistant acknowledges weak answer");
assert(/exact job title|targeting|industry|lane|role/i.test(weakFollowUp), "weak target gets focused follow-up");
const weakTurn = createNextAssistantInterviewTurn(weakInterviewSession);
assert(weakTurn.memory.followUpHistory.length > weakInterviewSession.memory.followUpHistory.length, "assistant turn records follow-up history");
assert(weakTurn.memory.repeatedQuestionProtection.length > weakInterviewSession.memory.repeatedQuestionProtection.length, "assistant turn records duplicate protection");

const repeatQuestion = getNextAssistantQuestion(weakTurn);
assert(repeatQuestion !== weakTurn.messages.at(-1)?.content, "duplicate question prevention changes repeated assistant response");

interviewSession = updateInterviewDraftFromUserAnswer(
  interviewSession,
  createUserInterviewMessage("Customer Success Associate in technology")
);
assert(interviewSession.resumeDraft.targetRole.includes("Customer Success Associate"), "interview captures target role");
assert(interviewSession.resumeDraft.targetIndustry.toLowerCase().includes("technology"), "interview captures target industry");
assert(interviewSession.currentStage === "background_overview", "usable target advances to background stage");
assert(interviewSession.memory.discoveredFacts.some((fact) => /Customer Success Associate/i.test(fact)), "conversation memory stores discovered target");

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
const readyFollowUp = getNextAssistantQuestion(interviewSession);
assert(/Nice|helpful|Perfect|Excellent|Great|That/i.test(readyFollowUp), "assistant acknowledges useful answer");
assert(/project|education|certifications|training|resume draft|generate|proof/i.test(readyFollowUp), "assistant question progresses after readiness");
assert(["Usable", "Strong", "Application Ready"].includes(getInterviewResumeStrengthLabel(interviewSession)), "review strength label is available");
assert(interviewSession.memory.conversationScore > 0, "conversation score increases with useful answers");
const smartSummary = getSmartInterviewSummary(interviewSession);
assert(smartSummary.learned.some((fact) => /DraftKings|Customer Success/i.test(fact)), "smart summary includes learned facts");
assert(Array.isArray(smartSummary.stillLearning), "smart summary includes open topics");

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
const intakeSource = fs.readFileSync(path.join(root, "src/components/IntakeForm.tsx"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
assert(interviewModeSource.includes("Let Career Forge interview you."), "first-screen value proposition exists");
assert(landingSource.includes("guided questions") && landingSource.includes("conversational interview"), "two-path positioning copy exists");
assert(interviewModeSource.includes("Resume Readiness"), "sidebar coach dashboard copy exists");
assert(interviewModeSource.includes("Resume Strength"), "review screen strength label copy exists");
assert(interviewModeSource.includes("Your interview-built resume draft"), "review screen title exists");
assert(interviewModeSource.includes("No metrics yet. Estimate volume"), "empty state coaching copy exists");
assert(interviewModeSource.includes("lg:grid-cols") && interviewModeSource.includes("flex flex-wrap"), "mobile-safe layout structure exists");
assert(!interviewModeSource.includes("Current stage"), "internal stage wording is hidden from UI");
assert(!interviewModeSource.includes("structured signal"), "debug readiness wording is hidden from UI");
assert(premiumSource.includes("Interview Mode is planned as a premium feature"), "locked panel copy exists");
assert(landingSource.includes("Premium Preview"), "landing page premium badge copy exists");
assert(landingSource.includes("Turn your experience into a") && landingSource.includes("recruiter-ready"), "landing page states core product promise");
assert(landingSource.includes("Build My Resume"), "primary landing CTA exists");
assert(landingSource.includes("Try Interview Mode"), "secondary landing CTA exists");
assert(landingSource.includes("Choose your path"), "landing page explains two paths");
assert(landingSource.includes("Guided Builder") && landingSource.includes("Interview Mode"), "landing page compares builder and interview paths");
assert(landingSource.includes("Doesn't invent achievements"), "landing page trust copy exists");
assert(pageSource.includes("Choose Path") && pageSource.includes("Build Resume") && pageSource.includes("Review Resume"), "app workflow labels are launch-ready");
assert(pageSource.includes("Choose your build mode."), "landing CTA opens build mode choice screen");
assert(pageSource.includes("Guided Interview") && pageSource.includes("Tell My Story"), "build mode choices are visible");
assert(pageSource.includes("Answer focused questions.") && pageSource.includes("Best if you want structure."), "guided interview choice has required copy");
assert(pageSource.includes("Describe your work naturally.") && pageSource.includes("Career Forge organizes the details."), "tell-my-story choice has required copy");
assert(pageSource.includes('onClick={() => jump("intake")}'), "guided interview path still opens the existing builder flow");
assert(pageSource.includes('href="/story"'), "tell-my-story path opens story intake mode");
assert(tellMyStorySource.includes("Tell Career Forge about your work history."), "story mode has required story input screen");
assert(tellMyStorySource.includes("I read this as..."), "story mode shows extracted dossier");
assert(tellMyStorySource.includes("Captured") && tellMyStorySource.includes("Still helpful"), "story mode shows missing-info checklist");
assert(tellMyStorySource.includes("Focused follow-up") && tellMyStorySource.includes("You will not need to restart"), "story mode asks focused follow-ups without restart");
assert(tellMyStorySource.includes("Looks right") && tellMyStorySource.includes("Edit details") && tellMyStorySource.includes("Add more context"), "story mode supports dossier actions");
assert(storyModeSource.includes("parseRoleAnswer") && storyModeSource.includes("parseStoryToDossier"), "story mode uses deterministic natural role parser");
assert(resumePreviewSource.includes("Before you apply"), "resume review includes before-apply checklist");
assert(resumePreviewSource.includes("Tailor for each job"), "resume review includes practical next steps");
assert(!/stripe|paymentintent|price_id|publishable_key/i.test(`${interviewModeSource}\n${premiumSource}`), "no real payment integration required");
assert(intakeSource.includes("I'm building my first resume"), "free builder quick start path exists");
assert(intakeSource.includes("Help Me Think"), "free builder help-me-think support exists");
assert(intakeSource.includes("You do not need resume language"), "free builder accepts messy answers");
assert(intakeSource.includes("Skip for now"), "free builder skip path exists");
assert(intakeSource.includes("Not sure"), "free builder not-sure path exists");
assert(intakeSource.includes("Use projects instead"), "free builder project fallback path exists");
assert(intakeSource.includes("Resume Readiness"), "free builder uses readiness progress model");
assert(intakeSource.includes("Ready to Generate"), "free builder readiness language exists");
assert(intakeSource.includes("Approximate numbers are okay"), "free builder metric coaching exists");
assert(intakeSource.includes("Needs More Detail") && intakeSource.includes("Missing"), "free builder confidence labels exist");
assert(
  ["Dossier started", "Career lane locked", "Experience signals captured", "Resume package ready"].every((copy) => intakeSource.includes(copy)),
  "free builder includes professional momentum confirmations"
);
assert(
  ["Identity", "Target", "Experience", "Arsenal", "Proof", "Review"].every((label) => intakeSource.includes(label)),
  "free builder includes mission stage labels"
);
assert(
  ["Lock career lane", "Add experience", "Capture signals", "Review dossier", "Forge resume"].every((copy) => intakeSource.includes(copy)),
  "free builder uses outcome-based continue labels"
);
assert(intakeSource.includes("You gave Career Forge enough signal to build your first resume package."), "free builder completion summary exists");
assert(intakeSource.includes("I read that as:") && intakeSource.includes("Looks right") && intakeSource.includes("Edit details"), "free builder confirms parsed natural role answers");
assert(intakeSource.includes("What was your title?") && intakeSource.includes("What company was that with?"), "free builder has focused low-confidence parsing fallbacks");
assert(!intakeSource.includes("Question {String(questionIndex"), "free builder does not show question count progress");

const foundedParse = parseRoleAnswer("I founded Koinophobia Labs in 2025");
assert(foundedParse.title === "Founder", "natural parser extracts founder title");
assert(foundedParse.company === "Koinophobia Labs", "natural parser extracts founded company");
assert(foundedParse.dates === "2025-Present", "natural parser converts founded year to present");
assert(formatParsedRoleConfirmation(foundedParse).includes("Founder at Koinophobia Labs"), "natural parser formats confirmation");

const workedParse = parseRoleAnswer("I worked at DraftKings as a sportsbook writer from 2024 to now");
assert(workedParse.company === "Draftkings" || workedParse.company === "DraftKings", "natural parser extracts worked-at company");
assert(workedParse.title === "Sportsbook Writer", "natural parser extracts worked-at title");
assert(workedParse.dates === "2024-Present", "natural parser converts now to present");

const securityParse = parseRoleAnswer("I was a security officer at Allied Universal for two years");
assert(securityParse.title === "Security Officer", "natural parser extracts role at company title");
assert(securityParse.company === "Allied Universal", "natural parser extracts role at company company");
assert(securityParse.dates === "2 years", "natural parser converts word duration");

const lowConfidenceParse = parseRoleAnswer("I helped at the front desk");
assert(lowConfidenceParse.confidence === "low" && lowConfidenceParse.missingField === "title", "natural parser flags low-confidence missing title");

const parsedRoleResume = generateResumePackage({
  ...initialIntake,
  fullName: "Parsed Role Candidate",
  email: "parsed.role@example.com",
  targetJobTitle: "Technical Product Analyst",
  roleFamily: "Tech",
  currentTitle: foundedParse.title,
  currentCompany: foundedParse.company,
  currentTime: foundedParse.dates,
  tools: "GitHub, Vercel, Next.js",
  selectedResponsibilities: ["Documentation", "Testing", "Implementation support"],
  selectedActions: ["documented fixes", "tracked work"],
  projectsSupported: "3 shipped projects",
  selectedOutcomes: ["Reliability"]
});
const parsedRoleExport = resumeToText({ ...initialIntake, fullName: "Parsed Role Candidate", email: "parsed.role@example.com" }, parsedRoleResume);
assert(parsedRoleExport.includes("Founder | Koinophobia Labs | 2025-Present"), "generated resume uses parsed role fields");

const storyDossier = parseStoryToDossier(
  "I worked at DraftKings as a sportsbook writer from 2023 to now. I handled customers, cash, wagers, and escalations."
);
assert(storyDossier.extracted.role === "Sportsbook Ticket Writer", "story mode normalizes sportsbook writer role");
assert(storyDossier.extracted.company === "DraftKings", "story mode extracts company");
assert(storyDossier.extracted.dates === "2023-Present", "story mode extracts dates");
assert(storyDossier.extracted.responsibilities.some((item) => /customer|cash|wager|escalation/i.test(item)), "story mode extracts responsibilities");
assert(storyDossier.intake.currentTitle === "Sportsbook Ticket Writer", "story mode feeds parsed role into intake");
assert(storyDossier.intake.currentCompany === "DraftKings", "story mode feeds parsed company into intake");
assert(storyDossier.intake.targetJobTitle, "story mode creates a usable target role fallback");
assert(generateResumePackage(storyDossier.intake).summary.trim(), "story mode intake feeds existing resume generator");
assert(storyDossier.capturedFields.includes("Role") && storyDossier.capturedFields.includes("Company") && storyDossier.capturedFields.includes("Dates"), "story mode checklist marks role company dates captured");
assert(storyDossier.stillHelpfulFields.includes("Contact") && storyDossier.stillHelpfulFields.includes("Tools"), "story mode checklist identifies helpful missing fields");

const partialStoryDossier = parseStoryToDossier("I worked at DraftKings as a sportsbook writer from 2023 to now.");
assert(partialStoryDossier.capturedFields.includes("Role"), "partial story captures role");
assert(partialStoryDossier.capturedFields.includes("Company"), "partial story captures company");
assert(partialStoryDossier.stillHelpfulFields.includes("Responsibilities"), "partial story asks for missing responsibilities");
assert(partialStoryDossier.stillHelpfulFields.includes("Scope"), "partial story asks for missing scope");
assert(partialStoryDossier.focusedFollowUp.length > 10, "partial story gets one focused follow-up");
const storyContactDossier = parseStoryToDossier("I worked at DraftKings as a sportsbook writer from 2023 to now. My name is Jordan Carter and my email is jordan.carter@example.com.");
assert(storyContactDossier.intake.fullName === "Jordan Carter", "story mode extracts clean name from contact follow-up");
assert(storyContactDossier.intake.email === "jordan.carter@example.com", "story mode extracts email from contact follow-up");

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
const unknownRoleQuality = analyzeResumeQuality(unknownRoleData, unknownRoleResume);
assert(unknownRoleResume.coreSkills.includes("Payment Processing"), "fallback skills reach core skills");
assert(/gaming and customer transaction environment|payment handling|policy enforcement|record keeping/i.test(unknownRoleExport), "fallback context reaches output");
assert(unknownRoleResume.experience.flatMap((role) => role.bullets).every((bullet) => bullet.trim()), "unknown role has no blank bullets");
assert(!unknownRoleExport.includes(educationPlaceholder), "unknown role export omits placeholder education");
assert(!weakTerms.some((term) => unknownRoleExport.toLowerCase().includes(term.toLowerCase())), "unknown role has no weak leakage");
assert(["Good", "Strong", "Excellent"].includes(unknownRoleQuality.rating), "unknown role receives usable resume quality rating");

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
  const quality = analyzeResumeQuality(data, resume);

  assert(sentenceCount(resume.summary) <= 3 && sentenceCount(resume.summary) >= 1, `${persona.name}: summary sentence count`);
  assert(resume.summary.includes(persona.targetJobTitle), `${persona.name}: summary includes target role`);
  assert(resume.experience.length >= 1, `${persona.name}: generated experience`);
  assert(allBullets.every((bullet) => bullet.trim()), `${persona.name}: no blank bullets`);
  assert(uniqueBullets.size === allBullets.length, `${persona.name}: no duplicate bullets`);
  assert(
    resume.experience.every((role) => {
      const openers = role.bullets.map((bullet) => bullet.split(" ")[0]?.toLowerCase()).filter(Boolean);
      return openers.length === new Set(openers).size;
    }),
    `${persona.name}: opening verbs are diversified`
  );
  assert(resume.experience.every((role) => role.bullets.length >= 2 && role.bullets.length <= 4), `${persona.name}: reasonable bullet count`);
  assert(!weakTerms.some((term) => exportText.toLowerCase().includes(term.toLowerCase())), `${persona.name}: weak/UI term leaked`);
  assert(!unnaturalToolPattern.test(exportText), `${persona.name}: unnatural tool phrase`);
  assert(!exportText.includes(educationPlaceholder), `${persona.name}: placeholder education omitted from export`);
  assert(exportText.includes(persona.targetJobTitle), `${persona.name}: export includes selected target`);
  assert(!/Visual Portfolio Resume|Executive Dark|Clean Modern|Product Lab|Professional Sans|Editorial Serif|Modern Mono|Clean System|Use ATS Resume/i.test(exportText), `${persona.name}: ATS export excludes visual resume chrome`);
  assert(["Good", "Strong", "Excellent"].includes(quality.rating), `${persona.name}: resume quality rating is usable`);
  assert(quality.strongestSections.length > 0, `${persona.name}: resume quality strongest sections exist`);
  assert(quality.suggestedImprovements.length > 0, `${persona.name}: resume quality coaching exists`);
  assert(!/fake metric|invented|guaranteed/i.test(exportText), `${persona.name}: no fabricated metric language`);
  assert(exportText.includes("SUMMARY") && exportText.includes("CORE SKILLS") && exportText.includes("EXPERIENCE"), `${persona.name}: ATS section order exists`);
}

console.log(`Generator smoke passed for ${personas.length} personas.`);
