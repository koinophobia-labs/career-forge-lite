import { initialIntake } from "@/lib/career-data";
import type { IntakeData, RoleFamily } from "@/types/career";
import type {
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
    goal: "Understand the target job and direction.",
    requiredFields: ["targetRole", "targetIndustry"],
    exampleAssistantQuestion: "What role are you aiming for, and what kind of company or industry are you targeting?",
    completionCriteria: "Target role is usable and industry or lane is at least weak."
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
    goal: "Capture current or most recent title, company, and time in role.",
    requiredFields: ["roles"],
    exampleAssistantQuestion: "What is your current or most recent role, where did you do it, and when?",
    completionCriteria: "At least one role has a title."
  },
  {
    id: "responsibilities",
    label: "Responsibilities",
    goal: "Extract confirmed work responsibilities.",
    requiredFields: ["responsibilities"],
    exampleAssistantQuestion: "What did you actually handle day to day? Plain language is perfect.",
    completionCriteria: "At least two responsibilities are captured."
  },
  {
    id: "achievements",
    label: "Achievements",
    goal: "Find outcomes, wins, or useful work improvements.",
    requiredFields: ["achievements"],
    exampleAssistantQuestion: "What improved because of your work, even in a small way?",
    completionCriteria: "At least one achievement or improvement is captured."
  },
  {
    id: "metrics",
    label: "Metrics",
    goal: "Collect scope numbers and estimates.",
    requiredFields: ["metrics"],
    exampleAssistantQuestion: "What volume did you handle: customers, tickets, calls, reports, money, team size, or projects?",
    completionCriteria: "At least one metric or estimate is captured."
  },
  {
    id: "tools_and_skills",
    label: "Tools And Skills",
    goal: "Capture tools, platforms, and transferable skills.",
    requiredFields: ["tools", "skills"],
    exampleAssistantQuestion: "What tools, systems, or skills did you use regularly?",
    completionCriteria: "Tools or skills are usable."
  },
  {
    id: "projects_or_portfolio",
    label: "Projects Or Portfolio",
    goal: "Capture optional projects, links, or portfolio proof.",
    requiredFields: ["projects"],
    exampleAssistantQuestion: "Any projects, portfolio links, or examples of work you want reflected?",
    completionCriteria: "Optional stage is complete when answered or skipped."
  },
  {
    id: "education_and_certifications",
    label: "Education And Certifications",
    goal: "Capture education, certificates, or training.",
    requiredFields: ["education", "certifications"],
    exampleAssistantQuestion: "What education, certifications, training, or courses should appear?",
    completionCriteria: "Education/certification is captured or skipped."
  },
  {
    id: "gaps_and_positioning",
    label: "Gaps And Positioning",
    goal: "Identify weak areas and positioning concerns.",
    requiredFields: ["gapsOrWeakAreas"],
    exampleAssistantQuestion: "Anything we should position carefully, like a gap, career change, or limited direct experience?",
    completionCriteria: "Positioning notes are captured or skipped."
  },
  {
    id: "final_resume_review",
    label: "Final Resume Review",
    goal: "Confirm readiness before generating resume input.",
    requiredFields: ["targetRole", "roles", "responsibilities", "tools"],
    exampleAssistantQuestion: "Reviewing what we have: what is missing or inaccurate before I generate the resume package?",
    completionCriteria: "Minimum resume fields are usable."
  }
];

const requiredStatusFields: Array<{ key: keyof InterviewResumeDraft; label: string }> = [
  { key: "targetRole", label: "Target role" },
  { key: "roles", label: "Work history" },
  { key: "responsibilities", label: "Responsibilities" },
  { key: "metrics", label: "Scope or metrics" },
  { key: "tools", label: "Tools" },
  { key: "skills", label: "Skills" }
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

function unique(items: string[]) {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function splitSignals(value: string) {
  return unique(
    value
      .split(/,|;|\n|\band\b/i)
      .map((item) => item.replace(/^(i|we)\s+/i, "").trim())
      .filter((item) => item.length > 2)
  );
}

function scoreStatus(values: string[]): InterviewFieldStatus["status"] {
  const totalLength = values.join(" ").length;
  if (!values.length) return "empty";
  if (values.length >= 3 || totalLength > 80) return "strong";
  if (values.length >= 1 || totalLength > 30) return "usable";
  return "weak";
}

function statusForField(draft: InterviewResumeDraft, key: keyof InterviewResumeDraft, label: string, messages: InterviewMessage[]): InterviewFieldStatus {
  const raw = draft[key];
  const values = Array.isArray(raw)
    ? raw.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean)
    : raw
      ? [String(raw)]
      : [];
  const evidenceFromMessages = messages
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.id);
  const status = scoreStatus(values);

  return {
    fieldKey: key,
    label,
    status,
    evidenceFromMessages: values.length ? evidenceFromMessages : [],
    notes: status === "empty" ? `${label} still needs an answer.` : `${label} has ${status} signal.`
  };
}

function calculateConfidence(statuses: InterviewFieldStatus[]) {
  const weights = { empty: 0, weak: 0.3, usable: 0.72, strong: 1 };
  const total = statuses.reduce((sum, status) => sum + weights[status.status], 0);
  return Math.round((total / statuses.length) * 100);
}

export function getCurrentFieldStatuses(session: InterviewSession): InterviewFieldStatus[] {
  const statuses = requiredStatusFields.map((field) => statusForField(session.resumeDraft, field.key, field.label, session.messages));
  return statuses;
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
    content: interviewStages[0].exampleAssistantQuestion,
    createdAt
  };

  return withStatuses({
    id: makeId("interview"),
    messages: [initialMessage],
    resumeDraft: emptyDraft(),
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

function extractRole(answer: string) {
  const atMatch = answer.match(
    /(?:as|role is|title is|worked as|i'm|i am|was)\s+(?:an?\s+)?([^,.]+?)(?:\s+at\s+([^,.]+?))?(?:\s+(?:from|since|for)\s+([^,.]+))?(?:,|\.|$)/i
  );
  const companyMatch = answer.match(/\bat\s+([A-Z][A-Za-z0-9&.\-\s]{2,40})(?:,|\.| from| since| for|$)/);
  const timeMatch = answer.match(/(?:from|since|for)\s+([^,.]+)/i);
  return {
    title: atMatch?.[1]?.trim() ?? "",
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
  const toolKeywords = answer.match(/\b(Salesforce|HubSpot|Zendesk|Intercom|ServiceNow|Jira|Asana|Trello|Slack|Excel|Google Sheets|Google Workspace|Microsoft Office|Active Directory|SQL|Python|Tableau|Power BI|Notion|Airtable|POS Systems)\b/gi);
  return unique(toolKeywords ?? []);
}

function extractMetricSignals(answer: string) {
  return unique(answer.match(/\b(?:\d+[\w+%$-]*\s+)?(?:customers|clients|users|tickets|calls|reports|projects|team members|people|transactions|orders|accounts|dollars|revenue|budget|weekly|monthly|daily)\b[^,.]*/gi) ?? []);
}

function addMessage(session: InterviewSession, message: InterviewMessage) {
  return { ...session, messages: [...session.messages, message] };
}

export function updateInterviewDraftFromUserAnswer(session: InterviewSession, userMessage: InterviewMessage): InterviewSession {
  const answer = userMessage.content.trim();
  const draft = session.resumeDraft;
  const nextDraft: InterviewResumeDraft = { ...draft };

  if (session.currentStage === "role_targeting") {
    nextDraft.targetRole = answer;
    const industryMatch = answer.match(/\b(?:in|for|at)\s+([A-Za-z /&-]+)$/i);
    nextDraft.targetIndustry = industryMatch?.[1]?.trim() ?? nextDraft.targetIndustry;
  }

  if (session.currentStage === "background_overview") {
    nextDraft.experienceLevel = answer.length > 80 ? "Early-career with multiple work signals" : answer;
  }

  if (session.currentStage === "current_or_recent_role") {
    nextDraft.roles = mergeRole(nextDraft.roles, answer);
  }

  if (session.currentStage === "responsibilities") {
    nextDraft.responsibilities = unique([...nextDraft.responsibilities, ...splitSignals(answer)]).slice(0, 10);
  }

  if (session.currentStage === "achievements") {
    nextDraft.achievements = unique([...nextDraft.achievements, ...splitSignals(answer)]).slice(0, 8);
  }

  if (session.currentStage === "metrics") {
    nextDraft.metrics = unique([...nextDraft.metrics, ...extractMetricSignals(answer), ...splitSignals(answer).filter((item) => /\d/.test(item))]).slice(0, 8);
  }

  if (session.currentStage === "tools_and_skills") {
    nextDraft.tools = unique([...nextDraft.tools, ...extractToolSignals(answer)]).slice(0, 8);
    nextDraft.skills = unique([...nextDraft.skills, ...splitSignals(answer).filter((item) => !extractToolSignals(answer).includes(item))]).slice(0, 10);
  }

  if (session.currentStage === "projects_or_portfolio") {
    nextDraft.projects = unique([...nextDraft.projects, ...splitSignals(answer)]).slice(0, 6);
  }

  if (session.currentStage === "education_and_certifications") {
    if (/cert|certificate|license|training/i.test(answer)) {
      nextDraft.certifications = unique([...nextDraft.certifications, ...splitSignals(answer)]).slice(0, 6);
    } else {
      nextDraft.education = answer;
    }
  }

  if (session.currentStage === "gaps_and_positioning") {
    nextDraft.gapsOrWeakAreas = unique([...nextDraft.gapsOrWeakAreas, ...splitSignals(answer)]).slice(0, 6);
  }

  const withUserMessage = addMessage(session, userMessage);
  const completedStages = unique([...session.completedStages, session.currentStage]) as InterviewStageId[];
  const stagedSession = withStatuses({
    ...withUserMessage,
    resumeDraft: nextDraft,
    completedStages,
    currentStage: getNextInterviewStage({ ...withUserMessage, resumeDraft: nextDraft, completedStages, fieldStatuses: [] }).id
  });

  return stagedSession;
}

export function getNextInterviewStage(session: InterviewSession): InterviewStage {
  const missing = getMissingOrWeakFields(session);
  if (missing.some((field) => field.fieldKey === "targetRole")) return interviewStages[0];
  if (missing.some((field) => field.fieldKey === "roles")) return interviewStages[2];
  if (missing.some((field) => field.fieldKey === "responsibilities")) return interviewStages[3];
  if (missing.some((field) => field.fieldKey === "metrics")) return interviewStages[5];
  if (missing.some((field) => field.fieldKey === "tools" || field.fieldKey === "skills")) return interviewStages[6];

  const currentIndex = interviewStages.findIndex((stage) => stage.id === session.currentStage);
  const nextUncompleted = interviewStages.find((stage, index) => index > currentIndex && !session.completedStages.includes(stage.id));
  return nextUncompleted ?? interviewStages.at(-1)!;
}

export function getMissingOrWeakFields(session: InterviewSession): InterviewFieldStatus[] {
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  return statuses.filter((field) => field.status === "empty" || field.status === "weak");
}

export function canGenerateResumeFromInterview(session: InterviewSession) {
  const statuses = session.fieldStatuses.length ? session.fieldStatuses : getCurrentFieldStatuses(session);
  const requiredUsable = ["targetRole", "roles", "responsibilities"];
  return requiredUsable.every((key) => {
    const status = statuses.find((field) => field.fieldKey === key)?.status;
    return status === "usable" || status === "strong";
  });
}

export function assistantQuestionForStage(stageId: InterviewStageId) {
  return interviewStages.find((stage) => stage.id === stageId)?.exampleAssistantQuestion ?? interviewStages[0].exampleAssistantQuestion;
}

export function createUserInterviewMessage(content: string): InterviewMessage {
  return { id: makeId("msg"), role: "user", content, createdAt: now() };
}

export function createAssistantInterviewMessage(content: string): InterviewMessage {
  return { id: makeId("msg"), role: "assistant", content, createdAt: now() };
}

export function convertInterviewDraftToExistingResumeInput(session: InterviewSession): IntakeData {
  const draft = session.resumeDraft;
  const role = draft.roles[0];
  const roleFamily = inferRoleFamily([draft.targetRole, draft.targetIndustry, ...draft.skills, ...draft.responsibilities].join(" "));
  const metrics = draft.metrics.join(", ");

  return {
    ...initialIntake,
    fullName: "Candidate Name",
    email: "candidate@email.com",
    targetJobTitle: draft.targetRole,
    roleFamily,
    currentTitle: role?.title ?? "",
    currentCompany: role?.company ?? "",
    currentTime: role?.timeInRole ?? "",
    tools: draft.tools.join(", "),
    responsibilities: draft.responsibilities.join(", "),
    selectedResponsibilities: unique([...draft.responsibilities, ...draft.skills]).slice(0, 10),
    customersServed: /customer|client|user/i.test(metrics) ? metrics : "",
    ticketsHandled: /ticket|case|issue/i.test(metrics) ? metrics : "",
    projectsSupported: /project/i.test(metrics) ? metrics : "",
    teamSizeSupported: /team|people|members/i.test(metrics) ? metrics : "",
    callsHandled: /call/i.test(metrics) ? metrics : "",
    reportsCreated: /report|document/i.test(metrics) ? metrics : "",
    selectedOutcomes: draft.achievements.slice(0, 3),
    outcomes: draft.achievements.join(", "),
    customRoleIndustry: draft.targetIndustry,
    customRoleTransferableSkills: draft.skills,
    customRoleNotes: unique([...draft.projects, ...draft.gapsOrWeakAreas]).join(", ")
  };
}
