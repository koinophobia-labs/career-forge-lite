import {
  allToolOptions,
  careerTargets,
  findJobArsenal,
  initialIntake,
  roleIntelligence
} from "@/lib/career-data";
import { extractEducationEntries, formatEducationEntries, hasEducationEvidence } from "@/lib/education-intelligence";
import {
  findIndependentWorkRole,
  formatIndependentTitle,
  independentWorkArsenals,
  independentWorkRoles,
  inferIndependentWorkCategory,
  inferIndependentWorkRoleTitle
} from "@/lib/independent-work-intelligence";
import { dedupeNearIdentical, isGroundedClaim } from "@/lib/generator";
import { getMissingSignals, getNextUsefulPrompt, hasEnoughResumeSignal } from "@/lib/interview-state";
import { isUncertaintyStatement } from "@/lib/truth-guards";
import { aiWorkflowOptions, normalizeAiWorkflow, selectedAiTools } from "@/lib/modern-work-intelligence";
import { parseRoleAnswer } from "@/lib/natural-role-parser";
import { inferTransferTarget } from "@/lib/transferable-targets";
import type { IntakeData, RoleFamily } from "@/types/career";

export type StoryDossier = {
  intake: IntakeData;
  confidence: "needs_follow_up" | "usable" | "strong";
  capturedFields: string[];
  detectedRoles: string[];
  needsRolePriority: boolean;
  stillHelpfulFields: string[];
  extracted: {
    role: string;
    company: string;
    dates: string;
    targetRole: string;
    roleFamily: RoleFamily;
    responsibilities: string[];
    tools: string[];
    aiWorkflows: string[];
    scope: string[];
    transferableSignals: string[];
    education: string;
  };
  missingCriticalDetails: string[];
  nextMissingField: string;
  focusedFollowUp: string;
};

const roleFamilyKeywords: Array<[RoleFamily, RegExp]> = [
  ["IT Support", /help desk|it support|desktop|service desk|technical support|troubleshoot|password|active directory/i],
  ["Tech", /founder|product|technical operations|implementation|data associate|software|web|developer|qa|tester/i],
  ["Customer Success", /customer success|client success|customer support|customer service|client support|account support|support specialist|onboarding|retention|member service|experience|sportsbook|ticket writer/i],
  ["Project Coordination", /project|program|timeline|milestone|implementation|pmo|status update/i],
  ["Admin", /admin|assistant|office|front desk|reception|calendar|scheduling|records/i],
  ["Sales", /\bsales\b|business development|lead|prospect|pipeline|outreach|account representative/i],
  ["Healthcare", /healthcare|medical|patient|caregiver|home health|home health aide|care aide|cna|nursing assistant|resident care/i],
  ["Operations", /operations|logistics|warehouse|inventory|fulfillment|process|workflow|scheduling|supervisor/i],
  ["Operations", /delivery|driver|courier|construction|labor|janitor|maintenance|cleaning|stock|cashier|restaurant|food service|barista|kitchen|trainer|coach/i],
  ["Customer Success", /barber|stylist|beauty|client|appointment/i],
  ["Business", /business analyst|reporting|analysis|data|stakeholder|research|process analyst/i],
  ["Security", /security|safety|access control|incident|surveillance|patrol/i]
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
  "appointment management",
  "cleaning",
  "delivery",
  "equipment operation",
  "food preparation",
  "load handling",
  "order accuracy",
  "order preparation",
  "patient care",
  "route planning",
  "safe work areas",
  "safety procedures",
  "sanitation",
  "shift procedures",
  "stocking",
  "work area upkeep",
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
  "order accuracy",
  "patient care",
  "policy enforcement",
  "reliability",
  "response consistency",
  "safety awareness",
  "sanitation",
  "speed",
  "team coordination",
  "time management"
];

const blueCollarTools = [
  "Barcode Scanner",
  "Box Cutter",
  "Cleaning Supplies",
  "Delivery App",
  "Dolly",
  "Forklift",
  "Hand Tools",
  "Kitchen Equipment",
  "Ladder",
  "Mop",
  "Pallet Jack",
  "PPE",
  "POS System",
  "Power Tools",
  "Register",
  "Route App",
  "Sanitation Supplies",
  "Safety Equipment",
  "Scheduling App",
  "Scanner",
  "Vehicle"
];

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
  return unique(value.split(/,|;|\band\b|\bwith\b|\busing\b/i).map(clean))
    .filter((item) => !/^(?:supervisors?|coworkers?|team members?|front|the register|register)$/i.test(item))
    .filter((item) => !/^(?:i\s+)?(?:used|helped|worked|coordinated|talked|messaged|called|answered)\b/i.test(item));
}

function detectRoleMentions(story: string) {
  return unique(
    splitSentences(story)
      .filter((sentence) => !isContactIntro(sentence) && hasRoleEvidence(sentence))
      .map((sentence) => parseRoleAnswer(sentence))
      .map((role) => [role.title, role.company, role.dates].filter(Boolean).join(" at ").replace(" at at ", " at "))
      .filter(Boolean)
  ).slice(0, 5);
}

function isContactIntro(sentence: string) {
  return /\bmy name is\b/i.test(sentence) || /\b(?:email|e-mail)\s+is\b/i.test(sentence);
}

function hasRoleEvidence(sentence: string) {
  return /\b(?:worked|work|was|am|served|interned|volunteered|founded|led)\b/i.test(sentence);
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

function targetClause(story: string) {
  return story.match(/\b(?:targeting|applying for|applying to|aiming for|want to be|want|looking for|moving into|move into|transitioning into|want to move into)\s+(?:a|an)?\s*([^.;]+)/i)?.[1] ?? "";
}

function normalizeTargetClause(value: string) {
  return clean(value)
    .replace(/\b(?:roles?|jobs?|positions?)\b.*$/i, "")
    .split(/\s+or\s+|\s+and\s+/i)[0]
    .trim();
}

function inferTargetRole(story: string, roleTitle: string, roleFamily: RoleFamily) {
  const rawTarget = targetClause(story);
  const transferTarget = rawTarget ? inferTransferTarget(rawTarget) : null;
  if (transferTarget) return transferTarget.title;

  const targetMatch = normalizeTargetClause(rawTarget);
  if (targetMatch) return inferTransferTarget(targetMatch)?.title ?? titleCase(targetMatch);

  const knownRole = normalizeKnownRole(roleTitle);
  if (knownRole.family && knownRole.family !== "Security") return knownRole.title;

  const fallbackByFamily: Record<RoleFamily, string> = {
    Admin: "Administrative Assistant",
    Business: "Business Operations Associate",
    "Customer Success": "Customer Success Associate",
    Healthcare: "Patient Services Representative",
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
  return Boolean(targetClause(story));
}

function extractEmail(story: string) {
  return story.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? "";
}

function extractName(story: string) {
  return titleCase(story.match(/\bmy name is\s+([A-Za-z][A-Za-z' -]{1,48}?)(?:\.|,|\s+and\b|$)/i)?.[1] ?? "");
}

function extractRole(story: string) {
  const sentences = splitSentences(story).filter((sentence) => !isContactIntro(sentence));
  const roleSentences = sentences.filter(hasRoleEvidence);
  const parsed = (roleSentences.length ? roleSentences : sentences)
    .map((sentence) => parseRoleAnswer(sentence))
    .find((role) => role.title || role.company || role.dates) ?? parseRoleAnswer(story);
  const normalized = parsed.title ? normalizeKnownRole(parsed.title) : { title: "", family: undefined };
  const independentRole = independentWorkRoles.find((role) => new RegExp(`\\b${role.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(story));
  const independentCategory = inferIndependentWorkCategory(story);
  const inferredIndependentTitle = inferIndependentWorkRoleTitle(story);
  const parsedLooksLikeSentence = parsed.title.split(/\s+/).length > 8 && !parsed.company && !parsed.dates;

  return {
    title: independentRole?.title || inferredIndependentTitle || (parsedLooksLikeSentence && independentCategory ? "Independent Work" : "") || normalized.title || parsed.title || (independentCategory ? "Independent Work" : ""),
    company: parsed.company,
    dates: parsed.dates,
    family: normalized.family ?? independentRole?.roleFamily
  };
}

function extractTools(story: string) {
  const knownTools = allToolOptions
    .filter((tool) => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(story))
    .filter((tool) => !(tool.toLowerCase() === "front" && /front area|front counter|front of/i.test(story)));
  const knownWorkTools = blueCollarTools.filter((tool) => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i").test(story));
  const inferredTools = [
    /\b(?:delivery|route|orders?|doordash|instacart|uber|lyft)\b.*\bapp\b|\bapp\b.*\b(?:delivery|route|orders?|doordash|instacart|uber|lyft)\b|\bdoordash\b|\binstacart\b/i.test(story) ? "Delivery App" : "",
    /\bcar\b|\bvehicle\b|\bdriving\b|\bdrove\b/i.test(story) ? "Vehicle" : ""
  ];
  const toolClause = story.match(/\b(?:used|tools? like|worked with|systems? like|platforms? like|equipment like|equipment included|operated)\s+([^.;]+)/i)?.[1] ?? "";
  return dedupeNearIdentical(unique([...knownTools, ...knownWorkTools, ...inferredTools, ...splitSignals(toolClause).filter((item) => item.length <= 32).map(titleCase)])).slice(0, 12);
}

function extractAiWorkflows(story: string, tools: string[]) {
  if (!selectedAiTools(tools.join(", ")).length) return [];
  const lower = story.toLowerCase();
  return aiWorkflowOptions
    .filter((workflow) => lower.includes(workflow.toLowerCase()))
    .map(normalizeAiWorkflow)
    .slice(0, 8);
}

function isNegatedSignal(story: string, value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:not|no|without|never)\\s+(?:a\\s+|any\\s+)?${escaped}\\b`, "i").test(story);
}

function extractResponsibilities(story: string, roleFamily: RoleFamily) {
  const lower = story.toLowerCase();
  const keywordMatches = responsibilityKeywords.filter((item) => lower.includes(item) && !isNegatedSignal(story, item)).map(titleCase);
  const handledClause = story.match(/\b(?:assisted|answered|cared for|checked|cleaned|coached|cut|delivered|documented|drove|fixed|followed|handled|loaded|maintained|managed|mopped|operated|organized|packed|picked|planned|prepared|processed|repaired|resolved|sanitized|scheduled|shipped|stocked|styled|supported|swept|tested|tracked|trained|unloaded|updated|wrote)\s+([^.;]+)/i)?.[1] ?? "";
  const clauseMatches = splitSignals(handledClause).map(titleCase);
  const actionMatches = Array.from(
    story.matchAll(/\b(assisted|answered|cared for|checked|cleaned|coached|cut|delivered|documented|drove|fixed|followed|handled|loaded|maintained|managed|mopped|operated|organized|packed|picked|planned|prepared|processed|repaired|resolved|sanitized|scheduled|shipped|stocked|styled|supported|swept|tested|tracked|trained|unloaded|updated|wrote)\s+([^,.;]+)/gi)
  ).map(([, action, object]) => titleCase(`${action} ${object}`));
  const familyMatches = roleIntelligence[roleFamily].responsibilities.filter((item) => lower.includes(item.toLowerCase()));
  const independentCategory = inferIndependentWorkCategory(story);
  const independentMatches = independentCategory ? independentWorkArsenals[independentCategory].responsibilities.filter((item) => lower.includes(item.toLowerCase()) || lower.includes(item.split(" ")[0].toLowerCase())) : [];
  return dedupeNearIdentical(unique([...familyMatches, ...keywordMatches, ...actionMatches, ...clauseMatches, ...independentMatches])).slice(0, 10);
}

function extractScope(story: string) {
  // Clause-based extraction keeps decimals and units intact ($3.2M ARR stays
  // whole) and stops a number's context from swallowing the next clause.
  const clauses = story
    .split(/(?:[.;!?](?!\d))|,(?!\d)|\band\b|\n/i)
    .map(clean)
    .filter((clause) => /\d/.test(clause))
    .map((clause) => clause.replace(/^(?:i|we)\s+(?:also\s+)?(?:supported|handled|managed|helped|served|prepared|processed|completed|made|did|had|averaged|delivered|took|answered|tracked|grew|maintained|covered|worked)\s+/i, ""))
    .filter((clause) => !/^(?:19|20)\d{2}(?:\s*(?:-|to)\s*(?:present|now|current|(?:19|20)\d{2}))?$/i.test(clause))
    .filter((clause) => !/\b(?:from|since|in)\s+(?:19|20)\d{2}\b/i.test(clause))
    .filter((clause) =>
      /\$|%|\+|\b(?:customers?|clients?|users?|tickets?|calls?|reports?|projects?|transactions?|wagers?|orders?|accounts?|team|people|cases?|requests?|dollars?|revenue|budget|weekly|monthly|daily|per\s+(?:week|month|day|shift)|hours?|minutes?|days?|weeks?|months?|years?|shifts?|haircuts?|deliveries)\b/i.test(clause)
    );
  return unique(clauses).slice(0, 8);
}

function extractEducation(story: string) {
  return formatEducationEntries(extractEducationEntries(story));
}

function extractTransferableSignals(story: string, roleFamily: RoleFamily) {
  const lower = story.toLowerCase();
  const keywordMatches = transferableKeywords.filter((item) => lower.includes(item) && !isNegatedSignal(story, item)).map(titleCase);
  const inferredProof = [
    /de-?escalat/i.test(story) ? "De-Escalation" : "",
    /\b(?:resolved|solved|troubleshot)\b/i.test(story) ? "Problem Solving" : "",
    /\b(?:documented|wrote|reported|incident reports?|notes?)\b/i.test(story) ? "Documentation" : "",
    /\b(?:on time|showed up|reliable|covered shifts?|never missed|opened|closed)\b/i.test(story) ? "Reliability" : "",
    /\b(?:safe|safety|ppe|osha|sanitation|clean|compliance|procedures?)\b/i.test(story) ? "Safety Awareness" : "",
    /\b(?:customer|client|patient|resident|visitor|guest)\b/i.test(story) ? "Customer Or Client Service" : "",
    /\b(?:fast-paced|rush|time-sensitive|route|deadline|deliver(?:y|ies))\b/i.test(story) && !isNegatedSignal(story, "delivery") ? "Time Management" : "",
    /\b(?:order accuracy|checked order|checked names|checked items|prepared orders?)\b/i.test(story) && !isNegatedSignal(story, "order accuracy") ? "Order Accuracy" : ""
  ];
  const familySkills = roleIntelligence[roleFamily].skills.filter((skill) => lower.includes(skill.toLowerCase()));
  const independentCategory = inferIndependentWorkCategory(story);
  const independentSkills = independentCategory
    ? independentWorkArsenals[independentCategory].skills.filter((skill) => lower.includes(skill.toLowerCase()) || lower.includes(skill.split(" ")[0].toLowerCase()))
    : [];
  return dedupeNearIdentical(unique([...familySkills, ...keywordMatches, ...inferredProof, ...independentSkills])).slice(0, 10);
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
  return Boolean(
    intake.education.trim() ||
      hasEducationEvidence(intake.customRoleNotes) ||
      hasEducationEvidence(story)
  );
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
  // Uncertainty statements ("I don't know my numbers") advance the story but
  // never become extracted evidence.
  const factualStory = splitSentences(story)
    .filter((sentence) => !isUncertaintyStatement(sentence))
    .join(". ");
  const detectedRoles = detectRoleMentions(story);
  const role = extractRole(story);
  const initialRoleFamily = role.family ?? inferRoleFamily(story, role.title);
  const independentCategory = inferIndependentWorkCategory([story, role.title].join(" "));
  const independentRole = findIndependentWorkRole(role.title);
  const explicitTarget = hasExplicitTarget(story);
  const rawTarget = targetClause(story);
  const transferTarget = rawTarget ? inferTransferTarget(rawTarget) : null;
  const founderProductStory =
    /\b(founder|founded|product studio|product lab|websites?|apps?|deployment|github|vercel)\b/i.test(story) &&
    /\b(product operations|product|technical)\b/i.test(rawTarget);
  const targetRole = founderProductStory ? "Product Operations Associate" : inferTargetRole(story, role.title, initialRoleFamily);
  const roleFamily: RoleFamily = founderProductStory ? "Tech" : transferTarget?.roleFamily ?? (explicitTarget ? inferRoleFamily(targetRole, targetRole) : initialRoleFamily);
  const email = extractEmail(story);
  const name = extractName(story);
  const responsibilities = extractResponsibilities(factualStory, roleFamily);
  const tools = extractTools(factualStory);
  const aiWorkflows = extractAiWorkflows(factualStory, tools);
  const scope = extractScope(factualStory);
  const education = extractEducation(story);
  const transferableSignals = extractTransferableSignals(factualStory, roleFamily);
  const selectedOutcomes = transferableSignals.filter((item) =>
    /accuracy|satisfaction|efficiency|reliability|compliance|speed|retention|revenue|problem|de-escalation|documentation|safety|sanitation|time management|patient care/i.test(item)
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
    // Arsenal skills are template taxonomy: only entries grounded in the
    // user's own story may seed the dossier.
    selectedIndependentWorkSignals: unique([
      ...previousIntake.selectedIndependentWorkSignals,
      ...(independentCategory
        ? independentWorkArsenals[independentCategory].skills.filter((skill) => isGroundedClaim(skill, story.toLowerCase())).slice(0, 4)
        : [])
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
    outcomes: unique([previousIntake.outcomes, ...selectedOutcomes]).join(", "),
    education: previousIntake.education || education,
    customRoleNotes: unique([previousIntake.customRoleNotes, roleSummary, education, ...scope, ...transferableSignals]).join(", ")
  };
  const checklist = buildInfoChecklist(story, intake, role, extracted);
  const needsRolePriority = detectedRoles.length > 2 && !hasExplicitTarget(story);
  const nextUsefulPrompt = getNextUsefulPrompt(intake);
  const missingSignals = hasEnoughResumeSignal(intake) && !needsRolePriority
    ? []
    : getMissingSignals(intake).filter((signal) => signal.key !== "education");
  const missingCriticalDetails = needsRolePriority ? ["Priority role"] : missingSignals.map((signal) => signal.label);
  const confidence: StoryDossier["confidence"] =
    needsRolePriority || missingCriticalDetails.length > 1 ? "needs_follow_up" : hasEnoughResumeSignal(intake) || scope.length || transferableSignals.length >= 3 ? "strong" : "usable";

  return {
    intake,
    confidence,
    capturedFields: checklist.capturedFields,
    detectedRoles,
    needsRolePriority,
    stillHelpfulFields: checklist.stillHelpfulFields,
    extracted: {
      role: role.title,
      company: role.company,
      dates: role.dates,
      targetRole,
      roleFamily,
      responsibilities,
      tools,
      aiWorkflows,
      scope,
      transferableSignals,
      education
    },
    missingCriticalDetails,
    nextMissingField: needsRolePriority ? "Priority role" : nextUsefulPrompt.key === "ready" ? "" : nextUsefulPrompt.label,
    focusedFollowUp: needsRolePriority
      ? `I found several roles: ${detectedRoles.join("; ")}. Which one should this resume prioritize?`
      : nextUsefulPrompt.prompt || focusedFollowUp(missingCriticalDetails)
  };
}
