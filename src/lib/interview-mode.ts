import { allToolOptions, initialIntake } from "@/lib/career-data";
import { generateResumePackage } from "@/lib/generator";
import type { IntakeData, ResumePackage, RoleFamily } from "@/types/career";
import type {
  AssistantIntent,
  ConversationMemory,
  InterviewFieldStatus,
  InterviewMessage,
  InterviewResumeDraft,
  InterviewSession,
  InterviewStage,
  InterviewStageId
} from "@/types/interview";

export const interviewStages: InterviewStage[] = [
  {
    id: "role_targeting",
    label: "Role Targeting",
    goal: "Understand the target job, lane, and direction.",
    requiredFields: ["targetRole", "targetIndustry"],
    exampleAssistantQuestion: "What kind of role are you targeting, and what industry is it in?",
    completionCriteria: "Target role is usable and role context is at least weak."
  },
  {
    id: "background_overview",
    label: "Background Overview",
    goal: "Capture the candidate's broad work history and level.",
    requiredFields: ["experienceLevel", "roles"],
    exampleAssistantQuestion: "Give me the quick version of your work background so far.",
    completionCriteria: "Experience level or role background is usable."
  },
  {
    id: "current_or_recent_role",
    label: "Current Or Recent Role",
    goal: "Capture current or most recent title, company, time in role, and context.",
    requiredFields: ["roles"],
    exampleAssistantQuestion: "What is your current or most recent role, where did you do it, and when?",
    completionCriteria: "At least one role has a usable title plus company or timing context."
  },
  {
    id: "responsibilities",
    label: "Responsibilities",
    goal: "Extract confirmed work responsibilities.",
    requiredFields: ["responsibilities"],
    exampleAssistantQuestion: "What did you actually do day to day in that role?",
    completionCriteria: "At least two specific responsibilities are captured."
  },
  {
    id: "achievements",
    label: "Achievements",
    goal: "Find outcomes, wins, or useful work improvements.",
    requiredFields: ["achievements"],
    exampleAssistantQuestion: "What improved because of your work, even in a small way?",
    completionCriteria: "At least one result, improvement, or project proof is captured."
  },
  {
    id: "metrics",
    label: "Metrics",
    goal: "Collect scope numbers and estimates.",
    requiredFields: ["metrics"],
    exampleAssistantQuestion: "Can you give me one measurable result, even approximate?",
    completionCriteria: "Metrics are captured or the user has provided a best-effort answer."
  },
  {
    id: "tools_and_skills",
    label: "Tools And Skills",
    goal: "Capture tools, platforms, systems, and transferable skills.",
    requiredFields: ["tools", "skills"],
    exampleAssistantQuestion: "What tools, platforms, systems, or skills did you use regularly?",
    completionCriteria: "Tools or skills are usable."
  },
  {
    id: "projects_or_portfolio",
    label: "Projects Or Portfolio",
    goal: "Capture optional projects, links, or portfolio proof.",
    requiredFields: ["projects"],
    exampleAssistantQuestion: "What project best proves you can do this job?",
    completionCriteria: "Optional stage is complete when answered or skipped."
  },
  {
    id: "education_and_certifications",
    label: "Education And Certifications",
    goal: "Capture education, certificates, training, or courses.",
    requiredFields: ["education", "certifications"],
    exampleAssistantQuestion: "What education, certifications, training, or courses should appear?",
    completionCriteria: "Education/certification is captured or skipped."
  },
  {
    id: "gaps_and_positioning",
    label: "Gaps And Positioning",
    goal: "Identify weak areas and positioning concerns.",
    requiredFields: ["gapsOrWeakAreas"],
    exampleAssistantQuestion: "What part of your background might look weak to a recruiter?",
    completionCriteria: "Positioning notes are captured or skipped."
  },
  {
    id: "final_resume_review",
    label: "Final Resume Review",
    goal: "Confirm readiness before generating resume input.",
    requiredFields: ["targetRole", "roles", "responsibilities", "tools", "skills", "achievements", "projects"],
    exampleAssistantQuestion: "Reviewing what we have: what is missing or inaccurate before I generate the resume package?",
    completionCriteria: "Minimum resume fields are usable."
  }
];

const requiredStatusFields: Array<{ key: keyof InterviewResumeDraft; label: string }> = [
  { key: "targetRole", label: "Target role" },
  { key: "targetIndustry", label: "Target industry" },
  { key: "experienceLevel", label: "Experience level" },
  { key: "roles", label: "Work history" },
  { key: "responsibilities", label: "Responsibilities" },
  { key: "achievements", label: "Achievements" },
  { key: "metrics", label: "Scope or metrics" },
  { key: "tools", label: "Tools" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "Projects" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Certifications" },
  { key: "gapsOrWeakAreas", label: "Positioning notes" }
];

const roleFamilyKeywords: Array<[RoleFamily, RegExp]> = [
  ["IT Support", /help desk|it support|desktop|service desk|technical support|troubleshoot|password|active directory/i],
  ["Project Coordination", /project|program|timeline|milestone|implementation|pmo|status update/i],
  ["Admin", /admin|assistant|office|front desk|reception|calendar|scheduling|records/i],
  ["Sales", /sales|business development|lead|prospect|pipeline|outreach|account representative/i],
  ["Operations", /operations|logistics|warehouse|inventory|fulfillment|process|workflow|scheduling/i],
  ["Business", /business analyst|reporting|analysis|data|stakeholder|research|process analyst/i],
  ["Security", /security|safety|access control|incident|surveillance|patrol/i],
  ["Tech", /qa|tester|product|technical operations|implementation|data associate|software|web/i],
  ["Customer Success", /customer|client|support|success|onboarding|retention|member service|experience/i]
];

const actionVerbPattern =
  /\b(improved|built|led|created|reduced|increased|launched|managed|automated|coordinated|supported|handled|resolved|documented|tracked|prepared|maintained|analyzed|trained|implemented|processed|escalated)\b/i;
const achievementVerbPattern = /\b(improved|built|led|created|reduced|increased|launched|automated|implemented|trained|won|saved|grew|delivered)\b/i;
const responsibilityPattern =
  /\b(responsible for|handled|managed|supported|coordinated|worked on|owned|helped with|processed|maintained|tracked|documented|resolved|prepared|scheduled|communicated|escalated)\b/i;
const educationPattern = /\b(degree|certification|certificate|bootcamp|course|university|college|school|training|license|diploma|bachelor'?s?|master'?s?)\b/i;
const gapPattern = /\b(i don'?t have|i lack|not much experience|still learning|gap|career change|limited direct|no direct|new to)\b/i;
const skipPattern = /\b(skip|none|n\/a|not applicable|no projects|nothing to add|no education|no cert|no gap)\b/i;
const weakAnswerPattern = /^(ok|yes|no|none|n\/a|test|asdf|idk|not sure|maybe|.)$/i;
const metricPattern =
  /\b(?:\$?\d[\d,.]*\+?(?:%|k|m| hours?| minutes?| days?| weeks?| months?| years?)?\s*(?:customers|clients|users|tickets|calls|reports|projects|transactions|orders|accounts|team members|people|cases|requests|dollars|revenue|budget|weekly|monthly|daily|per week|per month|per day)?|\$\d[\d,.]*\+?|\d+%\+?)\b(?:[^,.]*)/gi;

const skillKeywords = [
  "customer communication",
  "client communication",
  "documentation",
  "record keeping",
  "issue escalation",
  "conflict resolution",
  "scheduling",
  "reporting",
  "data entry",
  "process improvement",
  "quality control",
  "team coordination",
  "stakeholder communication",
  "troubleshooting",
  "cash handling",
  "payment processing",
  "compliance",
  "policy enforcement",
  "inventory tracking",
  "training",
  "follow-up",
  "time management"
];

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraft(): InterviewResumeDraft {
  return {
    targetRole: "",
    targetIndustry: "",
    experienceLevel: "",
    roles: [],
    responsibilities: [],
    achievements: [],
    tools: [],
    skills: [],
    metrics: [],
    education: "",
    certifications: [],
    projects: [],
    gapsOrWeakAreas: [],
    confidenceScore: 0
  };
}

function emptyMemory(): ConversationMemory {
  return {
    discoveredFacts: [],
    acknowledgedFacts: [],
    discussedTopics: [],
    completedTopics: [],
    unansweredTopics: ["target role", "recent role", "responsibilities", "results", "tools", "metrics"],
    followUpHistory: [],
    repeatedQuestionProtection: [],
    lastAssistantIntent: "",
    lastUserIntent: "",
    conversationScore: 0
  };
}

function cleanItem(item: string) {
  return item
    .replace(/^(i|we)\s+(used|use|worked with|work with|handled|managed|supported|coordinated|created|built|led|was responsible for)\s+/i, "")
    .replace(/^(and|also|plus|including)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.]+$/g, "")
    .trim();
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items
    .map(cleanItem)
    .filter((item) => item.length > 1 && !weakAnswerPattern.test(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function titleCase(value: string) {
  const acronyms = new Set(["ai", "api", "ats", "crm", "css", "html", "it", "kpi", "pos", "qa", "sql", "ui", "ux"]);
  return value
    .split(" ")
    .map((part) => {
      const clean = part.toLowerCase();
      if (acronyms.has(clean)) return clean.toUpperCase();
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .join(" ");
}

function splitSignals(value: string) {
  return unique(
    value
      .split(/,|;|\n|•|\band\b/i)
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
  );
}

function splitSentences(value: string) {
  return unique(value.split(/(?<=[.!?])\s+|\n+/).filter((item) => item.trim().length > 2));
}

function hasSpecificSignal(value: string) {
  return /\d|\$|%|\b(Salesforce|HubSpot|Zendesk|Intercom|ServiceNow|Jira|Asana|Trello|Slack|Excel|Google Sheets|Active Directory|SQL|Python|Tableau|Power BI)\b/i.test(
    value
  );
}

function valuesForField(draft: InterviewResumeDraft, key: keyof InterviewResumeDraft) {
  const raw = draft[key];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "string" ? item : [item.title, item.company, item.timeInRole, ...item.notes].join(" "))).filter(Boolean);
  }
  return raw ? [String(raw)] : [];
}

function scoreField(key: keyof InterviewResumeDraft, values: string[], draft: InterviewResumeDraft): InterviewFieldStatus["status"] {
  const joined = values.join(" ").trim();
  if (!values.length || !joined) return "empty";
  if (values.every((value) => weakAnswerPattern.test(value))) return "weak";

  const specificity = values.filter(hasSpecificSignal).length;
  const hasAction = actionVerbPattern.test(joined) || responsibilityPattern.test(joined);
  const hasMetric = /\d|\$|%/.test(joined);
  const hasMultiple = values.length >= 2;

  if (key === "targetRole") {
    if (joined.length < 4) return "weak";
    return /\b(associate|assistant|coordinator|specialist|analyst|technician|representative|support|success|operations|admin|sales|project|developer|tester)\b/i.test(joined)
      ? "strong"
      : "usable";
  }

  if (key === "roles") {
    const role = draft.roles[0];
    if (!role?.title) return "empty";
    if (role.title.length < 4) return "weak";
    if (role.company || role.timeInRole || role.notes.join(" ").length > 60) return "strong";
    return "usable";
  }

  if (key === "responsibilities") {
    if (values.length >= 3 && hasAction) return "strong";
    if (values.length >= 2 || joined.length > 45) return "usable";
    return "weak";
  }

  if (key === "achievements" || key === "projects") {
    if (hasMetric || (hasAction && joined.length > 45) || values.length >= 2) return "strong";
    return joined.length > 18 ? "usable" : "weak";
  }

  if (key === "metrics") {
    if (values.length >= 2 || /\$|%|\d+\+/.test(joined)) return "strong";
    return /\d/.test(joined) ? "usable" : "weak";
  }

  if (key === "tools") {
    if (values.length >= 3 || specificity >= 2) return "strong";
    return values.length >= 1 ? "usable" : "empty";
  }

  if (key === "skills") {
    if (values.length >= 4) return "strong";
    if (values.length >= 2 || joined.length > 35) return "usable";
    return "weak";
  }

  if (key === "targetIndustry" || key === "experienceLevel" || key === "education") {
    if (joined.length < 4) return "weak";
    return joined.length > 35 || hasSpecificSignal(joined) ? "strong" : "usable";
  }

  if (key === "certifications" || key === "gapsOrWeakAreas") {
    if (hasMultiple || joined.length > 40) return "strong";
    return joined.length > 4 ? "usable" : "weak";
  }

  return scoreGeneric(values);
}

function scoreGeneric(values: string[]): InterviewFieldStatus["status"] {
  const totalLength = values.join(" ").length;
  if (!values.length) return "empty";
  if (values.length >= 3 || totalLength > 80) return "strong";
  if (values.length >= 1 || totalLength > 30) return "usable";
  return "weak";
}

function statusForField(draft: InterviewResumeDraft, key: keyof InterviewResumeDraft, label: string, messages: InterviewMessage[]): InterviewFieldStatus {
  const values = valuesForField(draft, key);
  const evidenceFromMessages = messages
    .filter((message) => message.role === "user")
    .slice(-5)
    .map((message) => message.id);
  const status = scoreField(key, values, draft);

  return {
    fieldKey: key,
    label,
    status,
    evidenceFromMessages: values.length ? evidenceFromMessages : [],
    notes: status === "empty" ? `${label} still needs an answer.` : `${label} has ${status} interview signal.`
  };
}

function calculateConfidence(statuses: InterviewFieldStatus[]) {
  const weights = { empty: 0, weak: 0.25, usable: 0.72, strong: 1 };
  const core = statuses.filter((status) => ["targetRole", "roles", "responsibilities", "achievements", "projects", "tools", "skills"].includes(String(status.fieldKey)));
  const total = core.reduce((sum, status) => sum + weights[status.status], 0);
  return Math.round((total / Math.max(core.length, 1)) * 100);
}

export function getCurrentFieldStatuses(session: InterviewSession): InterviewFieldStatus[] {
  return requiredStatusFields.map((field) => statusForField(session.resumeDraft, field.key, field.label, session.messages));
}

function withStatuses(session: InterviewSession): InterviewSession {
  const fieldStatuses = getCurrentFieldStatuses(session);
  return {
    ...session,
    fieldStatuses,
    resumeDraft: {
      ...session.resumeDraft,
      confidenceScore: calculateConfidence(fieldStatuses)
    },
    updatedAt: now()
  };
}

export function createInitialInterviewSession(): InterviewSession {
  const createdAt = now();
  const initialMessage: InterviewMessage = {
    id: makeId("msg"),
    role: "assistant",
    content:
      "Welcome. We will build this like a career-coach conversation, not a form.\n\nWhat kind of role are you targeting, and what industry is it in?",
    createdAt
  };

  return withStatuses({
    id: makeId("interview"),
    messages: [initialMessage],
    resumeDraft: emptyDraft(),
    memory: {
      ...emptyMemory(),
      followUpHistory: [
        {
          intent: "clarify",
          question: "What kind of role are you targeting, and what industry is it in?",
          stage: "role_targeting",
          createdAt
        }
      ],
      repeatedQuestionProtection: ["what kind of role are you targeting and what industry is it in"],
      lastAssistantIntent: "clarify"
    },
    fieldStatuses: [],
    currentStage: "role_targeting",
    completedStages: [],
    createdAt,
    updatedAt: createdAt
  });
}

function inferRoleFamily(text: string): RoleFamily {
  return roleFamilyKeywords.find(([, pattern]) => pattern.test(text))?.[0] ?? "Customer Success";
}

function extractTarget(answer: string) {
  const cleaned = answer
    .replace(/^(i want to be|i'?m aiming for|aiming for|targeting|looking for|my target is|target role is)\s+/i, "")
    .trim();
  const industryMatch = cleaned.match(/\b(?:in|within|for)\s+([A-Za-z /&-]{3,48})$/i);
  const rolePart = industryMatch ? cleaned.slice(0, industryMatch.index).trim() : cleaned;
  const experienceMatch = answer.match(/\b(entry[- ]level|early[- ]career|associate[- ]level|junior|mid[- ]level|senior|career changer)\b/i);

  return {
    targetRole: cleanItem(rolePart.replace(/[,.]$/g, "")),
    targetIndustry: industryMatch?.[1]?.trim() ?? "",
    experienceLevel: experienceMatch?.[1] ? titleCase(experienceMatch[1].replace("-", " ")) : ""
  };
}

function extractRole(answer: string) {
  const explicitRoleMatch = answer.match(
    /\b(?:worked as|work as|served as|currently work as|current role is|most recent role is|role is|title is|i am|i'm|was)\s+(?:an?\s+)?(.+?)\s+at\s+(.+?)(?:\s+(?:from|since|for)\s+(.+?))?(?:,|\.|$)/i
  );
  if (explicitRoleMatch) {
    return {
      title: explicitRoleMatch[1]?.trim() ?? "",
      company: explicitRoleMatch[2]?.trim() ?? "",
      timeInRole: explicitRoleMatch[3]?.trim() ?? "",
      notes: [answer]
    };
  }

  const atMatch = answer.match(
    /(?:as|role is|title is|worked as|i'm|i am|was|currently|most recent role is)\s+(?:an?\s+)?([^,.]+?)(?:\s+at\s+([^,.]+?))?(?:\s+(?:from|since|for)\s+([^,.]+))?(?:,|\.|$)/i
  );
  const companyMatch = answer.match(/\bat\s+([A-Z][A-Za-z0-9&.'’\-\s]{2,54})(?:,|\.| from| since| for|$)/);
  const timeMatch = answer.match(/(?:from|since|for)\s+([^,.]+)/i);
  const title = atMatch?.[1]?.trim() ?? "";

  return {
    title,
    company: atMatch?.[2]?.trim() ?? companyMatch?.[1]?.trim() ?? "",
    timeInRole: atMatch?.[3]?.trim() ?? timeMatch?.[1]?.trim() ?? "",
    notes: [answer]
  };
}

function mergeRole(existing: InterviewResumeDraft["roles"], answer: string) {
  const extracted = extractRole(answer);
  if (!extracted.title && existing.length) {
    return [{ ...existing[0], notes: unique([...existing[0].notes, answer]) }, ...existing.slice(1)];
  }
  if (!extracted.title) return existing;
  return existing.length ? [{ ...existing[0], ...extracted, notes: unique([...existing[0].notes, answer]) }] : [extracted];
}

function extractToolSignals(answer: string) {
  const matchedTools = allToolOptions.filter((tool) => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(answer));
  const toolClause = answer.match(/\b(?:tools? like|used|worked with|platforms? like|systems? like)\s+([^;\n]+)/i)?.[1] ?? "";
  const clauseTools = splitSignals(toolClause).filter((item) => item.length <= 32);
  return unique([...matchedTools, ...clauseTools]).slice(0, 12);
}

function extractMetricSignals(answer: string) {
  return unique(answer.match(metricPattern) ?? [])
    .filter((metric) => {
      const trimmed = metric.trim();
      if (/^(?:19|20)\d{2}(?:\s*-\s*(?:present|(?:19|20)\d{2}))?$/i.test(trimmed)) return false;
      if (/\bfrom\s+(?:19|20)\d{2}\b/i.test(trimmed)) return false;
      if (/\b(?:19|20)\d{2}\s*-\s*(?:present|(?:19|20)\d{2})\b/i.test(trimmed)) return false;
      return /\$|%|\+|customers?|clients?|users?|tickets?|calls?|reports?|projects?|transactions?|orders?|accounts?|team members?|people|cases?|requests?|revenue|budget|weekly|monthly|daily|per week|per month|per day|hours?|minutes?|days?|saved|reduced|increased/i.test(trimmed);
    })
    .slice(0, 10);
}

function extractResponsibilitySignals(answer: string) {
  const sentenceSignals = splitSentences(answer).filter((sentence) => responsibilityPattern.test(sentence));
  const listSignals = responsibilityPattern.test(answer) ? splitSignals(answer.replace(responsibilityPattern, "")) : [];
  return unique([...sentenceSignals, ...listSignals]).slice(0, 12);
}

function extractAchievementSignals(answer: string) {
  return unique(splitSentences(answer).filter((sentence) => achievementVerbPattern.test(sentence))).slice(0, 10);
}

function extractEducationSignals(answer: string) {
  if (!educationPattern.test(answer)) return { education: "", certifications: [] };
  const certifications = splitSignals(answer).filter((item) => /\b(certification|certificate|certified|license|bootcamp|course|training)\b/i.test(item));
  const education = /\b(university|college|school|degree|bachelor'?s?|master'?s?|diploma)\b/i.test(answer) ? answer : "";
  return { education, certifications };
}

function extractSkillSignals(answer: string) {
  const lower = answer.toLowerCase();
  const matched = skillKeywords.filter((skill) => lower.includes(skill));
  const skillClause = answer.match(/\b(?:skills? like|strengths? (?:are|include)|good at)\s+([^.;]+)/i)?.[1] ?? "";
  return unique([...matched.map(titleCase), ...splitSignals(skillClause).map(titleCase)]).slice(0, 12);
}

function extractProjectSignals(answer: string) {
  if (
    !/\b(portfolio|built|created|launched|implemented|case study|website|dashboard|workflow|automation|class project|project for|worked on .*project|managed .*project|supported .*project)\b/i.test(
      answer
    )
  ) {
    return [];
  }
  return unique(splitSentences(answer).length ? splitSentences(answer) : splitSignals(answer)).slice(0, 8);
}

function extractGapSignals(answer: string) {
  if (!gapPattern.test(answer)) return [];
  return unique(splitSentences(answer).length ? splitSentences(answer) : [answer]).slice(0, 6);
}

function applyGeneralExtraction(draft: InterviewResumeDraft, answer: string) {
  const nextDraft = { ...draft };
  const metrics = extractMetricSignals(answer);
  const tools = extractToolSignals(answer);
  const responsibilities = extractResponsibilitySignals(answer);
  const achievements = extractAchievementSignals(answer);
  const skills = extractSkillSignals(answer);
  const projects = extractProjectSignals(answer);
  const gaps = extractGapSignals(answer);
  const education = extractEducationSignals(answer);

  nextDraft.metrics = unique([...nextDraft.metrics, ...metrics]).slice(0, 10);
  nextDraft.tools = unique([...nextDraft.tools, ...tools]).slice(0, 12);
  nextDraft.responsibilities = unique([...nextDraft.responsibilities, ...responsibilities]).slice(0, 12);
  nextDraft.achievements = unique([...nextDraft.achievements, ...achievements]).slice(0, 10);
  nextDraft.skills = unique([...nextDraft.skills, ...skills]).slice(0, 12);
  nextDraft.projects = unique([...nextDraft.projects, ...projects]).slice(0, 8);
  nextDraft.gapsOrWeakAreas = unique([...nextDraft.gapsOrWeakAreas, ...gaps]).slice(0, 6);
  nextDraft.certifications = unique([...nextDraft.certifications, ...education.certifications]).slice(0, 6);
  nextDraft.education = nextDraft.education || education.education;

  return nextDraft;
}

function addMessage(session: InterviewSession, message: InterviewMessage) {
  return { ...session, messages: [...session.messages, message] };
}

function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lastUserAnswer(session: InterviewSession) {
  return [...session.messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function inferUserIntent(answer: string) {
  if (weakAnswerPattern.test(answer) || answer.trim().split(/\s+/).length < 4) return "vague_answer";
  if (extractMetricSignals(answer).length) return "shared_metrics";
  if (extractToolSignals(answer).length) return "shared_tools";
  if (extractAchievementSignals(answer).length) return "shared_results";
  if (/\b(led|supervised|trained|managed a team|mentored)\b/i.test(answer)) return "shared_leadership";
  if (/\b(problem|issue|challenge|resolved|fixed|troubleshot)\b/i.test(answer)) return "shared_problem_solving";
  return "detailed_answer";
}

function factsFromDraft(draft: InterviewResumeDraft) {
  const role = draft.roles[0];
  return unique([
    draft.targetRole ? `Targeting ${draft.targetRole}` : "",
    draft.targetIndustry ? `Interested in ${draft.targetIndustry}` : "",
    role?.title ? `${role.title}${role.company ? ` at ${role.company}` : ""}${role.timeInRole ? ` (${role.timeInRole})` : ""}` : "",
    ...draft.tools.slice(0, 3).map((tool) => `Used ${tool}`),
    ...draft.metrics.slice(0, 2),
    ...draft.achievements.slice(0, 2)
  ]);
}

function topicsFromDraft(draft: InterviewResumeDraft) {
  return unique([
    draft.targetRole ? "target role" : "",
    draft.roles.length ? "recent role" : "",
    draft.responsibilities.length ? "responsibilities" : "",
    draft.tools.length || draft.skills.length ? "tools and skills" : "",
    draft.metrics.length ? "scope and metrics" : "",
    draft.achievements.length ? "results" : "",
    draft.projects.length ? "projects" : "",
    draft.education || draft.certifications.length ? "education and certifications" : ""
  ]);
}

function scoreConversation(answer: string, session: InterviewSession) {
  let score = session.memory.conversationScore;
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const repeated = session.messages.filter((message) => message.role === "user" && message.content.toLowerCase() === answer.toLowerCase()).length > 1;

  if (wordCount >= 8) score += 2;
  if (wordCount >= 18) score += 2;
  if (extractMetricSignals(answer).length) score += 3;
  if (extractToolSignals(answer).length) score += 2;
  if (extractAchievementSignals(answer).length) score += 3;
  if (/\b(led|trained|supervised|mentored|managed a team)\b/i.test(answer)) score += 2;
  if (weakAnswerPattern.test(answer) || wordCount < 4) score -= 2;
  if (repeated) score -= 2;

  return Math.max(0, Math.min(score, 100));
}

function updateConversationMemory(previousSession: InterviewSession, nextSession: InterviewSession, answer: string): ConversationMemory {
  const discoveredFacts = unique([...previousSession.memory.discoveredFacts, ...factsFromDraft(nextSession.resumeDraft)]).slice(0, 16);
  const discussedTopics = unique([...previousSession.memory.discussedTopics, ...topicsFromDraft(nextSession.resumeDraft), previousSession.currentStage.replaceAll("_", " ")]).slice(0, 16);
  const completedTopics = unique([
    ...previousSession.memory.completedTopics,
    ...nextSession.fieldStatuses.filter((field) => field.status === "usable" || field.status === "strong").map((field) => field.label)
  ]).slice(0, 16);
  const unansweredTopics = ["target role", "recent role", "responsibilities", "results", "tools", "metrics", "projects"].filter(
    (topic) => !discussedTopics.includes(topic) && !completedTopics.some((complete) => complete.toLowerCase().includes(topic.split(" ")[0]))
  );

  return {
    ...previousSession.memory,
    discoveredFacts,
    discussedTopics,
    completedTopics,
    unansweredTopics,
    lastUserIntent: inferUserIntent(answer),
    conversationScore: scoreConversation(answer, nextSession)
  };
}

function acknowledgementFor(session: InterviewSession) {
  const answer = lastUserAnswer(session);
  const draft = session.resumeDraft;
  const role = draft.roles[0];

  if (!answer) return "Got it.";
  if (role?.company && role.timeInRole && answer.toLowerCase().includes(role.company.toLowerCase())) {
    return `Great. ${role.timeInRole} at ${role.company} gives us solid recent experience.`;
  }
  if (role?.title && answer.toLowerCase().includes(role.title.toLowerCase())) {
    return `That helps. I will treat ${role.title} as an important part of your background.`;
  }
  if (draft.tools.some((tool) => answer.toLowerCase().includes(tool.toLowerCase()))) {
    return `Nice. Those tools give the resume more concrete proof.`;
  }
  if (extractMetricSignals(answer).length) {
    return `Perfect. Those numbers make the story more credible.`;
  }
  if (extractAchievementSignals(answer).length) {
    return `Excellent. That gives us a result to build around.`;
  }
  if (inferUserIntent(answer) === "vague_answer") {
    return `That is a start. I need one more concrete detail so this does not sound generic.`;
  }
  return `That is helpful. I am adding that to the picture.`;
}

function transitionFor(intent: AssistantIntent, session: InterviewSession) {
  if (intent === "quantify") return "Now I want to understand the scale of the work.";
  if (intent === "discover_tools") return "Now I want to understand the tools behind that work.";
  if (intent === "discover_results") return "Now I know what you did. I am missing how successful it was.";
  if (intent === "discover_project") return "Let's find one example that proves you can do the target role.";
  if (intent === "discover_leadership") return "Let's see if there is leadership or ownership we should surface.";
  if (intent === "discover_problem_solving") return "Let's unpack the problems you were trusted to solve.";
  if (intent === "deepen") return "Let's make that more specific.";
  if (intent === "transition" && canGenerateResumeFromInterview(session)) return "We have enough to draft, but one final check can make it stronger.";
  return "Let's keep building the strongest version of this.";
}

function isStageSatisfied(session: InterviewSession, stageId: InterviewStageId) {
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  const status = (key: keyof InterviewResumeDraft) => statuses.find((field) => field.fieldKey === key)?.status ?? "empty";
  const isUsable = (key: keyof InterviewResumeDraft) => ["usable", "strong"].includes(status(key));
  const answeredCurrentStage = session.completedStages.includes(stageId);

  if (stageId === "role_targeting") return isUsable("targetRole");
  const hasProjectExperienceProof = isUsable("projects") && (isUsable("achievements") || isUsable("responsibilities") || isUsable("education"));
  if (stageId === "background_overview") return isUsable("experienceLevel") || isUsable("roles") || hasProjectExperienceProof;
  if (stageId === "current_or_recent_role") return isUsable("roles") || hasProjectExperienceProof;
  if (stageId === "responsibilities") return isUsable("responsibilities");
  if (stageId === "achievements") return isUsable("achievements") || isUsable("projects");
  if (stageId === "metrics") return isUsable("metrics") || answeredCurrentStage;
  if (stageId === "tools_and_skills") return isUsable("tools") || isUsable("skills");
  if (stageId === "projects_or_portfolio") return isUsable("projects") || answeredCurrentStage;
  if (stageId === "education_and_certifications") return isUsable("education") || isUsable("certifications") || answeredCurrentStage;
  if (stageId === "gaps_and_positioning") return isUsable("gapsOrWeakAreas") || answeredCurrentStage;
  return canGenerateResumeFromInterview(session);
}

export function updateInterviewDraftFromUserAnswer(session: InterviewSession, userMessage: InterviewMessage): InterviewSession {
  const answer = userMessage.content.trim();
  const nextDraft: InterviewResumeDraft = applyGeneralExtraction(session.resumeDraft, answer);

  if (session.currentStage === "role_targeting") {
    const target = extractTarget(answer);
    nextDraft.targetRole = target.targetRole || nextDraft.targetRole;
    nextDraft.targetIndustry = target.targetIndustry || nextDraft.targetIndustry;
    nextDraft.experienceLevel = target.experienceLevel || nextDraft.experienceLevel;
  }

  if (session.currentStage === "background_overview") {
    nextDraft.experienceLevel = nextDraft.experienceLevel || (answer.length > 80 ? "Early-career with multiple work signals" : answer);
    nextDraft.roles = mergeRole(nextDraft.roles, answer);
  }

  if (session.currentStage === "current_or_recent_role") {
    nextDraft.roles = mergeRole(nextDraft.roles, answer);
  }

  if (session.currentStage === "responsibilities" && !nextDraft.responsibilities.length) {
    nextDraft.responsibilities = unique([...nextDraft.responsibilities, ...splitSignals(answer)]).slice(0, 12);
  }

  if (session.currentStage === "achievements" && !nextDraft.achievements.length && !skipPattern.test(answer)) {
    nextDraft.achievements = unique([...nextDraft.achievements, answer]).slice(0, 10);
  }

  if (session.currentStage === "metrics" && !nextDraft.metrics.length) nextDraft.metrics = unique([...nextDraft.metrics, ...extractMetricSignals(answer)]).slice(0, 10);

  if (session.currentStage === "tools_and_skills") {
    const extraSkills = splitSignals(answer).filter((item) => !nextDraft.tools.some((tool) => tool.toLowerCase() === item.toLowerCase()));
    nextDraft.skills = unique([...nextDraft.skills, ...extraSkills.map(titleCase)]).slice(0, 12);
  }

  if (session.currentStage === "projects_or_portfolio" && !skipPattern.test(answer)) {
    nextDraft.projects = unique([...nextDraft.projects, ...extractProjectSignals(answer), answer]).slice(0, 8);
  }

  if (session.currentStage === "education_and_certifications") {
    const education = extractEducationSignals(answer);
    nextDraft.certifications = unique([...nextDraft.certifications, ...education.certifications]).slice(0, 6);
    if (education.education) nextDraft.education = education.education;
  }

  if (session.currentStage === "gaps_and_positioning" && !skipPattern.test(answer)) {
    const gaps = extractGapSignals(answer);
    if (gaps.length) nextDraft.gapsOrWeakAreas = unique([...nextDraft.gapsOrWeakAreas, ...gaps]).slice(0, 6);
  }

  const withUserMessage = addMessage(session, userMessage);
  const completedStages = unique([...session.completedStages, session.currentStage]) as InterviewStageId[];
  const statusSession = withStatuses({ ...withUserMessage, resumeDraft: nextDraft, completedStages });
  const memorySession = {
    ...statusSession,
    memory: updateConversationMemory(session, statusSession, answer)
  };
  const nextStage = getNextInterviewStage(memorySession);

  return withStatuses({
    ...memorySession,
    currentStage: nextStage.id
  });
}

export function getNextInterviewStage(session: InterviewSession): InterviewStage {
  const currentIndex = interviewStages.findIndex((stage) => stage.id === session.currentStage);
  const currentStage = interviewStages[currentIndex] ?? interviewStages[0];

  if (!isStageSatisfied(session, currentStage.id)) return currentStage;

  const nextStage = interviewStages.find((stage, index) => index > currentIndex && !isStageSatisfied(session, stage.id));
  return nextStage ?? interviewStages.at(-1)!;
}

export function getMissingOrWeakFields(session: InterviewSession): InterviewFieldStatus[] {
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  return statuses.filter((field) => field.status === "empty" || field.status === "weak");
}

function fieldStatus(session: InterviewSession, key: keyof InterviewResumeDraft) {
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  return statuses.find((field) => field.fieldKey === key)?.status ?? "empty";
}

function statusByKey(session: InterviewSession) {
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  return new Map(statuses.map((status) => [status.fieldKey, status]));
}

function isReadyField(session: InterviewSession, key: keyof InterviewResumeDraft) {
  return ["usable", "strong"].includes(fieldStatus(session, key));
}

export function canGenerateResumeFromInterview(session: InterviewSession) {
  const hasExperienceProof =
    isReadyField(session, "roles") ||
    fieldStatus(session, "projects") === "strong" ||
    (isReadyField(session, "education") && (isReadyField(session, "skills") || isReadyField(session, "tools")));

  return (
    isReadyField(session, "targetRole") &&
    hasExperienceProof &&
    isReadyField(session, "responsibilities") &&
    (isReadyField(session, "skills") || isReadyField(session, "tools")) &&
    (isReadyField(session, "achievements") || isReadyField(session, "projects"))
  );
}

const stageForField: Partial<Record<keyof InterviewResumeDraft, InterviewStageId>> = {
  targetRole: "role_targeting",
  targetIndustry: "role_targeting",
  experienceLevel: "background_overview",
  roles: "current_or_recent_role",
  responsibilities: "responsibilities",
  achievements: "achievements",
  metrics: "metrics",
  tools: "tools_and_skills",
  skills: "tools_and_skills",
  projects: "projects_or_portfolio",
  education: "education_and_certifications",
  certifications: "education_and_certifications",
  gapsOrWeakAreas: "gaps_and_positioning"
};

export function markInterviewReadyForGeneration(session: InterviewSession): InterviewSession {
  return withStatuses({
    ...session,
    currentStage: canGenerateResumeFromInterview(session) ? "final_resume_review" : getWeakestInterviewStage(session)
  });
}

export function getWeakestInterviewStage(session: InterviewSession): InterviewStageId {
  const priority: Array<keyof InterviewResumeDraft> = ["targetRole", "roles", "responsibilities", "tools", "skills", "achievements", "projects", "metrics"];
  const statuses = statusByKey(session);
  const weakField = priority.find((key) => {
    const status = statuses.get(key)?.status ?? "empty";
    return status === "empty" || status === "weak";
  });
  return weakField ? stageForField[weakField] ?? "role_targeting" : session.currentStage;
}

export function assistantQuestionForStage(stageId: InterviewStageId) {
  return interviewStages.find((stage) => stage.id === stageId)?.exampleAssistantQuestion ?? interviewStages[0].exampleAssistantQuestion;
}

function questionWasAsked(session: InterviewSession, question: string) {
  const normalized = normalizeQuestion(question);
  const topic = questionTopic(question);
  return (
    session.memory.repeatedQuestionProtection.includes(normalized) ||
    session.memory.followUpHistory.some((followUp) => questionTopic(followUp.question) === topic && topic !== "general") ||
    session.messages.some((message) => message.role === "assistant" && normalizeQuestion(message.content).includes(normalized))
  );
}

function avoidRepeat(session: InterviewSession, options: string[]) {
  return options.find((option) => !questionWasAsked(session, option)) ?? options.find((option) => normalizeQuestion(option) !== normalizeQuestion(session.memory.followUpHistory.at(-1)?.question ?? "")) ?? options[0];
}

function questionTopic(question: string) {
  const normalized = normalizeQuestion(question);
  if (/title company|job called|who was it|how long/.test(normalized)) return "recent_role_identity";
  if (/workplace|customer setting|work setting/.test(normalized)) return "work_setting";
  if (/what should i call|resume label|call that experience/.test(normalized)) return "resume_label";
  if (/paid work|school|volunteering|personal project/.test(normalized)) return "proof_type";
  if (/recent role|main recent experience/.test(normalized)) return "recent_role_identity";
  if (/target|job title|role should this resume|role are you targeting/.test(normalized)) return "target_role";
  if (/problems were you solving|problems did you solve|solving most often/.test(normalized)) return "problem_solving";
  if (/requests|workflows|customers|records|schedules|systems|issues/.test(normalized)) return "workflow_scope";
  if (/best prepared|prepared you/.test(normalized)) return "role_bridge";
  if (/responsibilities were you trusted|trusted with|most weeks|every shift|duties/.test(normalized)) return "responsibility_detail";
  if (/responsibil/.test(normalized)) return "responsibilities";
  if (/measurable|volume|how many|scale|customers|tickets|calls|reports/.test(normalized)) return "metrics";
  if (/tools|software|systems|platforms|skills|equipment|workflows/.test(normalized)) return "tools";
  if (/project|portfolio|proof|dashboard|launch/.test(normalized)) return "projects";
  if (/improved|result|win|outcome|changed|speed|accuracy/.test(normalized)) return "results";
  if (/education|certification|training|course|degree/.test(normalized)) return "education";
  return "general";
}

function selectFollowUp(session: InterviewSession): { intent: AssistantIntent; question: string } {
  const weak = getMissingOrWeakFields(session);
  const weakKeys = new Set(weak.map((field) => field.fieldKey));
  const userIntent = session.memory.lastUserIntent;

  if (session.currentStage === "role_targeting") {
    return {
      intent: "clarify",
      question: avoidRepeat(session, [
        "What kind of role are you targeting, and what industry is it in?",
        "Give me the exact job title you want next, plus the lane or industry if you know it.",
        "What role should this resume point toward?"
      ])
    };
  }

  if (session.currentStage === "background_overview") {
    return {
      intent: "deepen",
      question: avoidRepeat(session, [
        "Give me the quick version of your work background so far.",
        "What jobs or environments should this resume translate into stronger career language?",
        "What part of your background best connects to the role you want next?"
      ])
    };
  }

  if (session.currentStage === "current_or_recent_role") {
    return {
      intent: "clarify",
      question: avoidRepeat(session, [
        "Tell me your title, company, and approximate dates for your most recent work.",
        "If the title is hard to name, what kind of workplace or customer setting was it?",
        "What should I call that experience on a resume if we do not have an exact title?",
        "Was this paid work, school, volunteering, or a personal project?",
        "Give me any employer, school, project, or team name connected to that experience.",
        "What context should a recruiter know about where that work happened?"
      ])
    };
  }

  if (session.currentStage === "responsibilities") {
    const weakAnswer = userIntent === "vague_answer";
    return {
      intent: weakAnswer ? "discover_problem_solving" : "deepen",
      question: avoidRepeat(session, [
        weakAnswer
          ? "What kinds of problems were you solving most often?"
          : weakKeys.has("responsibilities")
            ? "What responsibilities were you trusted with most weeks?"
            : "What part of that job best prepared you for the role you are applying for?",
        "What requests, workflows, customers, records, schedules, systems, or issues did you handle?",
        "What responsibilities came with that role every shift?"
      ])
    };
  }

  if (session.currentStage === "achievements") {
    return {
      intent: "discover_results",
      question: avoidRepeat(session, [
        "What changed because of your work?",
        "Can you name one result, win, customer outcome, or process improvement?",
        "Did your work improve speed, accuracy, customer satisfaction, reliability, compliance, or efficiency?"
      ])
    };
  }

  if (session.currentStage === "metrics") {
    return {
      intent: "quantify",
      question: avoidRepeat(session, [
        "Can you give me one measurable result, even approximate?",
        "What volume did you handle: customers, tickets, calls, reports, money, team size, projects, or transactions?",
        "Estimate if needed: how many people, requests, reports, calls, or projects did you support?"
      ])
    };
  }

  if (session.currentStage === "tools_and_skills") {
    return {
      intent: "discover_tools",
      question: avoidRepeat(session, [
        "What software, systems, platforms, equipment, or workflows did you use every day?",
        "List the ticketing tools, spreadsheets, CRMs, communication tools, or internal systems you touched.",
        "What skills should a recruiter see quickly: documentation, troubleshooting, customer communication, reporting, scheduling, or something else?"
      ])
    };
  }

  if (session.currentStage === "projects_or_portfolio") {
    return {
      intent: "discover_project",
      question: avoidRepeat(session, [
        "What project best proves you can do this job?",
        "Any project, portfolio link, workflow, report, dashboard, launch, or improvement worth mentioning?",
        "If there is no project to include, say skip and we will move on."
      ])
    };
  }

  if (session.currentStage === "education_and_certifications") {
    return {
      intent: "clarify",
      question: avoidRepeat(session, [
        "What education, certifications, training, bootcamps, or courses should appear?",
        "Any degree, certificate, license, course, or training that supports this target role?",
        "If there is no education or certification to include right now, say skip."
      ])
    };
  }

  if (session.currentStage === "gaps_and_positioning") {
    return {
      intent: "clarify",
      question: avoidRepeat(session, [
        "What part of your background might look weak to a recruiter?",
        "Anything we should position carefully, like a gap, career change, limited direct experience, or still-learning area?",
        "If nothing needs positioning, say skip and Career Forge will prepare the draft."
      ])
    };
  }

  if (!canGenerateResumeFromInterview(session)) {
    return {
      intent: "clarify",
      question: avoidRepeat(session, [
        "I still need a target role, one role, responsibilities, tools or skills, and one achievement or project. What can you add?",
        "What is the most useful missing detail we should add before generating?"
      ])
    };
  }

  return {
    intent: "transition",
    question: avoidRepeat(session, [
      "Anything missing or inaccurate before generating the package?",
      "Do you want to add one more proof point before I build the resume package?"
    ])
  };
}

export function getNextAssistantQuestion(session: InterviewSession): string {
  const followUp = selectFollowUp(session);
  return `${acknowledgementFor(session)}\n\n${transitionFor(followUp.intent, session)}\n\n${followUp.question}`;
}

export function createNextAssistantInterviewTurn(session: InterviewSession): InterviewSession {
  const followUp = selectFollowUp(session);
  const content = `${acknowledgementFor(session)}\n\n${transitionFor(followUp.intent, session)}\n\n${followUp.question}`;
  const message = createAssistantInterviewMessage(content);
  return {
    ...session,
    messages: [...session.messages, message],
    memory: {
      ...session.memory,
      acknowledgedFacts: unique([...session.memory.acknowledgedFacts, ...factsFromDraft(session.resumeDraft)]).slice(0, 16),
      followUpHistory: [
        ...session.memory.followUpHistory,
        { intent: followUp.intent, question: followUp.question, stage: session.currentStage, createdAt: message.createdAt }
      ].slice(-24),
      repeatedQuestionProtection: unique([...session.memory.repeatedQuestionProtection, normalizeQuestion(followUp.question)]).slice(-40),
      lastAssistantIntent: followUp.intent
    }
  };
}

export function createUserInterviewMessage(content: string): InterviewMessage {
  return { id: makeId("msg"), role: "user", content, createdAt: now() };
}

export function createAssistantInterviewMessage(content: string): InterviewMessage {
  return { id: makeId("msg"), role: "assistant", content, createdAt: now() };
}

export type InterviewEvidenceItem = {
  label: string;
  value: string;
  fieldKey: keyof InterviewResumeDraft;
  evidence: string[];
};

export type InterviewReadinessSummary = {
  ready: boolean;
  strongestEvidence: string[];
  weakAreas: string[];
  suggestedNextQuestion: string;
  weakestStage: InterviewStageId;
  strengthLabel: "Draft" | "Usable" | "Strong" | "Application Ready";
};

export type InterviewGeneratedPackage = {
  intake: IntakeData;
  resume: ResumePackage;
  readiness: InterviewReadinessSummary;
  evidence: InterviewEvidenceItem[];
};

function evidenceForValue(messages: InterviewMessage[], value: string) {
  const normalized = value.toLowerCase();
  const tokens = normalized.split(/\s+/).filter((token) => token.length > 3).slice(0, 5);
  return messages
    .filter((message) => message.role === "user")
    .filter((message) => {
      const content = message.content.toLowerCase();
      return content.includes(normalized) || tokens.some((token) => content.includes(token));
    })
    .slice(-2)
    .map((message) => message.content);
}

export function getInterviewEvidence(session: InterviewSession): InterviewEvidenceItem[] {
  const draft = session.resumeDraft;
  const evidenceSource: Array<[keyof InterviewResumeDraft, string, string[]]> = [
    ["targetRole", "Target role", draft.targetRole ? [draft.targetRole] : []],
    ["roles", "Role", draft.roles.map((role) => [role.title, role.company, role.timeInRole].filter(Boolean).join(" | "))],
    ["responsibilities", "Responsibility", draft.responsibilities],
    ["achievements", "Achievement", draft.achievements],
    ["metrics", "Metric", draft.metrics],
    ["tools", "Tool", draft.tools],
    ["skills", "Skill", draft.skills],
    ["projects", "Project", draft.projects]
  ];

  return evidenceSource.flatMap(([fieldKey, label, values]) =>
    values.filter(Boolean).map((value) => ({
      label,
      value,
      fieldKey,
      evidence: evidenceForValue(session.messages, value)
    }))
  );
}

export function getInterviewResumeReadinessSummary(session: InterviewSession): InterviewReadinessSummary {
  const ready = canGenerateResumeFromInterview(session);
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  const weakAreas = statuses
    .filter((field) => field.status === "empty" || field.status === "weak")
    .filter((field) => ["targetRole", "roles", "responsibilities", "achievements", "metrics", "tools", "skills", "projects"].includes(String(field.fieldKey)))
    .map((field) => `${field.label}: ${field.status}`);
  const strongestEvidence = getInterviewEvidence(session)
    .filter((item) => item.evidence.length)
    .slice(0, 6)
    .map((item) => `${item.label}: ${item.value}`);

  return {
    ready,
    strongestEvidence,
    weakAreas: weakAreas.length ? weakAreas : ready ? [] : ["Add more specific role, responsibility, tool, and result details."],
    suggestedNextQuestion: getNextAssistantQuestion(session),
    weakestStage: getWeakestInterviewStage(session),
    strengthLabel: getInterviewResumeStrengthLabel(session)
  };
}

export function getInterviewResumeStrengthLabel(session: InterviewSession): InterviewReadinessSummary["strengthLabel"] {
  const confidence = session.resumeDraft.confidenceScore;
  const hasMetrics = session.resumeDraft.metrics.length > 0;
  const strongCount = (session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session)).filter(
    (field) => field.status === "strong"
  ).length;

  if (!canGenerateResumeFromInterview(session)) return "Draft";
  if (confidence >= 82 && hasMetrics && strongCount >= 5) return "Application Ready";
  if (confidence >= 68 && strongCount >= 4) return "Strong";
  return "Usable";
}

export function getInterviewCoachingMessages(session: InterviewSession): string[] {
  const statuses = statusByKey(session);
  const messages: string[] = [];
  const isWeak = (key: keyof InterviewResumeDraft) => {
    const status = statuses.get(key)?.status ?? "empty";
    return status === "empty" || status === "weak";
  };

  if (isWeak("targetRole")) {
    messages.push("A clear target role helps Career Forge aim the resume instead of writing something generic.");
  }
  if (isWeak("metrics")) {
    messages.push("Numbers help recruiters trust the story. Approximate volume, speed, dollars, percentages, or time saved all count.");
  }
  if (isWeak("achievements") && isWeak("projects")) {
    messages.push("Try naming what changed because of your work: faster response, cleaner records, better follow-through, or fewer errors.");
  }
  if (isWeak("tools") && isWeak("skills")) {
    messages.push("Mention systems, platforms, software, equipment, or workflows you used.");
  }

  return messages.slice(0, 3);
}

export function getSmartInterviewSummary(session: InterviewSession): { learned: string[]; stillLearning: string[]; conversationScore: number } {
  const learned = unique([...session.memory.discoveredFacts, ...factsFromDraft(session.resumeDraft)]).slice(0, 6);
  const statuses = statusByKey(session);
  const stillLearningPairs: Array<[string, string | undefined]> = [
    ["Biggest accomplishment", statuses.get("achievements")?.status],
    ["Technologies or systems", statuses.get("tools")?.status === "empty" && statuses.get("skills")?.status === "empty" ? "empty" : "usable"],
    ["Metrics or scale", statuses.get("metrics")?.status],
    ["Project proof", statuses.get("projects")?.status],
    ["Leadership examples", session.memory.discussedTopics.includes("leadership") ? "usable" : "weak"]
  ];
  const stillLearning = stillLearningPairs
    .filter(([, status]) => status === "empty" || status === "weak")
    .map(([label]) => label);

  return {
    learned,
    stillLearning: stillLearning.slice(0, 5),
    conversationScore: session.memory.conversationScore
  };
}

function metricForPattern(metrics: string, pattern: RegExp) {
  return metrics
    .split(",")
    .map((metric) => metric.trim())
    .find((metric) => pattern.test(metric)) ?? "";
}

export function convertInterviewDraftToExistingResumeInput(session: InterviewSession): IntakeData {
  const draft = session.resumeDraft;
  const role = draft.roles[0];
  const projectFallbackRole = !role && draft.projects.length
    ? {
        title: "Project Experience",
        company: draft.education ? "Academic / Independent Projects" : "Independent Projects",
        timeInRole: "",
        notes: draft.projects
      }
    : undefined;
  const primaryRole = role ?? projectFallbackRole;
  const roleFamily = inferRoleFamily([draft.targetRole, draft.targetIndustry, ...draft.skills, ...draft.responsibilities, primaryRole?.title ?? ""].join(" "));
  const metrics = draft.metrics.join(", ");

  return {
    ...initialIntake,
    targetJobTitle: draft.targetRole || initialIntake.targetJobTitle,
    roleFamily,
    currentTitle: primaryRole?.title ?? "",
    currentCompany: primaryRole?.company ?? "",
    currentTime: primaryRole?.timeInRole ?? "",
    tools: draft.tools.join(", "),
    responsibilities: draft.responsibilities.join(", "),
    selectedResponsibilities: unique([...draft.responsibilities, ...draft.skills]).slice(0, 10),
    customersServed: metricForPattern(metrics, /customer|client|user|people/i),
    ticketsHandled: metricForPattern(metrics, /ticket|case|issue|request/i),
    projectsSupported: metricForPattern(metrics, /project|launch|implementation/i),
    teamSizeSupported: metricForPattern(metrics, /team|people|members|staff/i),
    callsHandled: metricForPattern(metrics, /call/i),
    revenueInfluenced: metricForPattern(metrics, /\$|revenue|budget|money|dollars/i),
    reportsCreated: metricForPattern(metrics, /report|document|dashboard/i),
    selectedOutcomes: unique([...draft.achievements, ...draft.projects]).slice(0, 3),
    outcomes: draft.achievements.join(", "),
    customRoleIndustry: draft.targetIndustry,
    customRoleTransferableSkills: draft.skills,
    customRoleNotes: unique([...draft.projects, draft.education, ...draft.certifications]).join(", ")
  };
}

export function generateResumePackageFromInterview(session: InterviewSession): InterviewGeneratedPackage {
  const intake = convertInterviewDraftToExistingResumeInput(session);
  const resume = generateResumePackage(intake);
  return {
    intake,
    resume,
    readiness: getInterviewResumeReadinessSummary(session),
    evidence: getInterviewEvidence(session)
  };
}
