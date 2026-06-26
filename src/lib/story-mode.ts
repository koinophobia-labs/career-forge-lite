import {
  allToolOptions,
  careerTargets,
  findJobArsenal,
  initialIntake,
  roleIntelligence
} from "@/lib/career-data";
import {
  findIndependentWorkRole,
  formatIndependentTitle,
  independentWorkArsenals,
  independentWorkRoles,
  inferIndependentWorkCategory,
  inferIndependentWorkRoleTitle
} from "@/lib/independent-work-intelligence";
import { aiWorkflowOptions, normalizeAiWorkflow, selectedAiTools } from "@/lib/modern-work-intelligence";
import { parseRoleAnswer } from "@/lib/natural-role-parser";
import type { IntakeData, RoleFamily } from "@/types/career";

export type StoryDossier = {
  intake: IntakeData;
  confidence: "needs_follow_up" | "usable" | "strong";
  capturedFields: string[];
  stillHelpfulFields: string[];
  extracted: {
    role: string;
    company: string;
    dates: string;
    targetRole: string;
    roleFamily: RoleFamily;
    responsibilities: string[];
    tools: string[];
    scope: string[];
    transferableSignals: string[];
  };
  missingCriticalDetails: string[];
  nextMissingField: string;
  focusedFollowUp: string;
};

const roleFamilyKeywords: Array<[RoleFamily, RegExp]> = [
  ["IT Support", /help desk|it support|desktop|service desk|technical support|troubleshoot|password|active directory/i],
  ["Project Coordination", /project|program|timeline|milestone|implementation|pmo|status update/i],
  ["Admin", /admin|assistant|office|front desk|reception|calendar|scheduling|records/i],
  ["Sales", /sales|business development|lead|prospect|pipeline|outreach|account representative/i],
  ["Operations", /operations|logistics|warehouse|inventory|fulfillment|process|workflow|scheduling|supervisor/i],
  ["Business", /business analyst|reporting|analysis|data|stakeholder|research|process analyst/i],
  ["Security", /security|safety|access control|incident|surveillance|patrol/i],
  ["Tech", /qa|tester|product|technical operations|implementation|data associate|software|web|developer|founder/i],
  ["Customer Success", /customer|client|support|success|onboarding|retention|member service|experience|sportsbook|ticket writer/i]
];

const responsibilityKeywords = [
  "access control",
  "calendar management",
  "cash handling",
  "client communication",
  "crm updates",
  "customer communication",
  "data entry",
  "documentation",
  "escalation handling",
  "inventory tracking",
  "issue escalation",
  "meeting coordination",
  "onboarding",
  "payment processing",
  "process improvement",
  "record keeping",
  "reporting",
  "scheduling",
  "support tickets",
  "task coordination",
  "troubleshooting",
  "user support",
  "wagering transactions"
];

const transferableKeywords = [
  "accuracy",
  "compliance",
  "conflict resolution",
  "customer satisfaction",
  "efficiency",
  "follow-up",
  "high-volume service",
  "operational accuracy",
  "policy enforcement",
  "reliability",
  "response consistency",
  "speed",
  "team coordination"
];

const scopePattern =
  /\b(?:\$?\d[\d,.]*\+?(?:%|k|m| hours?| minutes?| days?| weeks?| months?| years?)?\s*(?:customers|clients|users|tickets|calls|reports|projects|transactions|wagers|orders|accounts|team members|people|cases|requests|dollars|revenue|budget|weekly|monthly|daily|per week|per month|per day)?|\$\d[\d,.]*\+?|\d+%\+?)\b(?:[^,.]*)/gi;

function clean(value = "") {
  return value
    .replace(/[.!,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  const acronyms = new Set(["api", "ats", "crm", "it", "kpi", "pos", "qa", "sql", "ui", "ux"]);
  return clean(value)
    .toLowerCase()
    .split(" ")
    .map((part) => (acronyms.has(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
    .replace(/\bDraftkings\b/g, "DraftKings")
    .replace(/\bMacos\b/g, "macOS");
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items
    .map(clean)
    .filter((item) => item.length > 1 && !/^(test|asdf|none|n\/a|no)$/i.test(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function splitSentences(story: string) {
  return story
    .split(/(?<=[.!?])\s+|\n+/)
    .map(clean)
    .filter((sentence) => sentence.length > 2);
}

function splitSignals(value: string) {
  return unique(value.split(/,|;|\band\b|\bwith\b/i).map(clean));
}

function normalizeKnownRole(title: string) {
  const lower = title.toLowerCase();
  const arsenal = findJobArsenal(title);
  if (arsenal) return { title: arsenal.title, family: arsenal.family };

  const target = careerTargets.find((item) => {
    const aliases = item.aliases?.map((alias) => alias.toLowerCase()) ?? [];
    return item.title.toLowerCase() === lower || aliases.includes(lower);
  });
  if (target) return { title: target.title, family: target.roleFamily };

  const aliasArsenal = [
    findJobArsenal("Sportsbook Ticket Writer"),
    findJobArsenal("Security Officer"),
    findJobArsenal("Retail Associate")
  ].find((item) => item?.aliases?.some((alias) => lower.includes(alias)));

  return aliasArsenal ? { title: aliasArsenal.title, family: aliasArsenal.family } : { title: titleCase(title), family: undefined };
}

function inferRoleFamily(text: string, fallbackTitle: string): RoleFamily {
  const known = normalizeKnownRole(fallbackTitle);
  if (known.family) return known.family;
  return roleFamilyKeywords.find(([, pattern]) => pattern.test(text))?.[0] ?? "Customer Success";
}

function inferTargetRole(story: string, roleTitle: string, roleFamily: RoleFamily) {
  const targetMatch = story.match(/\b(?:targeting|applying for|aiming for|want to be|looking for)\s+(?:a|an)?\s*([^,.]+)/i)?.[1];
  if (targetMatch) return titleCase(targetMatch);

  const knownRole = normalizeKnownRole(roleTitle);
  if (knownRole.family && knownRole.family !== "Security") return knownRole.title;

  const fallbackByFamily: Record<RoleFamily, string> = {
    Admin: "Administrative Assistant",
    Business: "Business Operations Associate",
    "Customer Success": "Customer Success Associate",
    "IT Support": "IT Support Specialist",
    Operations: "Operations Associate",
    "Project Coordination": "Project Coordinator",
    Sales: "Sales Development Representative",
    Security: "Operations Associate",
    Tech: "Technical Support Associate"
  };
  return fallbackByFamily[roleFamily];
}

function hasExplicitTarget(story: string) {
  return /\b(?:targeting|applying for|aiming for|want to be|looking for)\s+(?:a|an)?\s*([^,.]+)/i.test(story);
}

function extractEmail(story: string) {
  return story.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? "";
}

function extractName(story: string) {
  return titleCase(story.match(/\bmy name is\s+([A-Za-z][A-Za-z' -]{1,48}?)(?:\.|,|\s+and\b|$)/i)?.[1] ?? "");
}

function extractRole(story: string) {
  const sentences = splitSentences(story);
  const parsed = sentences
    .map((sentence) => parseRoleAnswer(sentence))
    .find((role) => role.title || role.company || role.dates) ?? parseRoleAnswer(story);
  const normalized = parsed.title ? normalizeKnownRole(parsed.title) : { title: "", family: undefined };
  const independentRole = independentWorkRoles.find((role) => new RegExp(`\\b${role.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(story));
  const independentCategory = inferIndependentWorkCategory(story);
  const inferredIndependentTitle = inferIndependentWorkRoleTitle(story);

  return {
    title: normalized.title || parsed.title || independentRole?.title || inferredIndependentTitle || (independentCategory ? "Independent Work" : ""),
    company: parsed.company,
    dates: parsed.dates,
    family: normalized.family ?? independentRole?.roleFamily
  };
}

function extractTools(story: string) {
  const knownTools = allToolOptions.filter((tool) => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(story));
  const toolClause = story.match(/\b(?:used|tools? like|worked with|systems? like|platforms? like)\s+([^.;]+)/i)?.[1] ?? "";
  return unique([...knownTools, ...splitSignals(toolClause).filter((item) => item.length <= 32).map(titleCase)]).slice(0, 12);
}

function extractAiWorkflows(story: string, tools: string[]) {
  if (!selectedAiTools(tools.join(", ")).length) return [];
  const lower = story.toLowerCase();
  return aiWorkflowOptions
    .filter((workflow) => lower.includes(workflow.toLowerCase()))
    .map(normalizeAiWorkflow)
    .slice(0, 8);
}

function extractResponsibilities(story: string, roleFamily: RoleFamily) {
  const lower = story.toLowerCase();
  const keywordMatches = responsibilityKeywords.filter((item) => lower.includes(item)).map(titleCase);
  const handledClause = story.match(/\b(?:handled|managed|supported|coordinated|processed|maintained|tracked|documented|resolved)\s+([^.;]+)/i)?.[1] ?? "";
  const clauseMatches = splitSignals(handledClause).map(titleCase);
  const familyMatches = roleIntelligence[roleFamily].responsibilities.filter((item) => lower.includes(item.toLowerCase()));
  const independentCategory = inferIndependentWorkCategory(story);
  const independentMatches = independentCategory ? independentWorkArsenals[independentCategory].responsibilities.filter((item) => lower.includes(item.toLowerCase()) || lower.includes(item.split(" ")[0].toLowerCase())) : [];
  return unique([...familyMatches, ...keywordMatches, ...clauseMatches, ...independentMatches]).slice(0, 10);
}

function extractScope(story: string) {
  return unique(story.match(scopePattern) ?? [])
    .filter((item) => !/^(?:19|20)\d{2}(?:\s*(?:-|to)\s*(?:present|now|current|(?:19|20)\d{2}))?$/i.test(item))
    .slice(0, 8);
}

function extractTransferableSignals(story: string, roleFamily: RoleFamily) {
  const lower = story.toLowerCase();
  const keywordMatches = transferableKeywords.filter((item) => lower.includes(item)).map(titleCase);
  const familySkills = roleIntelligence[roleFamily].skills.filter((skill) => lower.includes(skill.toLowerCase()));
  const independentCategory = inferIndependentWorkCategory(story);
  const independentSkills = independentCategory
    ? independentWorkArsenals[independentCategory].skills.filter((skill) => lower.includes(skill.toLowerCase()) || lower.includes(skill.split(" ")[0].toLowerCase()))
    : [];
  return unique([...familySkills, ...keywordMatches, ...independentSkills]).slice(0, 10);
}

function metricForPattern(metrics: string[], pattern: RegExp) {
  return metrics.find((metric) => pattern.test(metric)) ?? "";
}

function focusedFollowUp(missing: string[]) {
  if (missing.includes("contact")) return "What name and email should recruiters use?";
  if (missing.includes("target role")) return "What role should this resume target?";
  if (missing.includes("recent role")) return "What was your title, company, and approximate date range?";
  if (missing.includes("tools")) return "What tools, software, systems, or equipment did you use?";
  if (missing.includes("responsibilities")) return "What work were you trusted with most often?";
  if (missing.includes("scope")) return "What workload or scale can you estimate: customers, tickets, calls, money, reports, or projects?";
  if (missing.includes("outcomes")) return "What improved because of your work: speed, accuracy, customer satisfaction, efficiency, reliability, or compliance?";
  if (missing.includes("education")) return "Any education, certification, training, or coursework you want included?";
  return "What result, improvement, volume, or scope can you add?";
}

function contactCaptured(story: string, intake: IntakeData) {
  return Boolean(intake.fullName || intake.email || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(story));
}

function educationCaptured(story: string, intake: IntakeData) {
  return Boolean(intake.customRoleNotes.match(/\b(education|certification|course|training|degree|school|college|university)\b/i) || /\b(education|certification|course|training|degree|school|college|university|bootcamp)\b/i.test(story));
}

function buildInfoChecklist(story: string, intake: IntakeData, role: { title: string; company: string; dates: string }, extracted: {
  targetRole: string;
  responsibilities: string[];
  tools: string[];
  scope: string[];
  transferableSignals: string[];
}) {
  const fieldChecks = [
    ["Role", Boolean(role.title)],
    ["Company", Boolean(role.company)],
    ["Dates", Boolean(role.dates)],
    ["Target role", Boolean(extracted.targetRole)],
    ["Contact", contactCaptured(story, intake)],
    ["Tools", extracted.tools.length > 0],
    ["Responsibilities", extracted.responsibilities.length > 0],
    ["Scope", extracted.scope.length > 0],
    ["Outcomes", extracted.transferableSignals.length > 0 || intake.selectedOutcomes.length > 0],
    ["Education", educationCaptured(story, intake)]
  ] as const;

  return {
    capturedFields: fieldChecks.filter(([, captured]) => captured).map(([label]) => label),
    stillHelpfulFields: fieldChecks.filter(([, captured]) => !captured).map(([label]) => label)
  };
}

export function parseStoryToDossier(story: string, previousIntake: IntakeData = initialIntake): StoryDossier {
  const role = extractRole(story);
  const roleFamily = role.family ?? inferRoleFamily(story, role.title);
  const independentCategory = inferIndependentWorkCategory([story, role.title].join(" "));
  const independentRole = findIndependentWorkRole(role.title);
  const targetRole = inferTargetRole(story, role.title, roleFamily);
  const explicitTarget = hasExplicitTarget(story);
  const email = extractEmail(story);
  const name = extractName(story);
  const responsibilities = extractResponsibilities(story, roleFamily);
  const tools = extractTools(story);
  const aiWorkflows = extractAiWorkflows(story, tools);
  const scope = extractScope(story);
  const transferableSignals = extractTransferableSignals(story, roleFamily);
  const selectedOutcomes = transferableSignals.filter((item) =>
    /accuracy|satisfaction|efficiency|reliability|compliance|speed|retention|revenue/i.test(item)
  );
  const roleSummary = [role.title, role.company, role.dates].filter(Boolean).join(" | ");
  const extracted = {
    targetRole,
    responsibilities,
    tools,
    scope,
    transferableSignals
  };
  const intake: IntakeData = {
    ...previousIntake,
    fullName: previousIntake.fullName || name,
    email: previousIntake.email || email,
    targetJobTitle: explicitTarget ? targetRole : previousIntake.targetJobTitle || targetRole,
    roleFamily,
    currentTitle: previousIntake.currentTitle || (independentRole || independentCategory ? formatIndependentTitle(role.title, previousIntake.independentWorkType || "Independent") : role.title),
    currentCompany: previousIntake.currentCompany || role.company,
    currentTime: previousIntake.currentTime || role.dates,
    tools: unique([previousIntake.tools, ...tools]).join(", "),
    selectedAiWorkflows: unique([...previousIntake.selectedAiWorkflows, ...aiWorkflows]).slice(0, 8),
    independentWorkType: previousIntake.independentWorkType || (independentCategory ? "Independent" : ""),
    selectedIndependentWorkSignals: unique([
      ...previousIntake.selectedIndependentWorkSignals,
      ...(independentCategory ? independentWorkArsenals[independentCategory].skills.slice(0, 4) : [])
    ]),
    responsibilities: unique([previousIntake.responsibilities, ...responsibilities]).join(", "),
    selectedResponsibilities: unique([...previousIntake.selectedResponsibilities, ...responsibilities]).slice(0, 10),
    selectedActions: unique([...previousIntake.selectedActions, ...responsibilities.slice(0, 4).map((item) => item.toLowerCase())]).slice(0, 6),
    customersServed: previousIntake.customersServed || metricForPattern(scope, /customer|client|user|people/i),
    ticketsHandled: previousIntake.ticketsHandled || metricForPattern(scope, /ticket|case|issue|request/i),
    projectsSupported: previousIntake.projectsSupported || metricForPattern(scope, /project|launch|implementation/i),
    teamSizeSupported: previousIntake.teamSizeSupported || metricForPattern(scope, /team|people|members|staff/i),
    callsHandled: previousIntake.callsHandled || metricForPattern(scope, /call/i),
    revenueInfluenced: previousIntake.revenueInfluenced || metricForPattern(scope, /\$|revenue|budget|money|dollars|cash|wager/i),
    reportsCreated: previousIntake.reportsCreated || metricForPattern(scope, /report|document|dashboard/i),
    selectedOutcomes: unique([...previousIntake.selectedOutcomes, ...selectedOutcomes]).slice(0, 4),
    outcomes: unique([previousIntake.outcomes, ...transferableSignals]).join(", "),
    customRoleNotes: unique([previousIntake.customRoleNotes, roleSummary, ...scope, ...transferableSignals]).join(", ")
  };
  const checklist = buildInfoChecklist(story, intake, role, extracted);
  const missingCriticalDetails = [
    targetRole ? "" : "target role",
    checklist.stillHelpfulFields.includes("Contact") ? "contact" : "",
    role.title && role.company ? "" : "recent role",
    tools.length ? "" : "tools",
    responsibilities.length ? "" : "responsibilities",
    scope.length ? "" : "scope",
    transferableSignals.length || intake.selectedOutcomes.length ? "" : "outcomes",
    checklist.stillHelpfulFields.includes("Education") ? "education" : ""
  ].filter(Boolean);
  const confidence: StoryDossier["confidence"] =
    missingCriticalDetails.length > 1 ? "needs_follow_up" : scope.length || transferableSignals.length >= 3 ? "strong" : "usable";

  return {
    intake,
    confidence,
    capturedFields: checklist.capturedFields,
    stillHelpfulFields: checklist.stillHelpfulFields,
    extracted: {
      role: role.title,
      company: role.company,
      dates: role.dates,
      targetRole,
      roleFamily,
      responsibilities,
      tools,
      scope,
      transferableSignals
    },
    missingCriticalDetails,
    nextMissingField: missingCriticalDetails[0] ?? "",
    focusedFollowUp: focusedFollowUp(missingCriticalDetails)
  };
}
