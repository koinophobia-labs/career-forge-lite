import { roleIntelligence } from "@/lib/career-data";
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

const weakTargetValues = new Set(["ee", "test", "testing", "asdf", "qwerty", "none", "na", "n/a", "unknown"]);
const acronyms = new Map([
  ["api", "API"],
  ["crm", "CRM"],
  ["css", "CSS"],
  ["html", "HTML"],
  ["hubspot", "HubSpot"],
  ["it", "IT"],
  ["kpi", "KPI"],
  ["pos", "POS"],
  ["qa", "QA"],
  ["sop", "SOP"],
  ["sql", "SQL"],
  ["ui", "UI"],
  ["ux", "UX"]
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

const splitList = (value: string) =>
  value
    .split(/,|\n/)
    .map((item) => cleanWhitespace(item))
    .filter(Boolean);

const cleanWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const sentenceList = (items: string[], joiner = "and") => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${joiner} ${items[1]}`;
  if (joiner === "&") return `${items.slice(0, -1).join(", ")} & ${items.at(-1)}`;
  return `${items.slice(0, -1).join(", ")}, ${joiner} ${items.at(-1)}`;
};

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
  return acronyms.get(lower) ?? titleCase(cleaned);
}

function normalizeCompany(value: string) {
  const cleaned = cleanWhitespace(value);
  if (!cleaned) return "";
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

function normalizeTargetRole(data: IntakeData) {
  return isWeakTarget(data.targetJobTitle) ? defaultTargetByFamily[data.roleFamily] : titleCase(data.targetJobTitle);
}

function normalizeResponsibility(value: string) {
  const alias = responsibilityAliases.get(cleanWhitespace(value).toLowerCase());
  if (alias) return alias;
  const titled = titleCase(value);
  return titled.replace(/\bCrm\b/g, "CRM").replace(/\bSop\b/g, "SOP").replace(/\bKpi\b/g, "KPI");
}

function readablePhrase(value: string) {
  return value
    .split(" ")
    .map((word, index) => {
      const normalized = acronyms.get(word.toLowerCase());
      if (normalized) return normalized;
      return index === 0 ? word.toLowerCase() : word.toLowerCase();
    })
    .join(" ");
}

const scopeFields: Array<[keyof IntakeData, string, string, string[]]> = [
  ["customersServed", "customers", "customers served", ["customer", "client", "user", "visitor", "account", "prospect"]],
  ["ticketsHandled", "tickets", "tickets handled", ["ticket", "request", "case", "issue"]],
  ["projectsSupported", "projects", "projects supported", ["project", "initiative", "workflow", "rollout", "schedule", "calendar"]],
  ["teamSizeSupported", "team members", "team members supported", ["team", "person", "people", "staff", "stakeholder"]],
  ["callsHandled", "calls", "calls handled", ["call", "chat", "email", "follow-up", "meeting", "escalation"]],
  ["revenueInfluenced", "revenue", "revenue influenced", ["revenue", "budget", "pipeline", "money", "cash", "sales"]],
  ["reportsCreated", "reports", "reports created", ["report", "record", "document", "doc", "tracker", "article", "update"]]
];

function formatScopePhrase(value: string, shortLabel: string, aliases: string[]) {
  const cleaned = cleanWhitespace(value);
  const lower = cleaned.toLowerCase();
  const labelTerms = aliases.map((term) => term.toLowerCase());
  const alreadyLabeled = labelTerms.some((term) => lower.includes(term));

  return alreadyLabeled ? cleaned : `${cleaned} ${shortLabel}`;
}

function buildScopeItems(data: IntakeData) {
  return scopeFields
    .map(([key, shortLabel, longLabel, aliases]) => {
      const value = cleanWhitespace(String(data[key]));
      return value ? { value, shortLabel, longLabel, phrase: formatScopePhrase(value, shortLabel, aliases) } : null;
    })
    .filter(Boolean) as Array<{ value: string; shortLabel: string; longLabel: string; phrase: string }>;
}

function buildResponsibilityList(data: IntakeData) {
  return compact([
    ...data.selectedResponsibilities.map(normalizeResponsibility),
    ...splitList(data.responsibilities).map(normalizeResponsibility),
    ...roleIntelligence[data.roleFamily].responsibilities.map(normalizeResponsibility)
  ]).slice(0, 8);
}

function buildToolList(data: IntakeData) {
  return compact(splitList(data.tools).map(normalizeTool)).slice(0, 6);
}

function buildSkillList(data: IntakeData) {
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data);

  return compact([
    ...roleIntelligence[data.roleFamily].skills.map(normalizeResponsibility),
    ...responsibilities.slice(0, 5),
    ...tools,
    ...workflowSkillsByFamily[data.roleFamily]
  ]).slice(0, 14);
}

function buildOutcomePhrase(data: IntakeData) {
  const selected = data.selectedOutcomes.map((outcome) => outcome.toLowerCase());
  const custom = cleanWhitespace(data.outcomes).toLowerCase();

  if (selected.length) return `improve ${sentenceList(selected.slice(0, 3))}`;
  if (custom) return custom.replace(/^improved\s+/i, "improve ");
  return "maintain reliable service quality";
}

function buildExperienceBullets(data: IntakeData, role: ExperienceRole, roleIndex: number) {
  const responsibilities = buildResponsibilityList(data);
  const tools = buildToolList(data);
  const scopes = buildScopeItems(data);
  const outcome = buildOutcomePhrase(data);
  const primary = responsibilities[0] ?? "Service Requests";
  const secondary = responsibilities[1] ?? "Documentation";
  const tertiary = responsibilities[2] ?? "Follow-Up Communication";
  const primaryPhrase = readablePhrase(primary);
  const secondaryPhrase = readablePhrase(secondary);
  const tertiaryPhrase = readablePhrase(tertiary);
  const toolPhrase = tools.length ? ` using ${sentenceList(tools.slice(0, 3))}` : "";
  const scopeOne = scopes[0]?.phrase;
  const scopeTwo = scopes[1]?.phrase;
  const scopeThree = scopes[2]?.phrase;
  const actionSets = [
    ["Managed", "Documented", "Resolved"],
    ["Supported", "Tracked", "Maintained"],
    ["Coordinated", "Resolved", "Assisted"]
  ];
  const [firstAction, secondAction, thirdAction] = actionSets[roleIndex] ?? actionSets[0];

  const firstScope = scopeOne ? ` for ${scopeOne}` : "";
  const secondScope = scopeTwo ? ` across ${scopeTwo}` : "";
  const thirdScope = scopeThree ? ` supporting ${scopeThree}` : "";
  const outcomeClause = outcome.startsWith("improve") ? `to ${outcome}` : `to support ${outcome}`;

  return compact([
    `${firstAction} ${primaryPhrase}${toolPhrase}${firstScope} ${outcomeClause}.`,
    `${secondAction} ${secondaryPhrase}, documentation, and status updates${secondScope}, keeping records accurate and next steps visible.`,
    `${thirdAction === "Assisted" ? "Assisted with" : thirdAction} ${tertiaryPhrase}${thirdScope}, resolving routine issues and escalating complex needs for consistent follow-through.`
  ]).slice(0, 3);
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
      time: cleanWhitespace(role.time) || "Dates",
      bullets: []
    }));

  return roles.map((role, index) => ({
    ...role,
    bullets: buildExperienceBullets(data, role, index)
  }));
}

export function generateResumePackage(data: IntakeData): ResumePackage {
  const target = normalizeTargetRole(data);
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data);
  const skills = buildSkillList(data);
  const scopes = buildScopeItems(data);
  const outcomes = data.selectedOutcomes.map((outcome) => outcome.toLowerCase());
  const roleFamily = data.roleFamily;
  const primaryResponsibilities = responsibilities.slice(0, 4);
  const timeSentence = cleanWhitespace(data.currentTime) ? ` Recent experience includes ${cleanWhitespace(data.currentTime)} as a ${titleCase(data.currentTitle || target)}.` : "";
  const toolSentence = tools.length ? ` Tools include ${sentenceList(tools.slice(0, 4))}.` : "";
  const scopeSentence = scopes.length ? ` Scope includes ${sentenceList(scopes.slice(0, 3).map((scope) => scope.phrase))}.` : "";
  const outcomeSentence = outcomes.length ? ` Work is centered on improving ${sentenceList(outcomes.slice(0, 3))}.` : "";
  const headlineSkills = compact([
    ...tools.slice(0, 2),
    ...responsibilities.slice(0, 3),
    ...skills.slice(0, 3)
  ]).slice(0, 3);

  return {
    summary: `Early-career ${target} with hands-on experience in ${sentenceList(primaryResponsibilities.map(readablePhrase).slice(0, 4))}. Brings organized follow-through, clear communication, and practical ${roleFamily.toLowerCase()} experience in fast-moving work environments.${timeSentence}${toolSentence}${scopeSentence}${outcomeSentence}`,
    coreSkills: skills,
    experience: buildExperience(data),
    education: "Education or Certification | School or Provider | Year",
    linkedinHeadline: `${target} | ${sentenceList(headlineSkills, "&")} | ${roleIntelligence[data.roleFamily].valueArea}`,
    linkedinSummary: `Early-career ${target} focused on ${roleIntelligence[data.roleFamily].valueArea.toLowerCase()}. Experience includes ${sentenceList(primaryResponsibilities.slice(0, 3).map(readablePhrase))}${tools.length ? ` with hands-on use of ${sentenceList(tools.slice(0, 3))}` : ""}. Known for steady communication, organized follow-through, and practical problem solving.`
  };
}
