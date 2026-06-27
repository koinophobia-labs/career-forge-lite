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
const {
  findIndependentWorkRole,
  independentWorkRoles,
  inferIndependentWorkCategory
} = loadTsModule(path.join(root, "src/lib/independent-work-intelligence.ts"));
const {
  certificationBank,
  degreeMajorBank,
  educationTypes,
  extractEducationEntries,
  findEducationSuggestions,
  formatEducationEntries,
  tradeEducationBank
} = loadTsModule(path.join(root, "src/lib/education-intelligence.ts"));
const {
  aiToolOptions,
  aiWorkflowOptions,
  selectedAiTools
} = loadTsModule(path.join(root, "src/lib/modern-work-intelligence.ts"));
const { parseStoryToDossier } = loadTsModule(path.join(root, "src/lib/story-mode.ts"));
const {
  getMissingSignals,
  getNextUsefulPrompt,
  getResumeSignalScore,
  hasEnoughResumeSignal,
  mergeReactiveSignals
} = loadTsModule(path.join(root, "src/lib/interview-state.ts"));
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

function visualCoreText(data, resume) {
  const contact = [data.email, data.phone, data.website].filter(Boolean).join(" | ");
  const sections = [
    data.fullName,
    contact,
    resume.linkedinHeadline,
    resume.summary,
    resume.coreSkills.join(", "),
    resume.experience
      .map((role) => `${role.title} | ${role.company} | ${role.time}\n${role.bullets.filter(Boolean).join("\n")}`)
      .join("\n\n"),
    resume.education && resume.education !== educationPlaceholder ? resume.education : ""
  ];
  return sections.filter(Boolean).join("\n\n");
}

function textHasAny(text, values) {
  const lower = text.toLowerCase();
  return values.filter(Boolean).some((value) => lower.includes(String(value).toLowerCase()));
}

function assertProfessionalResume(data, resume, label) {
  const exportText = resumeToText(data, resume);
  const bullets = resume.experience.flatMap((role) => role.bullets.filter(Boolean));
  const quality = analyzeResumeQuality(data, resume);

  assert(resume.summary.trim().length > 40, `${label}: summary is substantive`);
  assert(resume.linkedinHeadline.includes(data.targetJobTitle), `${label}: LinkedIn headline includes target role`);
  assert(resume.coreSkills.length >= 6, `${label}: skills are populated`);
  assert(bullets.length >= 3, `${label}: experience bullets are populated`);
  assert(bullets.every((bullet) => bullet.trim() && !/candidate targeting|various things|stuff/i.test(bullet)), `${label}: bullets are professional`);
  assert(!exportText.includes(educationPlaceholder), `${label}: education placeholder omitted from export`);
  assert(["Good", "Strong", "Excellent"].includes(quality.rating), `${label}: resume quality rating is useful`);
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

assert(careerTargets.length >= 200 && careerTargets.length <= 330, `career target count ${careerTargets.length}`);
assert(allToolOptions.length >= 150 && allToolOptions.length <= 300, `tool option count ${allToolOptions.length}`);
assert(companySuggestions.length >= 300 && companySuggestions.length <= 500, `company suggestion count ${companySuggestions.length}`);
assert(jobArsenals.length >= 120 && jobArsenals.length <= 170, `job arsenal count ${jobArsenals.length}`);
assert(independentWorkRoles.length >= 50, "independent work role bank includes broad nontraditional coverage");

for (const [title, roleFamily] of roleMappingChecks) {
  const target = findCareerTarget(title);
  assert(target, `career target exists: ${title}`);
  assert(target.roleFamily === roleFamily, `${title} maps to ${roleFamily}`);
}

assert(searchableCareerTargets("client success representative").some((target) => target.title === "Customer Success Associate"), "role aliases are searchable");
assert(searchableCareerTargets("support specialist").some((target) => target.title === "Support Specialist"), "role search filters mapped titles");
assert(searchableCareerTargets("warehouse ops").length <= 12, "role search caps visible results");
assert(searchableOptions(toolSuggestionsByFamily["IT Support"], "service").includes("ServiceNow"), "tool search finds ServiceNow");
assert(aiToolOptions.includes("ChatGPT") && aiToolOptions.includes("GitHub Copilot") && aiToolOptions.includes("n8n"), "AI tool bank includes modern productivity tools");
assert(allToolOptions.includes("ChatGPT") && allToolOptions.includes("Cursor") && allToolOptions.includes("Perplexity"), "AI tools are searchable tool options");
assert(aiWorkflowOptions.includes("Research") && aiWorkflowOptions.includes("Workflow automation") && aiWorkflowOptions.includes("Rapid prototyping"), "AI workflow options are available");
assert(searchableOptions(companySuggestions, "draft").includes("DraftKings"), "company search finds DraftKings");
assert(searchableOptions(companySuggestions, "local").includes("Local Business"), "company search finds local fallback");
assert(searchableOptions(responsibilitySuggestions["Customer Success"], "ticket").includes("Support tickets"), "responsibility search filters role-aware options");
assert(findIndependentWorkRole("DoorDash Courier")?.category === "Gig / Delivery", "independent role maps to gig delivery");
assert(findIndependentWorkRole("Etsy Seller")?.category === "Online Commerce", "independent role maps to online commerce");
assert(inferIndependentWorkCategory("I make TikToks and edit videos") === "Creator / Media", "story text infers creator work");
assert(educationTypes.includes("Military Training") && educationTypes.includes("Self-Directed Learning"), "education types include nontraditional learning");
assert(degreeMajorBank.includes("Computer Science") && degreeMajorBank.includes("Construction Management"), "degree and major bank includes common academic paths");
assert(certificationBank.some((item) => item.label.includes("CompTIA A+")) && certificationBank.some((item) => item.label.includes("ServSafe")), "certification bank includes technology and hospitality credentials");
assert(tradeEducationBank.some((item) => item.trade === "Electrician") && tradeEducationBank.some((item) => item.trade === "CDL"), "trade bank includes skilled trade credentials");
assert(findEducationSuggestions("cyber").includes("Cybersecurity"), "education search finds majors");
assert(findEducationSuggestions("security+").some((item) => /Security/.test(item)), "education search finds certification aliases");
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
  ["Summary", "Strengths", "Experience Highlights", "Skills/Tools", "LinkedIn Headline", "Contact", "Education"].every((section) => resumePreviewSource.includes(section)),
  "visual section organization controls are available"
);
assert(!resumePreviewSource.includes(".slice(0, 5);"), "visual resume does not cap experience highlights at five bullets");
assert(!resumePreviewSource.includes("email | phone | portfolio"), "resume previews avoid contact placeholder leakage");
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
assert(intakeSource.includes("Any education, training, or credentials to include?"), "guided builder includes education credential step");
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
const storyEducationDossier = parseStoryToDossier("My name is Jordan Carter and my email is jordan@example.com. I worked at DraftKings as a sportsbook writer from 2023 to now targeting Customer Success Associate. I handled customers, escalations, and account questions using Zendesk and Excel. I supported 50+ weekly customers and improved customer satisfaction. I completed a Google Career Certificate in 2024.");
assert(storyEducationDossier.extracted.education.includes("Google Career Certificate"), "story mode extracts education signal");
assert(storyEducationDossier.intake.education.includes("Google Career Certificate"), "story mode feeds education into intake");
assert(resumeToText(storyEducationDossier.intake, generateResumePackage(storyEducationDossier.intake)).includes("Google Career Certificate"), "story mode education reaches resume export");

const educationPersonaAudits = [
  {
    name: "Bachelor Education",
    education: "Bachelor of Science in Computer Science | State University | 2024",
    expected: /Bachelor Of Science In Computer Science|State University|2024/i
  },
  {
    name: "Associate Education",
    education: "Associate Degree in Information Technology | Community College | 2023",
    expected: /Associate Degree In Information Technology|Community College|2023/i
  },
  {
    name: "Trade Education",
    education: "Union Electrical Apprenticeship | 2022",
    expected: /Union Electrical Apprenticeship|2022/i
  },
  {
    name: "Bootcamp Education",
    education: "Software Engineering Bootcamp | General Assembly | 2024",
    expected: /Software Engineering Bootcamp|General Assembly|2024/i
  },
  {
    name: "Military Training Education",
    education: "Military Training in Logistics Operations | 2021",
    expected: /Military Training In Logistics Operations|2021/i
  },
  {
    name: "Certification Only Education",
    education: "CompTIA A+",
    expected: /CompTIA A\+/i
  },
  {
    name: "Self Taught Founder Education",
    education: "Self-directed learning in AI workflow automation",
    expected: /Self-directed Learning In AI Workflow Automation/i
  }
];

for (const persona of educationPersonaAudits) {
  const data = {
    ...initialIntake,
    fullName: `${persona.name} Candidate`,
    email: "education.audit@example.com",
    targetJobTitle: "Operations Associate",
    roleFamily: "Operations",
    currentTitle: "Operations Assistant",
    currentCompany: "Local Business",
    currentTime: "2024 - Present",
    tools: "Excel, Google Sheets",
    selectedResponsibilities: ["Reporting", "Task coordination", "Documentation"],
    selectedActions: ["prepared reports", "tracked work"],
    reportsCreated: "4 weekly reports",
    selectedOutcomes: ["Accuracy"],
    education: persona.education
  };
  const resume = generateResumePackage(data);
  const exportText = resumeToText(data, resume);
  assert(persona.expected.test(exportText), `${persona.name}: education appears professionally in export`);
  assert(!exportText.includes(educationPlaceholder), `${persona.name}: education placeholder omitted`);
}

const noEducationResume = generateResumePackage({
  ...initialIntake,
  fullName: "No Education Candidate",
  email: "no.education@example.com",
  targetJobTitle: "Customer Success Associate",
  roleFamily: "Customer Success",
  currentTitle: "Customer Service Associate",
  currentCompany: "Local Business",
  currentTime: "2024 - Present",
  tools: "Zendesk, Excel",
  selectedResponsibilities: ["Customer communication", "Support tickets", "Documentation"],
  selectedActions: ["resolved issues", "documented updates"],
  customersServed: "30 weekly customers",
  selectedOutcomes: ["Customer satisfaction"]
});
assert(!resumeToText(initialIntake, noEducationResume).includes(educationPlaceholder), "no education entered omits placeholder from export");
assert(extractEducationEntries("I completed CompTIA Security+ and an HVAC Apprenticeship in 2024.").some((item) => /Security\+|HVAC/i.test(item)), "education parser extracts certification and trade training");
assert(formatEducationEntries(["google it support", "self directed learning in ai workflow automation"]).includes("Google IT Support"), "education formatter normalizes known credentials");

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

const independentWorkPersonas = [
  {
    name: "Uber Driver Independent",
    targetJobTitle: "Operations Associate",
    roleFamily: "Operations",
    currentTitle: "Uber Driver",
    currentCompany: "",
    currentTime: "2023 - Present",
    independentWorkType: "Gig Work",
    selectedIndependentWorkSignals: ["Route planning", "Customer communication", "Time Management", "Order accuracy"],
    selectedResponsibilities: ["Route planning", "Customer communication", "Order accuracy"],
    selectedActions: ["tracked work", "maintained records"],
    customersServed: "40+ weekly riders",
    selectedOutcomes: ["Reliability"]
  },
  {
    name: "Etsy Seller Independent",
    targetJobTitle: "Customer Success Associate",
    roleFamily: "Customer Success",
    currentTitle: "Etsy Seller",
    currentCompany: "",
    currentTime: "2022 - Present",
    independentWorkType: "Side Business",
    selectedIndependentWorkSignals: ["Product listings", "Customer messages", "Order fulfillment", "Shipping"],
    selectedResponsibilities: ["Customer messages", "Order fulfillment", "Product listings"],
    selectedActions: ["followed up with customers", "documented updates"],
    customersServed: "30+ customer messages monthly",
    selectedOutcomes: ["Customer satisfaction"]
  },
  {
    name: "Content Creator Independent",
    targetJobTitle: "Social Media Manager",
    roleFamily: "Project Coordination",
    currentTitle: "Content Creator",
    currentCompany: "",
    currentTime: "2024 - Present",
    independentWorkType: "Creator Work",
    selectedIndependentWorkSignals: ["Content planning", "Audience engagement", "Video editing", "Analytics review"],
    selectedResponsibilities: ["Content planning", "Social media publishing", "Analytics review"],
    selectedActions: ["tracked milestones", "prepared status notes"],
    projectsSupported: "3 weekly posts",
    selectedOutcomes: ["Speed"]
  },
  {
    name: "Personal Trainer Independent",
    targetJobTitle: "Operations Associate",
    roleFamily: "Operations",
    currentTitle: "Personal Trainer",
    currentCompany: "",
    currentTime: "2021 - Present",
    independentWorkType: "Self-Employed",
    selectedIndependentWorkSignals: ["Client scheduling", "Customer consultation", "Service delivery", "Appointment management"],
    selectedResponsibilities: ["Client scheduling", "Service delivery", "Payment processing"],
    selectedActions: ["coordinated schedules", "maintained records"],
    customersServed: "10 weekly clients",
    selectedOutcomes: ["Customer satisfaction"]
  },
  {
    name: "Volunteer Coordinator Independent",
    targetJobTitle: "Project Coordinator",
    roleFamily: "Project Coordination",
    currentTitle: "Volunteer Coordinator",
    currentCompany: "",
    currentTime: "2023 - Present",
    independentWorkType: "Volunteer",
    selectedIndependentWorkSignals: ["Event coordination", "Stakeholder communication", "Scheduling", "Outreach"],
    selectedResponsibilities: ["Event coordination", "Stakeholder communication", "Scheduling"],
    selectedActions: ["tracked milestones", "updated stakeholders"],
    projectsSupported: "4 community events",
    selectedOutcomes: ["Reliability"]
  },
  {
    name: "Tattoo Artist Independent",
    targetJobTitle: "Client Services Coordinator",
    roleFamily: "Customer Success",
    currentTitle: "Tattoo Artist",
    currentCompany: "",
    currentTime: "2020 - Present",
    independentWorkType: "Freelance",
    selectedIndependentWorkSignals: ["Customer consultation", "Appointment management", "Service delivery", "Payment processing"],
    selectedResponsibilities: ["Customer consultation", "Appointment management", "Service delivery"],
    selectedActions: ["followed up with customers", "documented updates"],
    customersServed: "8 weekly clients",
    selectedOutcomes: ["Customer satisfaction"]
  }
];

for (const persona of independentWorkPersonas) {
  const data = { ...initialIntake, fullName: `${persona.name} Candidate`, email: "independent.work@example.com", ...persona };
  const resume = generateResumePackage(data);
  const exportText = resumeToText(data, resume);

  assert(/Independent|Freelance|Self-Employed|Volunteer/.test(exportText), `${persona.name}: independent positioning appears`);
  assert(!/Current Company|Previous Company|Corporate|employees managed|team led|degree/i.test(exportText), `${persona.name}: no fake corporate or degree claims`);
  assert(!/revenue|sales volume|\$/.test(exportText) || persona.revenueInfluenced, `${persona.name}: no fake revenue claims`);
  assert(/Customer Communication|Time Management|Client Relations|Order Fulfillment|Service Delivery|Content Production|Community Engagement|Scheduling|Documentation|Operations/i.test(exportText), `${persona.name}: transferable skills included`);
  assert(exportText.includes("SUMMARY") && exportText.includes("CORE SKILLS") && exportText.includes("EXPERIENCE"), `${persona.name}: ATS-safe output remains clean`);
}

const doorDashStory = parseStoryToDossier("I do DoorDash on the side and handle customer messages, order accuracy, route planning, and around 25 deliveries a week.");
assert(/DoorDash Courier|Independent/.test(doorDashStory.intake.currentTitle), "story mode recognizes DoorDash independent work");
assert(doorDashStory.intake.selectedIndependentWorkSignals.length > 0, "story mode seeds independent transferable signals");

const completeStory = parseStoryToDossier("I worked at DraftKings as a sportsbook writer from 2023 to now. I handled customers, wagers, cash, and escalations.");
assert(completeStory.extracted.company === "DraftKings", "story mode parses company");
assert(/Sportsbook/.test(completeStory.extracted.role), "story mode parses role");
assert(/2023/i.test(completeStory.extracted.dates), "story mode parses dates");
assert(!/company|recent role|date/i.test([completeStory.nextMissingField, completeStory.focusedFollowUp].join(" ")), "story mode does not ask for role/company/dates again");

const aiToolStory = parseStoryToDossier("I worked at Local Studio as a developer from 2024 to now and used ChatGPT, Cursor, and GitHub.");
assert(getNextUsefulPrompt(aiToolStory.intake).key === "aiWorkflow", "AI tools trigger AI workflow follow-up");
const noAiToolStory = parseStoryToDossier("I worked at Local Studio as a developer from 2024 to now and used GitHub and VS Code for documentation.");
assert(getNextUsefulPrompt(noAiToolStory.intake).key !== "aiWorkflow", "no AI tools skips AI workflow follow-up");

const unknownRoleStory = parseStoryToDossier("I worked at River North Brewing as a brewery cellar operator from 2021 to 2024.");
assert(getMissingSignals(unknownRoleStory.intake).some((signal) => signal.key === "unknownRoleContext"), "unknown role triggers fallback context");
assert(findJobArsenal("Sportsbook Ticket Writer"), "known role uses arsenal when available");

const enoughSignalData = {
  ...initialIntake,
  fullName: "Ready Candidate",
  email: "ready@example.com",
  targetJobTitle: "Customer Success Associate",
  roleFamily: "Customer Success",
  currentTitle: "Sportsbook Ticket Writer",
  currentCompany: "DraftKings",
  currentTime: "2023 - Present",
  tools: "Zendesk",
  selectedResponsibilities: ["Client communication", "Escalation handling", "Customer communication"],
  customersServed: "50 weekly customers",
  selectedOutcomes: ["Customer satisfaction"]
};
assert(hasEnoughResumeSignal(enoughSignalData), "enough signal allows Generate now");
assert(getNextUsefulPrompt(enoughSignalData).key === "ready", "enough signal stops required prompting");

const reactiveTargetData = mergeReactiveSignals(initialIntake, "I want customer success because I handled escalations at DraftKings.");
assert(reactiveTargetData.targetJobTitle === "Customer Success Associate", "guided free text infers target role");
assert(reactiveTargetData.currentCompany === "DraftKings", "guided free text captures company");
assert(reactiveTargetData.selectedResponsibilities.some((item) => /escalation/i.test(item)), "guided free text captures responsibility signal");

const dualModePersonaAudits = [
  {
    name: "Sportsbook Ticket Writer Dual",
    guided: {
      targetJobTitle: "Customer Success Associate",
      roleFamily: "Customer Success",
      currentTitle: "Sportsbook Ticket Writer",
      currentCompany: "DraftKings",
      currentTime: "2023 - Present",
      tools: "Zendesk, Excel, Slack",
      selectedResponsibilities: ["Customer communication", "Payment processing", "Escalation handling", "Wagering transactions"],
      selectedActions: ["resolved issues", "documented updates", "followed up with customers"],
      customersServed: "50+ weekly customers",
      selectedOutcomes: ["Customer satisfaction", "Accuracy"],
      education: "Google Career Certificate | Coursera | 2024"
    },
    story:
      "My name is Casey Morgan and my email is casey@example.com. I worked at DraftKings as a sportsbook writer from 2023 to now and I am targeting Customer Success Associate. I handled customer communication, payment processing, wagering transactions, and escalations using Zendesk, Excel, and Slack. I supported 50+ weekly customers and improved customer satisfaction and accuracy. I completed a Google Career Certificate through Coursera in 2024.",
    expected: ["DraftKings", "Sportsbook Ticket Writer", "Zendesk", "50+ weekly customers", "Google Career Certificate"]
  },
  {
    name: "Security Officer Dual",
    guided: {
      targetJobTitle: "Operations Associate",
      roleFamily: "Operations",
      currentTitle: "Security Officer",
      currentCompany: "Allied Universal",
      currentTime: "2021 - 2024",
      tools: "Microsoft Teams, Excel",
      selectedResponsibilities: ["Access control", "Incident reporting", "Visitor management", "Task coordination"],
      selectedActions: ["maintained records", "tracked work", "prepared reports"],
      reportsCreated: "6 weekly incident reports",
      selectedOutcomes: ["Compliance", "Reliability"]
    },
    story:
      "My name is Riley Brooks and my email is riley@example.com. I was a security officer at Allied Universal from 2021 to 2024 and I am targeting Operations Associate. I handled access control, incident reporting, visitor management, and task coordination using Microsoft Teams and Excel. I prepared 6 weekly incident reports and improved compliance and reliability.",
    expected: ["Allied Universal", "Security Officer", "Incident Reporting", "Microsoft Teams", "6 weekly incident reports"]
  },
  {
    name: "Retail Admin Dual",
    guided: {
      targetJobTitle: "Administrative Assistant",
      roleFamily: "Admin",
      currentTitle: "Retail Associate",
      currentCompany: "Target",
      currentTime: "2022 - Present",
      tools: "Google Workspace, Excel, POS Systems",
      selectedResponsibilities: ["Scheduling", "Records management", "Data entry", "Customer communication"],
      selectedActions: ["coordinated schedules", "maintained records", "entered data accurately"],
      callsHandled: "25+ weekly calls",
      selectedOutcomes: ["Accuracy"]
    },
    story:
      "My name is Taylor Green and my email is taylor@example.com. I worked at Target as a retail associate from 2022 to present and I am targeting Administrative Assistant. I handled scheduling questions, records management, data entry, customer communication, and POS systems using Google Workspace and Excel. I handled 25+ weekly calls and improved accuracy.",
    expected: ["Target", "Retail Associate", "Google Workspace", "25+ weekly calls"]
  },
  {
    name: "IT Support Dual",
    guided: {
      targetJobTitle: "Help Desk Technician",
      roleFamily: "IT Support",
      currentTitle: "Entry-Level IT Support Technician",
      currentCompany: "Local School District",
      currentTime: "2024 - Present",
      tools: "ServiceNow, Active Directory, Windows, Office 365",
      selectedResponsibilities: ["Troubleshooting", "Ticket management", "User support", "Documentation"],
      selectedActions: ["troubleshot issues", "resolved tickets", "documented fixes"],
      ticketsHandled: "30 weekly tickets",
      selectedOutcomes: ["Reliability"]
    },
    story:
      "My name is Morgan Lee and my email is morgan@example.com. I worked at Local School District as an entry-level IT support technician from 2024 to present and I am targeting Help Desk Technician. I handled troubleshooting, ticket management, user support, and documentation using ServiceNow, Active Directory, Windows, and Office 365. I resolved 30 weekly tickets and improved reliability.",
    expected: ["Local School District", "Help Desk Technician", "ServiceNow", "30 weekly tickets"]
  },
  {
    name: "Project Coordinator Dual",
    guided: {
      targetJobTitle: "Project Coordinator",
      roleFamily: "Project Coordination",
      currentTitle: "Project Coordinator",
      currentCompany: "Northstar Services",
      currentTime: "2023 - Present",
      tools: "Asana, Google Sheets, Slack",
      selectedResponsibilities: ["Timeline tracking", "Status reporting", "Meeting coordination", "Documentation"],
      selectedActions: ["tracked milestones", "updated stakeholders", "coordinated meetings"],
      projectsSupported: "4 active projects",
      selectedOutcomes: ["Efficiency"]
    },
    story:
      "My name is Avery Chen and my email is avery@example.com. I worked at Northstar Services as a project coordinator from 2023 to present targeting Project Coordinator. I handled timeline tracking, status reporting, meeting coordination, and documentation using Asana, Google Sheets, and Slack. I supported 4 active projects and improved efficiency.",
    expected: ["Northstar Services", "Project Coordinator", "Asana", "4 active projects"]
  },
  {
    name: "Creator Dual",
    guided: {
      targetJobTitle: "Social Media Manager",
      roleFamily: "Project Coordination",
      currentTitle: "Content Creator",
      currentCompany: "",
      currentTime: "2024 - Present",
      independentWorkType: "Creator Work",
      selectedIndependentWorkSignals: ["Content planning", "Audience engagement", "Video editing", "Analytics review"],
      tools: "Canva, TikTok, Instagram, CapCut",
      selectedResponsibilities: ["Content planning", "Social media publishing", "Analytics review"],
      selectedActions: ["tracked milestones", "prepared status notes"],
      projectsSupported: "3 weekly posts",
      selectedOutcomes: ["Speed"]
    },
    story:
      "My name is Jamie Rivera and my email is jamie@example.com. I worked as a content creator from 2024 to present and I am targeting Social Media Manager. This was creator work. I handled content planning, audience engagement, video editing, social media publishing, and analytics review using Canva, TikTok, Instagram, and CapCut. I published 3 weekly posts and improved speed.",
    expected: ["Content Creator", "Canva", "3 weekly posts", "Social Media Manager"]
  },
  {
    name: "Uber Driver Dual",
    guided: {
      targetJobTitle: "Operations Associate",
      roleFamily: "Operations",
      currentTitle: "Uber Driver",
      currentCompany: "",
      currentTime: "2022 - Present",
      independentWorkType: "Gig Work",
      selectedIndependentWorkSignals: ["Route planning", "Customer communication", "Time Management", "App-based workflow"],
      selectedResponsibilities: ["Route planning", "Customer communication", "Time management"],
      selectedActions: ["tracked work", "maintained records"],
      customersServed: "40+ weekly riders",
      selectedOutcomes: ["Reliability"]
    },
    story:
      "My name is Jordan Miles and my email is jordan.miles@example.com. I worked as an Uber driver from 2022 to present and I am targeting Operations Associate. This was gig work. I handled route planning, customer communication, time management, app-based workflows, and issue resolution. I supported 40+ weekly riders and improved reliability.",
    expected: ["Uber Driver", "40+ weekly riders", "Operations Associate"]
  },
  {
    name: "Etsy Seller Dual",
    guided: {
      targetJobTitle: "Customer Success Associate",
      roleFamily: "Customer Success",
      currentTitle: "Etsy Seller",
      currentCompany: "",
      currentTime: "2021 - Present",
      independentWorkType: "Side Business",
      selectedIndependentWorkSignals: ["Product listings", "Customer messages", "Order fulfillment", "Shipping"],
      selectedResponsibilities: ["Customer messages", "Order fulfillment", "Product listings"],
      selectedActions: ["followed up with customers", "documented updates"],
      customersServed: "30+ customer messages monthly",
      selectedOutcomes: ["Customer satisfaction"]
    },
    story:
      "My name is Sam Patel and my email is sam@example.com. I worked as an Etsy seller from 2021 to present and I am targeting Customer Success Associate. This was a side business. I handled product listings, customer messages, order fulfillment, shipping, and follow-up communication. I managed 30+ customer messages monthly and improved customer satisfaction.",
    expected: ["Etsy Seller", "30+ customer messages monthly", "Customer Success Associate"]
  },
  {
    name: "Founder AI Dual",
    guided: {
      targetJobTitle: "Product Operations Associate",
      roleFamily: "Tech",
      currentTitle: "Founder",
      currentCompany: "Koinophobia Labs",
      currentTime: "2025 - Present",
      tools: "ChatGPT, Claude, Cursor, GitHub, Vercel",
      selectedAiWorkflows: ["Market research", "PRD writing", "Workflow automation", "Rapid prototyping"],
      selectedResponsibilities: ["Documentation", "Testing", "Implementation support"],
      selectedActions: ["documented issues", "tested workflows"],
      projectsSupported: "4 shipped product modules",
      reportsCreated: "12 QA reports",
      selectedOutcomes: ["Efficiency", "Reliability"],
      education: "Product Lab Projects | Koinophobia Labs | 2025"
    },
    story:
      "My name is Blake Taylor and my email is blake@example.com. I founded Koinophobia Labs in 2025 and I am targeting Product Operations Associate. I built product modules and handled documentation, testing, implementation support, market research, PRD writing, workflow automation, and rapid prototyping using ChatGPT, Claude, Cursor, GitHub, and Vercel. I shipped 4 product modules, created 12 QA reports, and improved efficiency and reliability. Education is Product Lab Projects at Koinophobia Labs in 2025.",
    expected: ["Koinophobia Labs", "Founder", "ChatGPT", "Workflow Automation", "4 product modules"]
  }
];

for (const persona of dualModePersonaAudits) {
  const guidedData = {
    ...initialIntake,
    fullName: `${persona.name} Guided Candidate`,
    email: "guided.parity@example.com",
    ...persona.guided
  };
  const storyDossierForPersona = parseStoryToDossier(persona.story);
  const storyData = storyDossierForPersona.intake;
  const guidedResume = generateResumePackage(guidedData);
  const storyResume = generateResumePackage(storyData);
  const guidedText = resumeToText(guidedData, guidedResume);
  const storyText = resumeToText(storyData, storyResume);
  const guidedScore = getResumeSignalScore(guidedData);
  const storyScore = getResumeSignalScore(storyData);
  const scoreGap = guidedScore.score - storyScore.score;

  assertProfessionalResume(guidedData, guidedResume, `${persona.name}: guided`);
  assertProfessionalResume(storyData, storyResume, `${persona.name}: story`);
  assert(scoreGap <= 20, `${persona.name}: story signal score is close to guided (${storyScore.score} vs ${guidedScore.score})`);
  assert(hasEnoughResumeSignal(guidedData), `${persona.name}: guided has enough signal`);
  assert(hasEnoughResumeSignal(storyData), `${persona.name}: story has enough signal`);
  assert(storyDossierForPersona.focusedFollowUp !== "What was your title, company, and approximate date range?", `${persona.name}: story does not re-ask captured role identity`);
  assert(storyDossierForPersona.missingCriticalDetails.length <= 1, `${persona.name}: story missing-info logic converges`);
  assert(textHasAny(guidedText, persona.expected) && textHasAny(storyText, persona.expected), `${persona.name}: expected facts reach both outputs`);
  assert(guidedResume.linkedinHeadline.includes(guidedData.targetJobTitle), `${persona.name}: guided LinkedIn target preserved`);
  assert(storyResume.linkedinHeadline.includes(storyData.targetJobTitle), `${persona.name}: story LinkedIn target preserved`);
  assert(!/placeholder|fake metric|invented|candidate targeting/i.test(`${guidedText}\n${storyText}`), `${persona.name}: no weak placeholder or fake-output language`);
}

const aiWorkflowPersonas = [
  {
    name: "Founder AI Workflow",
    targetJobTitle: "Business Operations Associate",
    roleFamily: "Business",
    currentTitle: "Founder",
    currentCompany: "Koinophobia Labs",
    currentTime: "2025 - Present",
    tools: "ChatGPT, Claude, Perplexity, Notion",
    selectedAiWorkflows: ["Market research", "Documentation", "Workflow automation"],
    selectedResponsibilities: ["Research", "Documentation", "Process improvement"],
    selectedActions: ["prepared reports", "documented processes"],
    projectsSupported: "3 product concepts",
    selectedOutcomes: ["Efficiency"]
  },
  {
    name: "Developer AI Workflow",
    targetJobTitle: "Technical Operations Associate",
    roleFamily: "Tech",
    currentTitle: "Junior Developer",
    currentCompany: "Local Studio",
    currentTime: "2024 - Present",
    tools: "GitHub Copilot, Cursor, VS Code, GitHub",
    selectedAiWorkflows: ["Coding assistance", "Debugging", "Rapid prototyping", "Documentation"],
    selectedResponsibilities: ["Testing", "Documentation", "Implementation support"],
    selectedActions: ["tested workflows", "documented issues"],
    projectsSupported: "2 shipped app features",
    selectedOutcomes: ["Speed", "Reliability"]
  },
  {
    name: "Customer Success AI Workflow",
    targetJobTitle: "Customer Success Associate",
    roleFamily: "Customer Success",
    currentTitle: "Customer Support Specialist",
    currentCompany: "Helpdesk Co",
    currentTime: "2023 - Present",
    tools: "Zendesk, ChatGPT, Grammarly AI",
    selectedAiWorkflows: ["Customer communication", "Knowledge management", "Documentation"],
    selectedResponsibilities: ["Support tickets", "Client communication", "CRM updates"],
    selectedActions: ["resolved issues", "documented updates"],
    ticketsHandled: "40 weekly tickets",
    selectedOutcomes: ["Customer satisfaction"]
  },
  {
    name: "Operations AI Workflow",
    targetJobTitle: "Operations Associate",
    roleFamily: "Operations",
    currentTitle: "Operations Coordinator",
    currentCompany: "Fulfillment Co",
    currentTime: "2022 - Present",
    tools: "Excel, Make, Zapier AI, Notion AI",
    selectedAiWorkflows: ["Workflow automation", "Documentation", "Reporting"],
    selectedResponsibilities: ["Reporting", "Task coordination", "Process improvement"],
    selectedActions: ["tracked work", "prepared reports"],
    reportsCreated: "5 weekly reports",
    selectedOutcomes: ["Efficiency"]
  },
  {
    name: "Creator AI Workflow",
    targetJobTitle: "Content Coordinator",
    roleFamily: "Project Coordination",
    currentTitle: "Creator Assistant",
    currentCompany: "Independent Creator",
    currentTime: "2024 - Present",
    tools: "Midjourney, Runway, Notion AI, Google Workspace",
    selectedAiWorkflows: ["Content creation", "Research", "Project planning"],
    selectedResponsibilities: ["Documentation", "Timeline tracking", "Stakeholder communication"],
    selectedActions: ["tracked milestones", "prepared status notes"],
    projectsSupported: "4 active content projects",
    selectedOutcomes: ["Speed"]
  }
];

for (const persona of aiWorkflowPersonas) {
  const data = { ...initialIntake, fullName: `${persona.name} Candidate`, email: "ai.workflow@example.com", ...persona };
  const resume = generateResumePackage(data);
  const exportText = resumeToText(data, resume);
  const aiTools = selectedAiTools(data.tools);
  const firstSkillBlock = resume.coreSkills.slice(0, 8).join(" ");

  assert(aiTools.length > 0, `${persona.name}: AI tools detected`);
  assert(/AI-Assisted|Workflow Automation|Rapid Prototyping|Knowledge Management|AI Productivity|Research Synthesis|Documentation/i.test(exportText), `${persona.name}: AI workflow appears naturally`);
  assert(!/Expert in ChatGPT|AI Engineer|Machine Learning Engineer|Prompt Engineer/i.test(exportText), `${persona.name}: no hallucinated AI expertise`);
  assert(!aiTools.every((tool) => firstSkillBlock.includes(tool)), `${persona.name}: no AI tool stuffing in core skills`);
  assert(exportText.includes("SUMMARY") && exportText.includes("CORE SKILLS") && exportText.includes("EXPERIENCE"), `${persona.name}: ATS-safe sections remain`);
}

const founderAiParityPersona = {
  name: "Founder AI Workflow Parity",
  targetJobTitle: "Product Operations Associate",
  roleFamily: "Tech",
  currentTitle: "Founder",
  currentCompany: "Koinophobia Labs",
  currentTime: "2025 - Present",
  tools: "ChatGPT, Claude, Cursor, GitHub, Vercel",
  selectedAiWorkflows: ["Market research", "PRD writing", "Workflow automation", "Rapid prototyping"],
  selectedResponsibilities: ["Documentation", "Implementation support", "Testing"],
  selectedActions: ["documented issues", "tested workflows"],
  projectsSupported: "4 shipped product modules",
  reportsCreated: "12 QA reports",
  selectedOutcomes: ["Efficiency", "Reliability"],
  website: "https://koinophobia-labs.vercel.app",
  education: "Product Lab Projects | Koinophobia Labs | 2025"
};

const parityPersonas = [
  ...personas,
  independentWorkPersonas.find((persona) => persona.name === "Content Creator Independent"),
  independentWorkPersonas.find((persona) => persona.name === "Uber Driver Independent"),
  independentWorkPersonas.find((persona) => persona.name === "Etsy Seller Independent"),
  founderAiParityPersona
].filter(Boolean);

for (const persona of parityPersonas) {
  const data = {
    ...initialIntake,
    fullName: `${persona.name} Candidate`,
    email: `${persona.name.toLowerCase().replaceAll(" ", ".")}@example.com`,
    ...persona
  };
  const resume = generateResumePackage(data);
  if (persona.education) resume.education = persona.education;
  const atsText = resumeToText(data, resume);
  const visualText = visualCoreText(data, resume);
  const allBullets = resume.experience.flatMap((role) => role.bullets.filter(Boolean));

  assert(atsText.includes(data.email) && visualText.includes(data.email), `${persona.name}: contact preserved in both modes`);
  assert(atsText.includes(resume.summary) && visualText.includes(resume.summary), `${persona.name}: summary preserved in both modes`);
  assert(resume.coreSkills.slice(0, 8).every((skill) => atsText.includes(skill) && visualText.includes(skill)), `${persona.name}: skills/tools preserved in both modes`);
  assert(allBullets.every((bullet) => atsText.includes(bullet) && visualText.includes(bullet)), `${persona.name}: all experience bullets preserved in both modes`);
  assert(visualText.includes(resume.linkedinHeadline), `${persona.name}: visual positioning headline preserved`);
  assert(!atsText.includes(educationPlaceholder) && !visualText.includes(educationPlaceholder), `${persona.name}: education placeholder omitted in both modes`);
  if (persona.education) {
    assert(atsText.includes(persona.education) && visualText.includes(persona.education), `${persona.name}: provided education preserved in both modes`);
  }
  assert(!/Copy Summary|Copy Skills|Copy Experience|Visual Portfolio Resume|Use ATS Resume/i.test(atsText), `${persona.name}: ATS text has no UI labels or visual chrome`);
  assert(!/email \| phone \| portfolio|Copy Summary|Copy Skills|Copy Experience/i.test(visualText), `${persona.name}: visual content has no placeholders or copy labels`);
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
