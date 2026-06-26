import {
  allToolOptions,
  careerTargets,
  companySuggestions,
  findJobArsenal,
  roleIntelligence
} from "@/lib/career-data";
import { findIndependentWorkRole, inferIndependentWorkCategory, isIndependentWorkTitle } from "@/lib/independent-work-intelligence";
import { aiWorkflowOptions, selectedAiTools } from "@/lib/modern-work-intelligence";
import type { IntakeData } from "@/types/career";

export type MissingSignalKey =
  | "contact"
  | "target"
  | "recentRole"
  | "companyOrSource"
  | "dates"
  | "aiWorkflow"
  | "independentContext"
  | "unknownRoleContext"
  | "tools"
  | "responsibilities"
  | "scope"
  | "outcomes"
  | "education";

export type MissingSignal = {
  key: MissingSignalKey;
  label: string;
  prompt: string;
  priority: number;
};

const signalLabels: Record<MissingSignalKey, string> = {
  contact: "Contact",
  target: "Target role",
  recentRole: "Recent role",
  companyOrSource: "Company or work source",
  dates: "Dates or time in role",
  aiWorkflow: "AI workflow use",
  independentContext: "Independent work context",
  unknownRoleContext: "Role context",
  tools: "Tools or systems",
  responsibilities: "Responsibilities",
  scope: "Scope or proof",
  outcomes: "Outcomes",
  education: "Education"
};

function splitList(value: string) {
  return value.split(/,|\n/).map((item) => item.trim()).filter(Boolean);
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

function inferTargetFromText(text: string) {
  if (/customer success|client success/i.test(text)) return { targetJobTitle: "Customer Success Associate", roleFamily: "Customer Success" as const };
  if (/customer support|support specialist/i.test(text)) return { targetJobTitle: "Customer Support Specialist", roleFamily: "Customer Success" as const };
  if (/project coordinator|project coordination/i.test(text)) return { targetJobTitle: "Project Coordinator", roleFamily: "Project Coordination" as const };
  if (/operations associate|operations|ops/i.test(text)) return { targetJobTitle: "Operations Associate", roleFamily: "Operations" as const };
  if (/admin|administrative/i.test(text)) return { targetJobTitle: "Administrative Assistant", roleFamily: "Admin" as const };
  if (/help desk|it support/i.test(text)) return { targetJobTitle: "IT Support Specialist", roleFamily: "IT Support" as const };
  if (/social media/i.test(text)) return { targetJobTitle: "Social Media Manager", roleFamily: "Project Coordination" as const };
  return null;
}

function hasScope(data: IntakeData) {
  return [
    data.customersServed,
    data.ticketsHandled,
    data.projectsSupported,
    data.teamSizeSupported,
    data.callsHandled,
    data.revenueInfluenced,
    data.reportsCreated
  ].some((value) => value.trim());
}

function hasOutcomes(data: IntakeData) {
  return data.selectedOutcomes.length > 0 || data.outcomes.trim().length > 0;
}

function hasIndependentContext(data: IntakeData) {
  return Boolean(
    data.independentWorkType ||
      data.selectedIndependentWorkSignals.length ||
      findIndependentWorkRole(data.currentTitle) ||
      inferIndependentWorkCategory([data.currentTitle, data.targetJobTitle, data.responsibilities].join(" "))
  );
}

function isKnownRole(title: string) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;
  return careerTargets.some((target) => target.title.toLowerCase() === normalized) || Boolean(findJobArsenal(title));
}

export function getInterviewState(data: IntakeData) {
  const tools = splitList(data.tools);
  const aiTools = selectedAiTools(data.tools);
  const responsibilities = unique([
    ...data.selectedResponsibilities,
    ...data.selectedActions,
    ...data.selectedIndependentWorkSignals,
    ...splitList(data.responsibilities)
  ]);
  const unknownRoleNeedsContext = Boolean(
    [data.targetJobTitle, data.currentTitle, data.previousTitle, data.additionalTitle]
      .filter((title) => title.trim())
      .some((title) => !isKnownRole(title) && !isIndependentWorkTitle(title))
  );
  const independentWork = hasIndependentContext(data);

  return {
    hasContact: Boolean(data.fullName.trim() && data.email.trim()),
    hasTargetRole: Boolean(data.targetJobTitle.trim()),
    hasRecentRole: Boolean(data.currentTitle.trim()),
    hasCompanyOrSource: Boolean(data.currentCompany.trim() || independentWork),
    hasDates: Boolean(data.currentTime.trim()),
    hasTools: tools.length > 0,
    hasAiTools: aiTools.length > 0,
    hasAiWorkflows: data.selectedAiWorkflows.length > 0,
    hasResponsibilities: responsibilities.length >= 3,
    responsibilityCount: responsibilities.length,
    hasIndependentContext: independentWork,
    independentWorkNeedsContext: Boolean((findIndependentWorkRole(data.currentTitle) || inferIndependentWorkCategory(data.currentTitle)) && (!data.independentWorkType || !data.selectedIndependentWorkSignals.length)),
    unknownRoleNeedsContext,
    hasScope: hasScope(data),
    hasOutcomes: hasOutcomes(data),
    hasEducation: /\b(education|certification|course|training|degree|school|college|university|bootcamp)\b/i.test(data.customRoleNotes),
    tools,
    aiTools,
    responsibilities
  };
}

export function getMissingSignals(data: IntakeData): MissingSignal[] {
  const state = getInterviewState(data);
  const missing: MissingSignal[] = [];

  if (!state.hasTargetRole) {
    missing.push({ key: "target", label: signalLabels.target, prompt: "What role should this resume target?", priority: 100 });
  }
  if (!state.hasRecentRole) {
    missing.push({ key: "recentRole", label: signalLabels.recentRole, prompt: "What was your most recent role or real work experience?", priority: 95 });
  }
  if (!state.hasCompanyOrSource) {
    missing.push({ key: "companyOrSource", label: signalLabels.companyOrSource, prompt: "Where did you do that work, or should we list it as independent work?", priority: 88 });
  }
  if (!state.hasDates) {
    missing.push({ key: "dates", label: signalLabels.dates, prompt: "What dates or time in role should I use?", priority: 82 });
  }
  if (state.hasAiTools && !state.hasAiWorkflows) {
    missing.push({ key: "aiWorkflow", label: signalLabels.aiWorkflow, prompt: "How did you actually use those AI tools: research, documentation, coding help, automation, summaries, or something else?", priority: 78 });
  }
  if (state.independentWorkNeedsContext) {
    missing.push({ key: "independentContext", label: signalLabels.independentContext, prompt: "How should we describe this independent work: freelance, self-employed, contract, gig work, creator work, side business, volunteer, or family business?", priority: 76 });
  }
  if (state.unknownRoleNeedsContext) {
    missing.push({ key: "unknownRoleContext", label: signalLabels.unknownRoleContext, prompt: "What kind of work did that role mostly involve: customer-facing, operations, admin, technical support, sales, coordination, compliance, or something else?", priority: 74 });
  }
  if (!state.hasTools) {
    missing.push({ key: "tools", label: signalLabels.tools, prompt: "Did you use any tools, systems, apps, equipment, or workflows worth mentioning?", priority: 64 });
  }
  if (!state.hasResponsibilities) {
    missing.push({ key: "responsibilities", label: signalLabels.responsibilities, prompt: state.responsibilityCount > 0 ? `I caught ${state.responsibilities.slice(0, 2).join(" and ")}. What else should we include?` : "What work were you trusted with most often?", priority: 62 });
  }
  if (!state.hasScope) {
    missing.push({ key: "scope", label: signalLabels.scope, prompt: "What proof or scale can you estimate: customers, tickets, orders, projects, reports, hours, money handled, or team size?", priority: 46 });
  }
  if (!state.hasOutcomes) {
    missing.push({ key: "outcomes", label: signalLabels.outcomes, prompt: "What improved because of your work: speed, accuracy, reliability, customer satisfaction, efficiency, compliance, or follow-through?", priority: 40 });
  }
  if (!state.hasContact) {
    missing.push({ key: "contact", label: signalLabels.contact, prompt: "What name and email should recruiters use?", priority: 30 });
  }
  if (!state.hasEducation) {
    missing.push({ key: "education", label: signalLabels.education, prompt: "Any education, certification, training, coursework, or bootcamp you want included?", priority: 10 });
  }

  return missing.sort((a, b) => b.priority - a.priority);
}

export function hasEnoughResumeSignal(data: IntakeData) {
  const state = getInterviewState(data);
  return Boolean(
    state.hasTargetRole &&
      state.hasRecentRole &&
      state.hasCompanyOrSource &&
      (state.hasDates || state.hasIndependentContext) &&
      state.hasResponsibilities &&
      (state.hasTools || state.hasAiWorkflows || state.hasIndependentContext) &&
      (state.hasScope || state.hasOutcomes || state.hasIndependentContext)
  );
}

export function getNextUsefulPrompt(data: IntakeData) {
  if (hasEnoughResumeSignal(data)) {
    return {
      key: "ready" as const,
      label: "Ready to generate",
      prompt: "You gave Career Forge enough signal to build your first resume package."
    };
  }
  const next = getMissingSignals(data)[0];
  return {
    key: next?.key ?? ("ready" as const),
    label: next?.label ?? "Ready to generate",
    prompt: next?.prompt ?? "You gave Career Forge enough signal to build your first resume package."
  };
}

export function mergeReactiveSignals(data: IntakeData, text: string): IntakeData {
  const lower = text.toLowerCase();
  const matchedTarget = careerTargets.find((target) => lower.includes(target.title.toLowerCase()) || target.aliases?.some((alias) => lower.includes(alias.toLowerCase())));
  const inferredTarget = inferTargetFromText(text);
  const matchedCompany = companySuggestions.find((company) => lower.includes(company.toLowerCase()));
  const matchedTools = allToolOptions.filter((tool) => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const matchedAiWorkflows = aiWorkflowOptions.filter((workflow) => lower.includes(workflow.toLowerCase()));
  const matchedResponsibilities = roleIntelligence[data.roleFamily].responsibilities.filter((item) => lower.includes(item.toLowerCase()));
  const escalationSignals = /escalation|escalations|escalated/i.test(text) ? ["Escalation handling"] : [];
  const sportsbookSignals = /draftkings|sportsbook|wager|gaming/i.test(text) ? ["Customer communication", "Issue escalation"] : [];
  const nextTools = unique([data.tools, ...matchedTools]).join(", ");

  return {
    ...data,
    targetJobTitle: matchedTarget?.title ?? inferredTarget?.targetJobTitle ?? data.targetJobTitle,
    roleFamily: matchedTarget?.roleFamily ?? inferredTarget?.roleFamily ?? data.roleFamily,
    currentCompany: data.currentCompany || matchedCompany || data.currentCompany,
    tools: nextTools,
    selectedAiWorkflows: unique([...data.selectedAiWorkflows, ...matchedAiWorkflows]),
    selectedResponsibilities: unique([...data.selectedResponsibilities, ...matchedResponsibilities, ...escalationSignals, ...sportsbookSignals])
  };
}
