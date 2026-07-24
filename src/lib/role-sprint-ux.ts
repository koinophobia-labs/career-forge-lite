import type { RequirementMatch } from "@/lib/job-post-analyzer";
import { sprintEligibility } from "@/lib/role-sprint";
import type { ApplicationStatus, RoleSprintOutputs, RoleSprintType } from "@/types/command-center";

export type SprintRecommendationDecision =
  | "sprint"
  | "apply-first"
  | "application-live"
  | "prepare-interview"
  | "review-offer";

export type SprintRecommendationContext = {
  applicationStatus?: ApplicationStatus | null;
  deadline?: string | null;
  hasResumeBaseline: boolean;
  nowIso?: string;
};

export type RecommendedSprintRequirement = {
  requirement: RequirementMatch;
  reason: string;
  decision: SprintRecommendationDecision;
};

const STRONG_REQUIREMENT_SIGNAL = /\b(must|required|requires|ability to|responsible for|proficien\w*|strong|demonstrated|hands-on)\b/i;
const OPTIONAL_SIGNAL = /\b(preferred|nice to have|bonus|plus|ideally)\b/i;
const ARTIFACT_SIGNAL = /\b(build|create|develop|design|evaluate|audit|plan|workflow|dashboard|report|sql|spreadsheet|documentation|simulation|scenario)\b/i;

function meaningfulTerms(value: string): string[] {
  return value
    .toLowerCase()
    .match(/[a-z0-9+#.-]{3,}/g)
    ?.filter((term) => !new Set(["and", "the", "with", "for", "from", "that", "this", "your", "you", "our", "are", "will", "have", "has", "into", "using", "years", "experience"]).has(term)) ?? [];
}

function scoreRequirement(requirement: RequirementMatch, jobPost: string): number {
  const text = requirement.requirement;
  const post = jobPost.toLowerCase();
  const terms = meaningfulTerms(text);
  const repeatedTerms = terms.reduce((count, term) => count + Math.max(0, post.split(term).length - 2), 0);
  let score = requirement.status === "gap" ? 8 : 5;
  score += Math.min(4, repeatedTerms);
  if (!requirement.evidenceIds.length) score += 2;
  if (STRONG_REQUIREMENT_SIGNAL.test(text)) score += 2;
  if (ARTIFACT_SIGNAL.test(text)) score += 2;
  if (OPTIONAL_SIGNAL.test(text)) score -= 4;
  return score;
}

function deadlineIsUrgent(deadline: string | null | undefined, nowIso: string): boolean {
  if (!deadline) return false;
  const deadlineTime = new Date(deadline).getTime();
  const nowTime = new Date(nowIso).getTime();
  if (!Number.isFinite(deadlineTime) || !Number.isFinite(nowTime)) return false;
  const hours = (deadlineTime - nowTime) / 3_600_000;
  return hours >= 0 && hours <= 48;
}

export function recommendRoleSprintRequirement(
  requirements: RequirementMatch[],
  jobPost: string,
  context: SprintRecommendationContext = { hasResumeBaseline: false }
): RecommendedSprintRequirement | null {
  const ranked = requirements
    .filter((requirement) => requirement.status !== "covered" && sprintEligibility(requirement).eligible)
    .map((requirement) => ({ requirement, score: scoreRequirement(requirement, jobPost) }))
    .sort((a, b) => b.score - a.score || a.requirement.requirement.localeCompare(b.requirement.requirement));
  const winner = ranked[0];
  if (!winner) return null;

  if (context.applicationStatus === "offer") {
    return {
      requirement: winner.requirement,
      decision: "review-offer",
      reason: "You already have an offer. Review the role, compensation, timing, and decision before doing more application work."
    };
  }

  if (context.applicationStatus === "interviewing") {
    return {
      requirement: winner.requirement,
      decision: "prepare-interview",
      reason: `You are already interviewing. Prepare to discuss “${winner.requirement.requirement}” honestly instead of rebuilding the application.`
    };
  }

  if (context.applicationStatus === "applied") {
    return {
      requirement: winner.requirement,
      decision: "application-live",
      reason: `Your application is already submitted. Keep “${winner.requirement.requirement}” as optional practice while you track follow-up and interview activity.`
    };
  }

  const nowIso = context.nowIso ?? new Date().toISOString();
  const urgentDeadline = deadlineIsUrgent(context.deadline, nowIso);
  const strongEnoughToDelay = winner.score >= 12 && winner.requirement.status === "gap" && !OPTIONAL_SIGNAL.test(winner.requirement.requirement);
  const decision: SprintRecommendationDecision = urgentDeadline || (context.hasResumeBaseline && !strongEnoughToDelay)
    ? "apply-first"
    : "sprint";

  const reasonParts = [
    winner.requirement.status === "gap" ? "your profile has no direct proof for it" : "your current proof is only partial",
    ARTIFACT_SIGNAL.test(winner.requirement.requirement) ? "a short artifact can demonstrate useful practice" : "a bounded exercise can address it honestly",
    OPTIONAL_SIGNAL.test(winner.requirement.requirement) ? "the posting marks it as optional" : "the posting treats it as meaningful"
  ];

  if (decision === "apply-first") {
    return {
      requirement: winner.requirement,
      decision,
      reason: urgentDeadline
        ? `Apply first because the deadline is close. Practice “${winner.requirement.requirement}” afterward if it still matters.`
        : `Tailor and apply with your current evidence. Practice “${winner.requirement.requirement}” afterward if it still matters.`
    };
  }

  return {
    requirement: winner.requirement,
    decision,
    reason: `Recommended because ${reasonParts.join(", ")}.`
  };
}

export type PrimarySprintOutput = {
  key: keyof Omit<RoleSprintOutputs, "userEdited">;
  label: string;
  hint: string;
  rows: number;
};

export function primarySprintOutput(sprintType: RoleSprintType): PrimarySprintOutput {
  if (sprintType === "build") {
    return { key: "portfolioSummary", label: "Portfolio summary", hint: "Use this beside the artifact you built.", rows: 5 };
  }
  if (sprintType === "evaluate") {
    return { key: "portfolioSummary", label: "Evaluation summary", hint: "Use this to explain the scenario, rubric, verdict, and fix.", rows: 5 };
  }
  if (sprintType === "plan") {
    return { key: "portfolioSummary", label: "Plan summary", hint: "Use this beside the working plan or checklist.", rows: 5 };
  }
  if (sprintType === "simulate") {
    return { key: "starStory", label: "Interview story", hint: "Use this to explain how you handled the practice scenario.", rows: 6 };
  }
  return { key: "resumeBullet", label: "Résumé / project bullet", hint: "Place this under projects or independent practice, never employment.", rows: 4 };
}
