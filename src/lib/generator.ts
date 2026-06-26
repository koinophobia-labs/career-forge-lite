import { roleIntelligence } from "@/lib/career-data";
import { aiToolOptions, buildAiAtsKeywords, normalizeAiWorkflow, selectedAiTools } from "@/lib/modern-work-intelligence";
import { educationPlaceholder } from "@/lib/resume-export";
import { polishResumePackage } from "@/lib/resume-intelligence";
import type { ExperienceRole, IntakeData, ResumePackage, RoleFamily } from "@/types/career";

const defaultTargetByFamily: Record<RoleFamily, string> = {
  Tech: "Technical Support Associate",
  Business: "Business Operations Associate",
  Operations: "Operations Associate",
  "Customer Success": "Customer Success Associate",
  Admin: "Administrative Assistant",
  Sales: "Sales Development Representative",
  Security: "Security Officer",
  "Project Coordination": "Project Coordinator",
  "IT Support": "IT Support Specialist"
};

const workflowSkillsByFamily: Record<RoleFamily, string[]> = {
  Tech: ["Testing Support", "Technical Documentation", "Support Workflows", "Problem Solving"],
  Business: ["Business Reporting", "Stakeholder Support", "Process Documentation", "Analytical Support"],
  Operations: ["Task Coordination", "Process Improvement", "Operational Reporting", "Reliable Follow-Through"],
  "Customer Success": ["Client Communication", "Issue Escalation", "Service Follow-Through", "Account Support"],
  Admin: ["Office Support", "Records Accuracy", "Calendar Support", "Professional Communication"],
  Sales: ["Pipeline Support", "Follow-Up Communication", "Lead Research", "Prospect Coordination"],
  Security: ["Safety Awareness", "Incident Documentation", "Visitor Support", "Policy Compliance"],
  "Project Coordination": ["Cross-Functional Communication", "Meeting Coordination", "Project Documentation", "Status Tracking"],
  "IT Support": ["Ticket Triage", "User Support", "Troubleshooting", "Technical Documentation"]
};

type DomainProfile = {
  name: string;
  keywords: string[];
  environment: string;
  strengths: string[];
  processLanguage: string;
};

const domainProfiles: DomainProfile[] = [
  {
    name: "sportsbook",
    keywords: ["sportsbook", "gaming", "casino", "wager", "ticket writer", "draftkings", "fanduel"],
    environment: "high-volume gaming and customer transaction environment",
    strengths: ["customer transactions", "compliance-aware service", "operational accuracy", "issue escalation"],
    processLanguage: "transaction records, customer requests, and compliance-aware service steps"
  },
  {
    name: "security",
    keywords: ["security", "guard", "access control", "surveillance", "site officer"],
    environment: "safety-focused, public-facing environment",
    strengths: ["access control", "incident reporting", "visitor management", "safety procedures"],
    processLanguage: "access control procedures, incident notes, and visitor support workflows"
  },
  {
    name: "retail",
    keywords: ["retail", "cashier", "sales associate", "store", "target", "best buy", "walgreens", "cvs", "walmart", "costco"],
    environment: "fast-paced retail service environment",
    strengths: ["POS systems", "customer service", "inventory support", "transaction accuracy"],
    processLanguage: "POS transactions, customer requests, inventory tasks, and store records"
  },
  {
    name: "food service",
    keywords: ["server", "barista", "restaurant", "food", "cafe", "starbucks", "shift"],
    environment: "fast-paced food service environment",
    strengths: ["order accuracy", "customer experience", "shift operations", "service speed"],
    processLanguage: "order flow, customer service steps, sanitation standards, and shift tasks"
  },
  {
    name: "admin",
    keywords: ["admin", "administrative", "office", "front desk", "reception", "records"],
    environment: "office and administrative support environment",
    strengths: ["scheduling", "records management", "correspondence", "office workflows"],
    processLanguage: "calendar coordination, records, correspondence, and office workflows"
  },
  {
    name: "it",
    keywords: ["it", "help desk", "desktop support", "service desk", "technical support", "technician"],
    environment: "technical support and user service environment",
    strengths: ["troubleshooting", "ticketing", "user support", "documentation"],
    processLanguage: "support tickets, troubleshooting notes, user requests, and escalation workflows"
  }
];

type RoleStrategy = {
  focus: string[];
  safeDefaults: string[];
  verbs: string[];
  environment: string;
  supportContext: string;
  seniorContext: string;
  valueArea: string;
};

const roleStrategies: Record<RoleFamily, RoleStrategy> = {
  "Customer Success": {
    focus: ["customer communication", "account support", "issue resolution", "CRM documentation", "onboarding support"],
    safeDefaults: ["Customer Communication", "Issue Resolution", "Service Follow-Through", "Documentation"],
    verbs: ["Supported", "Documented", "Resolved", "Communicated", "Maintained"],
    environment: "customer-facing service environment",
    supportContext: "service requests and client follow-through",
    seniorContext: "customer success workflows and team communication",
    valueArea: "Client Experience"
  },
  Operations: {
    focus: ["workflow coordination", "reporting", "scheduling", "process improvement", "operational accuracy"],
    safeDefaults: ["Workflow Coordination", "Operational Reporting", "Task Tracking", "Process Support"],
    verbs: ["Coordinated", "Tracked", "Maintained", "Improved", "Documented"],
    environment: "operations and service workflow environment",
    supportContext: "daily operations and task flow",
    seniorContext: "operational workflows and service standards",
    valueArea: "Operational Efficiency"
  },
  Admin: {
    focus: ["scheduling", "records", "correspondence", "office support", "documentation"],
    safeDefaults: ["Scheduling", "Records Management", "Office Support", "Professional Communication"],
    verbs: ["Coordinated", "Maintained", "Organized", "Documented", "Communicated"],
    environment: "office and administrative support environment",
    supportContext: "administrative requests and office workflows",
    seniorContext: "administrative workflows and cross-team support",
    valueArea: "Administrative Reliability"
  },
  Sales: {
    focus: ["outreach", "lead generation", "CRM updates", "pipeline support", "follow-up communication"],
    safeDefaults: ["Follow-Up Communication", "Lead Support", "CRM Updates", "Pipeline Coordination"],
    verbs: ["Supported", "Tracked", "Maintained", "Communicated", "Researched"],
    environment: "sales support and customer outreach environment",
    supportContext: "sales outreach and account follow-up",
    seniorContext: "pipeline support and customer handoff workflows",
    valueArea: "Revenue Support"
  },
  "IT Support": {
    focus: ["troubleshooting", "ticket resolution", "documentation", "escalation", "user support"],
    safeDefaults: ["Troubleshooting", "Ticket Management", "User Support", "Technical Documentation"],
    verbs: ["Troubleshot", "Resolved", "Documented", "Escalated", "Supported"],
    environment: "technical support and user service environment",
    supportContext: "user requests and support tickets",
    seniorContext: "help desk workflows and technical escalation paths",
    valueArea: "Technical Support"
  },
  "Project Coordination": {
    focus: ["timelines", "milestones", "stakeholder updates", "meeting support", "documentation"],
    safeDefaults: ["Timeline Tracking", "Status Reporting", "Meeting Coordination", "Project Documentation"],
    verbs: ["Coordinated", "Tracked", "Documented", "Communicated", "Maintained"],
    environment: "project coordination and cross-functional support environment",
    supportContext: "project updates and delivery tasks",
    seniorContext: "project timelines, milestones, and stakeholder communication",
    valueArea: "Cross-Functional Support"
  },
  Business: {
    focus: ["reporting", "analysis", "process documentation", "stakeholder communication", "operational insight"],
    safeDefaults: ["Reporting", "Analysis", "Process Documentation", "Stakeholder Support"],
    verbs: ["Analyzed", "Documented", "Reported", "Communicated", "Tracked"],
    environment: "business operations and stakeholder support environment",
    supportContext: "business reporting and stakeholder requests",
    seniorContext: "business workflows and operational insights",
    valueArea: "Business Support"
  },
  Tech: {
    focus: ["testing", "documentation", "tooling", "implementation support", "technical workflows"],
    safeDefaults: ["Testing Support", "Technical Documentation", "Implementation Support", "Support Workflows"],
    verbs: ["Tested", "Documented", "Supported", "Tracked", "Troubleshot"],
    environment: "technical workflow and implementation support environment",
    supportContext: "technical tasks and support workflows",
    seniorContext: "technical workflows and implementation support",
    valueArea: "Technical Operations"
  },
  Security: {
    focus: ["access control", "incident reporting", "visitor management", "safety procedures", "emergency response"],
    safeDefaults: ["Access Control", "Incident Reporting", "Visitor Management", "Safety Procedures"],
    verbs: ["Monitored", "Documented", "Supported", "Escalated", "Maintained"],
    environment: "safety-focused, public-facing environment",
    supportContext: "site safety and visitor support",
    seniorContext: "security workflows and safety procedures",
    valueArea: "Safety & Compliance"
  }
};

const weakTargetValues = new Set(["ee", "test", "testing", "asdf", "qwerty", "none", "na", "n/a", "unknown"]);
const weakFreeTextValues = new Set(["ee", "test", "testing", "asdf", "qwerty", "none", "na", "n/a", "unknown", "null"]);
const awkwardPhrases = [/customers customers/gi, /tickets tickets/gi, /managed onboarding using python/gi, /candidate targeting/gi];
const leadershipTerms = /\b(supervisor|lead|manager|senior|coordinator|specialist)\b/i;
const supportTerms = /\b(associate|assistant|representative|clerk|cashier|writer|technician|intern)\b/i;

const acronyms = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["crm", "CRM"],
  ["css", "CSS"],
  ["html", "HTML"],
  ["hubspot", "HubSpot"],
  ["it", "IT"],
  ["kpi", "KPI"],
  ["macos", "macOS"],
  ["pos", "POS"],
  ["qa", "QA"],
  ["servicenow", "ServiceNow"],
  ["sop", "SOP"],
  ["sql", "SQL"],
  ["ui", "UI"],
  ["ux", "UX"]
]);

const aiWorkflowSkillLabels = new Map([
  ["Research", "AI-Assisted Research"],
  ["Documentation", "AI-Assisted Documentation"],
  ["Brainstorming", "AI-Assisted Ideation"],
  ["Customer communication", "AI-Supported Customer Communication"],
  ["Coding assistance", "AI-Assisted Development"],
  ["Debugging", "AI-Assisted Debugging"],
  ["Resume writing", "AI-Assisted Writing"],
  ["Meeting summaries", "AI Meeting Summaries"],
  ["Knowledge management", "AI-Supported Knowledge Management"],
  ["Workflow automation", "Workflow Automation"],
  ["Prompt engineering", "Prompt Engineering"],
  ["Technical writing", "AI-Assisted Technical Writing"],
  ["Data analysis", "AI-Assisted Data Analysis"],
  ["Content creation", "AI-Assisted Content Creation"],
  ["Project planning", "AI-Assisted Project Planning"],
  ["Rapid prototyping", "Rapid Prototyping"],
  ["App development", "AI-Assisted App Development"],
  ["Quality assurance", "AI-Assisted Quality Assurance"],
  ["Translation", "AI-Assisted Translation"]
]);

const responsibilityAliases = new Map([
  ["helped customers", "Customer Requests"],
  ["help customers", "Customer Requests"],
  ["customer help", "Customer Requests"],
  ["answered calls", "Call Handling"],
  ["took calls", "Call Handling"],
  ["made reports", "Reporting"],
  ["did reports", "Reporting"]
]);

type BulletContext = {
  action: string;
  bridgeAction: string;
  company: string;
  context: string;
  domainAction: string;
  environment: string;
  outcomeClause: string;
  processLanguage: string;
  responsibility: string;
  scope: string;
  scopeTwo: string;
  toolPhrase: string;
  targetFocus: string;
};

const bulletPatternLibrary: Record<RoleFamily, string[]> = {
  "Customer Success": [
    "{action} {scope}customer requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping client records and next steps clear.",
    "{bridgeAction} account support by following up with customers, documenting updates, and escalating complex needs.",
    "{action} onboarding and service follow-through with clear communication across customer touchpoints.",
    "{action} customer issues with organized notes, timely handoffs, and reliable follow-through.",
    "{bridgeAction} client communication by translating routine requests into documented next steps.",
    "{action} CRM and support records to keep customer history accurate and searchable.",
    "{bridgeAction} retention-focused service by maintaining consistent updates and positive customer experiences."
  ],
  Operations: [
    "{action} {scope}daily workflows in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping records, handoffs, and next steps clear.",
    "{bridgeAction} operational consistency by tracking work, documenting updates, and supporting issue resolution.",
    "{action} schedules, reports, and task flow to keep work moving across teams.",
    "{action} process details and routine updates to support accuracy and reliability.",
    "{bridgeAction} team communication by clarifying priorities, deadlines, and follow-up needs.",
    "{action} records and workflow notes to make recurring work easier to review.",
    "{bridgeAction} service standards by supporting process flow, compliance awareness, and consistent execution."
  ],
  Admin: [
    "{action} {scope}administrative requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping records and correspondence organized.",
    "{bridgeAction} office workflows by coordinating schedules, maintaining records, and communicating next steps.",
    "{action} calendars, documents, and routine requests with accuracy and professional follow-through.",
    "{action} records and data updates to keep information complete, current, and easy to find.",
    "{bridgeAction} team support by handling correspondence, tracking details, and organizing office needs.",
    "{action} recurring administrative tasks while protecting accuracy and response consistency.",
    "{bridgeAction} reliable office operations through documentation, scheduling support, and organized handoffs."
  ],
  Sales: [
    "{action} {scope}prospect or customer follow-ups in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping account notes and handoffs current.",
    "{bridgeAction} pipeline support by tracking outreach, documenting updates, and following up on next steps.",
    "{action} lead research and outreach tasks with consistent communication and recordkeeping.",
    "{action} customer conversations and CRM notes to support cleaner sales follow-through.",
    "{bridgeAction} revenue support by maintaining accurate pipeline activity and account context.",
    "{action} follow-up communication to help prospects and customers receive timely next steps.",
    "{bridgeAction} account coordination through organized notes, outreach support, and clear handoffs."
  ],
  Business: [
    "{action} {scope}business requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping reporting context and updates clear.",
    "{bridgeAction} operational insight by organizing information, documenting processes, and communicating findings.",
    "{action} reports and process notes to support better stakeholder visibility.",
    "{action} data and workflow details to help teams understand status, gaps, and next steps.",
    "{bridgeAction} stakeholder support through clear documentation, reporting, and follow-up.",
    "{action} recurring business updates with attention to accuracy and usable context.",
    "{bridgeAction} decision support by preparing organized notes, reports, and process documentation."
  ],
  "Project Coordination": [
    "{action} {scope}project activity in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping milestones and handoffs visible.",
    "{bridgeAction} project delivery by tracking timelines, preparing updates, and coordinating follow-up.",
    "{action} meeting notes, status updates, and documentation to keep stakeholders aligned.",
    "{action} timelines and task owners so project details stayed organized and actionable.",
    "{bridgeAction} cross-functional communication by clarifying next steps, risks, and status changes.",
    "{action} project records and recurring updates to support reliable execution.",
    "{bridgeAction} milestone tracking through organized documentation, follow-up, and schedule awareness."
  ],
  "IT Support": [
    "{action} {scope}user support requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping tickets and troubleshooting notes clear.",
    "{bridgeAction} technical support by documenting fixes, escalating complex cases, and communicating next steps.",
    "{action} user issues with structured troubleshooting and clear service communication.",
    "{action} support tickets and knowledge notes to improve repeatable resolution steps.",
    "{bridgeAction} help desk reliability through accurate documentation, triage, and escalation awareness.",
    "{action} routine technical requests while protecting service quality and response consistency.",
    "{bridgeAction} user support workflows by tracking issues, updating records, and following through on fixes."
  ],
  Tech: [
    "{action} {scope}technical tasks in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping technical notes and handoffs clear.",
    "{bridgeAction} implementation support by documenting issues, testing workflows, and tracking follow-up.",
    "{action} testing and documentation tasks to make technical work easier to review.",
    "{action} tool and workflow updates with attention to accuracy and repeatable steps.",
    "{bridgeAction} technical operations by organizing notes, validating details, and communicating status.",
    "{action} data or product operations tasks while maintaining clear documentation.",
    "{bridgeAction} technical workflow support through testing, documentation, and issue tracking."
  ],
  Security: [
    "{action} {scope}site activity in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping incident notes and handoffs clear.",
    "{bridgeAction} safety procedures by monitoring access, documenting incidents, and escalating concerns.",
    "{action} visitor and access-control needs while maintaining calm, policy-aware service.",
    "{action} incident details and shift notes to support reliable safety communication.",
    "{bridgeAction} compliance-aware operations through documentation, escalation, and procedure follow-through.",
    "{action} emergency or routine requests with attention to safety and response consistency.",
    "{bridgeAction} site reliability by supporting access control, visitor management, and incident reporting."
  ]
};

const splitList = (value: string) =>
  value
    .split(/,|\n/)
    .map((item) => cleanWhitespace(item))
    .filter((item) => !isWeakFreeText(item))
    .filter(Boolean);

const cleanWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const compact = (items: string[]) => {
  const seen = new Set<string>();

  return items
    .map((item) => cleanWhitespace(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sentenceList = (items: string[], joiner = "and") => {
  const cleanItems = compact(items);
  if (cleanItems.length <= 1) return cleanItems[0] ?? "";
  if (cleanItems.length === 2) return `${cleanItems[0]} ${joiner} ${cleanItems[1]}`;
  if (joiner === "&") return `${cleanItems.slice(0, -1).join(", ")} & ${cleanItems.at(-1)}`;
  return `${cleanItems.slice(0, -1).join(", ")}, ${joiner} ${cleanItems.at(-1)}`;
};

function titleCase(value: string) {
  return cleanWhitespace(value)
    .toLowerCase()
    .split(" ")
    .map((word) => acronyms.get(word) ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeTool(value: string) {
  const cleaned = cleanWhitespace(value);
  const lower = cleaned.toLowerCase();
  const knownAiTool = aiToolOptions.find((tool) => tool.toLowerCase() === lower);
  if (knownAiTool) return knownAiTool;
  return acronyms.get(lower) ?? titleCase(cleaned);
}

function normalizeCompany(value: string) {
  const cleaned = cleanWhitespace(value);
  if (!cleaned || isWeakFreeText(cleaned)) return "";
  const hasIntentionalCaps = /[a-z][A-Z]/.test(cleaned);
  return hasIntentionalCaps ? cleaned : titleCase(cleaned);
}

function isWeakTarget(value: string) {
  const cleaned = cleanWhitespace(value).toLowerCase();
  if (!cleaned || cleaned.length <= 2) return true;
  if (weakTargetValues.has(cleaned)) return true;
  if (!/[aeiou]/.test(cleaned) && cleaned.length < 6) return true;
  if (/^(.)\1+$/.test(cleaned)) return true;
  return false;
}

function isWeakFreeText(value: string) {
  const cleaned = cleanWhitespace(value).toLowerCase();
  if (!cleaned) return true;
  if (weakFreeTextValues.has(cleaned)) return true;
  if (cleaned.length === 1) return true;
  if (/^[^\w]+$/.test(cleaned)) return true;
  if (/^(.)\1{2,}$/.test(cleaned)) return true;
  return false;
}

function normalizeTargetRole(data: IntakeData) {
  return isWeakTarget(data.targetJobTitle) ? defaultTargetByFamily[data.roleFamily] : titleCase(data.targetJobTitle);
}

function normalizeResponsibility(value: string) {
  if (isWeakFreeText(value)) return "";
  const alias = responsibilityAliases.get(cleanWhitespace(value).toLowerCase());
  if (alias) return alias;
  const titled = titleCase(value);
  return titled.replace(/\bCrm\b/g, "CRM").replace(/\bSop\b/g, "SOP").replace(/\bKpi\b/g, "KPI");
}

function readablePhrase(value: string) {
  return value
    .split(" ")
    .map((word) => acronyms.get(word.toLowerCase()) ?? word.toLowerCase())
    .join(" ");
}

const scopeFields: Array<[keyof IntakeData, string, string, string[]]> = [
  ["customersServed", "customers", "customers served", ["customer", "client", "user", "visitor", "account", "prospect"]],
  ["ticketsHandled", "tickets", "tickets handled", ["ticket", "request", "case", "issue"]],
  ["projectsSupported", "projects", "projects supported", ["project", "initiative", "workflow", "rollout", "schedule", "calendar", "package", "order", "feature"]],
  ["teamSizeSupported", "team members", "team members supported", ["team", "person", "people", "staff", "stakeholder"]],
  ["callsHandled", "calls", "calls handled", ["call", "chat", "email", "follow-up", "meeting", "escalation"]],
  ["revenueInfluenced", "revenue", "revenue influenced", ["revenue", "budget", "pipeline", "money", "cash", "sales"]],
  ["reportsCreated", "reports", "reports created", ["report", "record", "document", "doc", "tracker", "article", "update"]]
];

function formatScopePhrase(value: string, shortLabel: string, aliases: string[]) {
  const cleaned = cleanWhitespace(value);
  const lower = cleaned.toLowerCase();
  const alreadyLabeled = aliases.some((term) => lower.includes(term.toLowerCase()));

  return alreadyLabeled ? cleaned : `${cleaned} ${shortLabel}`;
}

function buildScopeItems(data: IntakeData) {
  return scopeFields
    .map(([key, shortLabel, longLabel, aliases]) => {
      const value = cleanWhitespace(String(data[key]));
      if (!value) return null;
      const basePhrase = formatScopePhrase(value, shortLabel, aliases);
      const phrase =
        key === "customersServed" && ["IT Support", "Tech"].includes(data.roleFamily)
          ? basePhrase.replace(/\bcustomers\b/gi, "users")
          : basePhrase;
      return { key, value, shortLabel, longLabel, phrase };
    })
    .filter(Boolean) as Array<{ key: keyof IntakeData; value: string; shortLabel: string; longLabel: string; phrase: string }>;
}

function buildUserResponsibilityList(data: IntakeData) {
  return compact([
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility),
    ...data.selectedResponsibilities.map(normalizeResponsibility),
    normalizeResponsibility(data.customRoleIndustry),
    ...splitList(data.responsibilities).map(normalizeResponsibility)
  ]).slice(0, 8);
}

function buildResponsibilityList(data: IntakeData) {
  const userResponsibilities = buildUserResponsibilityList(data);
  if (userResponsibilities.length) return userResponsibilities;
  return roleStrategies[data.roleFamily].safeDefaults;
}

function buildToolList(data: IntakeData) {
  return compact(splitList(data.tools).filter((tool) => !isWeakFreeText(tool)).map(normalizeTool)).slice(0, 6);
}

function buildAiWorkflowList(data: IntakeData) {
  if (!selectedAiTools(data.tools).length) return [];
  return compact(data.selectedAiWorkflows.map(normalizeAiWorkflow).filter((workflow) => !isWeakFreeText(workflow))).slice(0, 6);
}

function buildAiWorkflowSkillList(data: IntakeData) {
  const workflows = buildAiWorkflowList(data);
  return compact([
    ...workflows.map((workflow) => aiWorkflowSkillLabels.get(workflow) ?? `${readablePhrase(workflow)} Support`),
    ...buildAiAtsKeywords(workflows)
  ]).slice(0, 6);
}

function aiWorkflowPhrase(data: IntakeData) {
  const workflows = buildAiWorkflowList(data);
  if (!workflows.length) return "";
  const readable = workflows.map((workflow) => workflow.toLowerCase());
  return sentenceList(readable.slice(0, 3));
}

function aiWorkflowBullet(data: IntakeData, roleFamily: RoleFamily) {
  const phrase = aiWorkflowPhrase(data);
  if (!phrase) return "";

  const endings: Record<RoleFamily, string> = {
    Tech: "support technical documentation, testing, and development follow-through.",
    Business: "support research synthesis, documentation, and business decision-making.",
    Operations: "support workflow planning, process documentation, and operational efficiency.",
    "Customer Success": "support customer communication, knowledge retrieval, and service follow-through.",
    Admin: "support documentation, meeting notes, and organized administrative workflows.",
    Sales: "support prospect research, customer communication, and follow-up preparation.",
    Security: "support documentation, reporting, and procedure-focused communication.",
    "Project Coordination": "support project planning, status documentation, and cross-functional follow-through.",
    "IT Support": "support troubleshooting documentation, knowledge retrieval, and user support workflows."
  };

  return `Applied AI-assisted workflows for ${phrase} to ${endings[roleFamily]}`;
}

function buildSkillList(data: IntakeData) {
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data);
  const aiTools = selectedAiTools(data.tools).map((tool) => tool.toLowerCase());
  const nonAiTools = tools.filter((tool) => !aiTools.includes(tool.toLowerCase()));

  return compact([
    ...responsibilities.slice(0, 6),
    ...data.customRoleTransferableSkills.map(normalizeResponsibility).slice(0, 5),
    ...data.customRoleWorkStyles.map(normalizeResponsibility).slice(0, 3),
    ...roleIntelligence[data.roleFamily].skills.map(normalizeResponsibility),
    ...nonAiTools.slice(0, 4),
    ...buildAiWorkflowSkillList(data),
    ...workflowSkillsByFamily[data.roleFamily]
  ]).slice(0, 14);
}

function detectDomain(role: ExperienceRole | { title: string; company: string }) {
  const roleHaystack = [role.title, role.company].join(" ").toLowerCase();

  return domainProfiles.find((profile) => profile.keywords.some((keyword) => roleHaystack.includes(keyword))) ?? null;
}

function fallbackDomainProfile(data: IntakeData): DomainProfile | null {
  const industry = cleanWhitespace(data.customRoleIndustry);
  const workStyles = compact(data.customRoleWorkStyles.map(readablePhrase));
  const transferableSkills = compact(data.customRoleTransferableSkills.map(readablePhrase));
  const notes = splitList(data.customRoleNotes).map(readablePhrase);
  const signals = compact([industry.toLowerCase(), ...workStyles, ...transferableSkills, ...notes]);
  if (!signals.length) return null;

  const environmentByIndustry: Array<[RegExp, string, string]> = [
    [/gaming|sportsbook|casino/i, "gaming and customer transaction environment", "customer transactions, payment handling, records, and compliance-aware service steps"],
    [/retail/i, "retail service environment", "POS transactions, customer requests, inventory tasks, and store records"],
    [/warehouse|logistics/i, "logistics and fulfillment environment", "inventory movement, fulfillment tasks, handoffs, and tracking records"],
    [/food|hospitality/i, "fast-paced service environment", "service requests, order flow, customer communication, and shift tasks"],
    [/healthcare/i, "service and records-focused healthcare environment", "patient or customer requests, records, scheduling, and compliance-aware handoffs"],
    [/finance|banking|insurance/i, "transaction and records-focused service environment", "customer requests, payment or account details, records, and policy-aware handoffs"],
    [/security|government/i, "procedure-focused public service environment", "visitor support, documentation, policy steps, and escalation workflows"],
    [/technology|technical/i, "technical support and workflow environment", "technical requests, troubleshooting notes, documentation, and escalation workflows"]
  ];
  const match = environmentByIndustry.find(([pattern]) => pattern.test(industry));
  const environment = match?.[1] ?? `${industry ? industry.toLowerCase() : "cross-functional"} work environment`;
  const processLanguage = match?.[2] ?? (sentenceList(compact([...workStyles, ...transferableSkills]).slice(0, 4)) || "daily work requests, records, and handoffs");
  const strengths = compact([...transferableSkills, ...workStyles, industry]).slice(0, 5);

  return {
    name: "custom",
    keywords: signals,
    environment,
    strengths,
    processLanguage
  };
}

function activityPhrase(responsibility: string) {
  const readable = readablePhrase(responsibility);
  const lower = readable.toLowerCase();
  if (lower.includes("support tickets") || lower.includes("ticket management")) return "handling support tickets";
  if (lower.includes("troubleshooting")) return "troubleshooting user issues";
  if (lower.includes("reporting")) return "preparing reports and updates";
  if (lower.includes("task coordination")) return "coordinating daily tasks";
  if (lower.includes("timeline tracking")) return "tracking timelines";
  if (lower.includes("status reporting")) return "preparing status updates";
  if (lower.includes("scheduling")) return "coordinating schedules";
  if (lower.includes("client communication")) return "supporting client communication";
  if (lower.includes("customer communication")) return "supporting customer communication";
  if (lower.includes("records management")) return "maintaining records";
  if (lower.includes("documentation")) return "maintaining documentation";
  if (lower.includes("crm")) return "updating CRM records";
  return `handling ${readable}`;
}

function responsibilityObject(responsibility: string) {
  const readable = readablePhrase(responsibility);
  if (/support|documentation|communication|coordination|management|tracking|reporting|handling/i.test(readable)) return readable;
  return `${readable} support`;
}

function buildOutcomeSupport(data: IntakeData) {
  const selected = compact(data.selectedOutcomes.map((outcome) => outcome.toLowerCase()));
  const custom = cleanWhitespace(data.outcomes).replace(/^improved\s+/i, "");
  if (selected.length) return sentenceList(selected.slice(0, 2));
  if (custom && !isWeakFreeText(custom)) return custom;
  return "";
}

function chooseToolPhrase(tools: string[], roleFamily: RoleFamily, responsibility: string) {
  if (!tools.length) return "";
  const lowerResponsibility = responsibility.toLowerCase();
  const compatibleTools = tools.filter((tool) => {
    const lowerTool = tool.toLowerCase();
    if (["Customer Success", "Sales"].includes(roleFamily)) return /salesforce|hubspot|zendesk|intercom|crm|google workspace|slack|excel/.test(lowerTool);
    if (roleFamily === "IT Support") return /active directory|jira|servicenow|windows|macos|azure|office 365|zendesk/.test(lowerTool);
    if (roleFamily === "Project Coordination") return /asana|trello|monday|jira|sheets|slack|teams|notion/.test(lowerTool);
    if (roleFamily === "Admin") return /google workspace|office|excel|outlook|calendly|slack|notion|docusign/.test(lowerTool);
    if (roleFamily === "Operations" || roleFamily === "Business") return /excel|sheets|sap|oracle|notion|airtable|tableau|power bi|sql/.test(lowerTool);
    if (roleFamily === "Tech") return /jira|github|sql|sheets|figma|postman|notion|excel/.test(lowerTool);
    return /excel|workspace|teams|slack|system|report|camera|radio|access/.test(lowerTool);
  });

  if (!compatibleTools.length) return "";
  if (/communication|follow|stakeholder|client|customer|support/.test(lowerResponsibility)) {
    return ` using ${sentenceList(compatibleTools.slice(0, 2))}`;
  }
  if (/document|record|report|CRM|ticket|tracking|analysis|timeline|status/i.test(responsibility)) {
    return ` in ${sentenceList(compatibleTools.slice(0, 2))}`;
  }
  return compatibleTools.length >= 2 ? ` with ${sentenceList(compatibleTools.slice(0, 2))}` : "";
}

function roleLevel(role: ExperienceRole, index: number) {
  if (leadershipTerms.test(role.title)) return "senior";
  if (supportTerms.test(role.title)) return index === 0 ? "current-support" : "prior-support";
  return index === 0 ? "current" : "prior";
}

function roleContext(role: ExperienceRole, data: IntakeData, index: number) {
  const strategy = roleStrategies[data.roleFamily];
  const domain = detectDomain(role) ?? fallbackDomainProfile(data);
  const level = roleLevel(role, index);
  const context =
    level === "senior" ? strategy.seniorContext : index === 0 ? strategy.supportContext : `${strategy.supportContext} in an earlier support role`;

  return { strategy, domain, level, context };
}

function renderPattern(pattern: string, context: BulletContext) {
  return cleanSentence(
    pattern.replace(/\{(\w+)\}/g, (_, key: keyof BulletContext) => {
      return context[key] ?? "";
    })
  );
}

function scopeForBullet(scopes: ReturnType<typeof buildScopeItems>, preferredKeys: Array<keyof IntakeData>) {
  return preferredKeys.map((key) => scopes.find((scope) => scope.key === key)).find(Boolean) ?? scopes[0];
}

function cleanSentence(sentence: string) {
  let cleaned = cleanWhitespace(sentence)
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s+\./g, ".")
    .replace(/ ,/g, ",")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\ba ([aeiou])/gi, "an $1")
    .replace(/\bwhile ([a-z]+ing)\b/gi, "while $1")
    .replace(/\bwhile ([a-z]+ tickets|[a-z]+ communication|[a-z]+ coordination|[a-z]+ tracking|[a-z]+ reporting)\b/gi, "while handling $1")
    .replace(/\bdocumented documentation\b/gi, "Created documentation")
    .replace(/\bDocumented documentation\b/g, "Created documentation");

  awkwardPhrases.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, (match) => match.replace(/\s+\w+$/i, ""));
  });

  if (!/[.!?]$/.test(cleaned)) cleaned += ".";
  return cleaned;
}

function buildExperienceBullets(data: IntakeData, role: ExperienceRole, roleIndex: number) {
  const responsibilities = buildResponsibilityList(data);
  const tools = buildToolList(data);
  const scopes = buildScopeItems(data);
  const outcome = buildOutcomeSupport(data);
  const { strategy, domain, level, context } = roleContext(role, data, roleIndex);
  const verbs = roleIndex === 0 ? strategy.verbs : ["Assisted", "Maintained", "Communicated", "Supported", "Documented"];
  const primary = responsibilities[0] ?? strategy.safeDefaults[0];
  const secondary = responsibilities[1] ?? strategy.safeDefaults[1];
  const tertiary = responsibilities[2] ?? strategy.safeDefaults[2];
  const selectedActions = compact(data.selectedActions.map(normalizeResponsibility)).slice(0, 3);
  const scopeOne = scopeForBullet(scopes, ["customersServed", "ticketsHandled", "callsHandled"]);
  const scopeTwo = scopeForBullet(scopes, ["reportsCreated", "projectsSupported", "teamSizeSupported"]);
  const processLanguage = domain?.processLanguage ?? context;
  const outcomeClause = outcome ? ` to support ${outcome}` : " to maintain dependable service standards";
  const environment = domain?.environment ?? strategy.environment;
  const selectedFocus = strategy.focus
    .map(readablePhrase)
    .filter((focus) => ![primary, secondary, tertiary].map(readablePhrase).includes(focus))
    .slice(0, 3);
  const roleFocus = selectedFocus.length ? selectedFocus.join(", ") : strategy.focus.slice(0, 3).map(readablePhrase).join(", ");
  const patterns = bulletPatternLibrary[data.roleFamily];
  const patternContext: BulletContext = {
    action: level === "senior" ? "Coordinated" : verbs[0],
    bridgeAction: verbs[2] ?? "Supported",
    company: role.company,
    context,
    domainAction: activityPhrase(primary),
    environment,
    outcomeClause,
    processLanguage,
    responsibility: readablePhrase(secondary),
    scope: scopeOne ? `${scopeOne.phrase} across ` : "",
    scopeTwo: scopeTwo?.phrase ?? "",
    targetFocus: selectedActions.length ? sentenceList(selectedActions.map(readablePhrase)) : responsibilityObject(tertiary) || roleFocus,
    toolPhrase: roleIndex === 0 ? chooseToolPhrase(tools, data.roleFamily, secondary) : ""
  };

  if (roleIndex > 0) {
    const priorContext = { ...patternContext, action: verbs[0], bridgeAction: verbs[2] ?? "Communicated", toolPhrase: "", scope: "" };
    return qualityCheckBullets(
      [
        renderPattern(patterns[3], priorContext),
        renderPattern(patterns[4], priorContext),
        renderPattern(patterns[5], priorContext)
      ],
      verbs
    );
  }

  return qualityCheckBullets(
    [
      renderPattern(patterns[0], patternContext),
      renderPattern(patterns[1], patternContext),
      aiWorkflowBullet(data, data.roleFamily) || renderPattern(patterns[2], patternContext)
    ],
    verbs
  );
}

function buildExperience(data: IntakeData): ExperienceRole[] {
  const roles = [
    {
      title: data.currentTitle,
      company: data.currentCompany,
      time: data.currentTime,
      fallbackCompany: "Current Company"
    },
    {
      title: data.previousTitle,
      company: data.previousCompany,
      time: data.previousTime,
      fallbackCompany: "Previous Company"
    },
    {
      title: data.additionalTitle,
      company: data.additionalCompany,
      time: data.additionalTime,
      fallbackCompany: "Additional Company"
    }
  ]
    .filter((role) => cleanWhitespace(role.title))
    .slice(0, 3)
    .map((role) => ({
      title: titleCase(role.title),
      company: normalizeCompany(role.company) || role.fallbackCompany,
      time: isWeakFreeText(role.time) ? "Dates" : cleanWhitespace(role.time) || "Dates",
      bullets: []
    }));

  return roles.map((role, index) => ({
    ...role,
    bullets: buildExperienceBullets(data, role, index)
  }));
}

function qualityCheckBullets(bullets: string[], fallbackVerbs: string[]) {
  const usedOpeners = new Set<string>();

  return compact(bullets)
    .map(cleanSentence)
    .map((bullet) => {
      const opener = bullet.split(" ")[0];
      if (!usedOpeners.has(opener.toLowerCase())) {
        usedOpeners.add(opener.toLowerCase());
        return bullet;
      }
      const replacement = fallbackVerbs.find((verb) => !usedOpeners.has(verb.toLowerCase())) ?? "Supported";
      usedOpeners.add(replacement.toLowerCase());
      return bullet.replace(/^\w+/, replacement);
    })
    .filter((bullet) => bullet.length > 30)
    .slice(0, 3);
}

function limitSentences(value: string, maxSentences: number) {
  const sentences = value.match(/[^.!?]+[.!?]+/g)?.map(cleanWhitespace) ?? [cleanSentence(value)];
  return sentences.slice(0, maxSentences).join(" ");
}

function buildSummary(data: IntakeData, target: string, experience: ExperienceRole[]) {
  const roleFamily = data.roleFamily;
  const currentRole = experience[0];
  const domain = currentRole ? detectDomain(currentRole) ?? fallbackDomainProfile(data) : fallbackDomainProfile(data);
  const strategy = roleStrategies[roleFamily];
  const responsibilities = buildResponsibilityList(data);
  const background = currentRole
    ? `${currentRole.title} with experience in ${domain?.environment ?? strategy.environment}`
    : `Early-career professional with ${roleFamily.toLowerCase()} experience`;
  const strengths = compact([...(domain?.strengths ?? []), ...responsibilities.map(readablePhrase), ...strategy.focus.map(readablePhrase)]).slice(0, 3);
  const aiPhrase = aiWorkflowPhrase(data);
  const direction = `${target} roles`;

  return limitSentences(
    `${background}. Brings ${sentenceList(strengths)}${aiPhrase ? ` while using AI-assisted workflows for ${aiPhrase}` : ""} with a transition focus toward ${direction}.`,
    3
  );
}

function buildLinkedInSummary(data: IntakeData, target: string, experience: ExperienceRole[]) {
  const currentRole = experience[0];
  const domain = currentRole ? detectDomain(currentRole) ?? fallbackDomainProfile(data) : fallbackDomainProfile(data);
  const strategy = roleStrategies[data.roleFamily];
  const responsibilities = buildResponsibilityList(data).slice(0, 2).map(readablePhrase);
  const strengths = compact([...(domain?.strengths ?? []), ...responsibilities, ...strategy.focus.map(readablePhrase)]).slice(0, 3);
  const environment = domain?.environment ?? strategy.environment;
  const strengthText = sentenceList(strengths);
  const aiPhrase = aiWorkflowPhrase(data);
  const aiSentence = aiPhrase ? ` Uses AI-assisted workflows for ${aiPhrase} without replacing the underlying work or judgment.` : "";
  const variants: Record<RoleFamily, string> = {
    "Customer Success": `${target} candidate with hands-on experience in ${environment}. Strongest areas include ${strengthText}, with a service style built around clear updates, organized notes, and dependable follow-through.${aiSentence}`,
    Operations: `${target} candidate with practical experience keeping work organized in ${environment}. Brings ${strengthText} and a steady approach to documentation, handoffs, and process consistency.${aiSentence}`,
    Admin: `${target} candidate with experience supporting ${environment}. Brings ${strengthText}, organized communication, and reliable follow-through across records, schedules, and daily office needs.${aiSentence}`,
    Sales: `${target} candidate with experience supporting customer-facing workflows in ${environment}. Brings ${strengthText} and a practical approach to follow-up, account notes, and pipeline support.${aiSentence}`,
    Business: `${target} candidate with experience supporting reporting and workflow clarity in ${environment}. Brings ${strengthText}, organized documentation, and a practical eye for operational details.${aiSentence}`,
    "Project Coordination": `${target} candidate with experience keeping project details moving in ${environment}. Brings ${strengthText}, clear status communication, and organized follow-through across timelines and handoffs.${aiSentence}`,
    "IT Support": `${target} candidate with experience in ${environment}. Brings ${strengthText}, clear troubleshooting notes, and a user-focused approach to ticket resolution and escalation.${aiSentence}`,
    Tech: `${target} candidate with experience supporting ${environment}. Brings ${strengthText}, organized documentation, and practical follow-through across technical workflows.${aiSentence}`,
    Security: `${target} candidate with experience in ${environment}. Brings ${strengthText}, calm communication, and procedure-focused follow-through in public-facing settings.${aiSentence}`
  };

  return limitSentences(variants[data.roleFamily], 3);
}

function buildHeadline(data: IntakeData, target: string, skills: string[]) {
  const headlineSkills = compact([
    ...buildResponsibilityList(data).slice(0, 2),
    ...skills.filter((skill) => !/\b(reliable|follow-through|professional communication)\b/i.test(skill)).slice(0, 3)
  ]).slice(0, 3);

  const middle = sentenceList(headlineSkills, "&");
  const headline = `${target} | ${middle} | ${roleStrategies[data.roleFamily].valueArea}`;
  return headline.length > 115 ? `${target} | ${headlineSkills.slice(0, 2).join(" & ")} | ${roleStrategies[data.roleFamily].valueArea}` : headline;
}

function qualityCheckResume(resume: ResumePackage): ResumePackage {
  const experience = resume.experience.map((role) => ({
    ...role,
    bullets: qualityCheckBullets(role.bullets, ["Supported", "Documented", "Maintained"]).filter(
      (bullet, index, bullets) => bullets.findIndex((item) => item.toLowerCase() === bullet.toLowerCase()) === index
    )
  }));

  return {
    ...resume,
    summary: limitSentences(cleanSentence(resume.summary), 3),
    coreSkills: compact(resume.coreSkills).slice(0, 14),
    experience,
    linkedinHeadline: resume.linkedinHeadline.length > 120 ? resume.linkedinHeadline.slice(0, 117).replace(/\s+\S*$/, "") + "..." : resume.linkedinHeadline,
    linkedinSummary: limitSentences(resume.linkedinSummary, 3)
  };
}

export function generateResumePackage(data: IntakeData): ResumePackage {
  const target = normalizeTargetRole(data);
  const skills = buildSkillList(data);
  const experience = buildExperience(data);

  return polishResumePackage(qualityCheckResume({
    summary: buildSummary(data, target, experience),
    coreSkills: skills,
    experience,
    education: educationPlaceholder,
    linkedinHeadline: buildHeadline(data, target, skills),
    linkedinSummary: buildLinkedInSummary(data, target, experience)
  }));
}
