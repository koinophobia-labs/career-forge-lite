import { assessDossierReadiness } from "@/lib/dossier";
import type { CareerGoalKind, CommandCenterState, NextBestAction } from "@/types/command-center";

export type GoalOption = {
  kind: CareerGoalKind;
  label: string;
  description: string;
};

export type RecentCareerItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  timestamp: string;
};

export const CAREER_GOALS: GoalOption[] = [
  { kind: "new-job", label: "Get a New Job", description: "Tailor my materials and build an application plan." },
  { kind: "career-change", label: "Change Careers", description: "Translate my experience into a new lane." },
  { kind: "update-resume", label: "Update My Résumé", description: "Strengthen an existing résumé using verified experience." },
  { kind: "first-resume", label: "Build My First Résumé", description: "Create one role or project at a time." },
  { kind: "practice-interview", label: "Practice Interview", description: "Prepare from a real role, résumé, or interview stage." }
];

export function hasCareerActivity(state: CommandCenterState): boolean {
  return Boolean(
    state.dossier.evidence.length || state.pendingImportReviews.length || state.lanes.length ||
    state.resumePacks.length || state.resumeVersions.length || state.applications.length || state.outreach.length
  );
}

export function isIntentFirstRun(state: CommandCenterState): boolean {
  return !state.activeGoal && !hasCareerActivity(state);
}

export function inferCareerGoal(state: CommandCenterState): CareerGoalKind {
  if (state.activeGoal) return state.activeGoal.kind;
  if (state.applications.some((application) => application.status === "interviewing")) return "practice-interview";
  if (state.applications.length || state.resumePacks.length || state.lanes.length) return "new-job";
  if (state.resumeVersions.length) return "update-resume";
  return "new-job";
}

export function careerGoalLabel(state: CommandCenterState, kind = inferCareerGoal(state)): string {
  const interviewing = [...state.applications].filter((application) => application.status === "interviewing").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const activeLane = state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0];
  if (kind === "practice-interview") return interviewing ? `${interviewing.roleTitle} Interview` : "Interview Practice";
  if (kind === "career-change") return activeLane ? `${activeLane.title} Career Change` : "Career Change";
  if (kind === "update-resume") return activeLane ? `${activeLane.title} Résumé Update` : "Résumé Update";
  if (kind === "first-resume") return "First Résumé";
  return activeLane ? `${activeLane.title} Job Search` : "New Job Search";
}

function evidenceEntry(state: CommandCenterState, kind: CareerGoalKind): NextBestAction {
  if (kind === "first-resume") return { title: "Add one real role or project", detail: "Start with the most recent work you can explain. Everything else stays optional.", href: "/profile#manual-history", actionLabel: "Add recent experience" };
  return { title: "Bring in the career history you already have", detail: "Career Forge will explain and group what it finds before anything becomes trusted evidence.", href: "/profile#import", actionLabel: "Import career history" };
}

export function goalEntryAction(state: CommandCenterState, kind: CareerGoalKind): NextBestAction {
  if (kind === "practice-interview") {
    return { title: "Choose the interview you want to practice", detail: "Prepare from a real role, saved application, or interview stage.", href: "/interview", actionLabel: "Open interview practice" };
  }
  if (state.pendingImportReviews.length) return { title: "Finish reviewing imported evidence", detail: "Pending facts cannot support a résumé, lane, or application until you approve and save them.", href: "/profile#review", actionLabel: "Resume evidence review" };
  if (assessDossierReadiness(state.dossier).level === "not-ready") return evidenceEntry(state, kind);
  if (kind === "career-change") return { title: "Choose the lane you are moving toward", detail: "Compare the new direction against approved direct and transferable evidence.", href: "/targets", actionLabel: "Choose a transition lane" };
  if (kind === "update-resume" && state.resumePacks.length) return { title: "Open your latest résumé pack", detail: "Review the current baselines and their defensibility receipts before changing the document.", href: "/versions", actionLabel: "Update résumé" };
  if (kind === "first-resume" && state.resumePacks.length) return { title: "Continue your first résumé", detail: "Open the generated baseline and review every claim before export.", href: "/versions", actionLabel: "Continue résumé" };
  if (!state.lanes.some((lane) => lane.status === "active")) return { title: "Choose one credible role lane", detail: "Your approved evidence determines which direction can support a truthful baseline.", href: "/targets", actionLabel: "Choose a role lane" };
  if (!state.resumePacks.length) return { title: "Compile your first role-lane pack", detail: "Generate the ATS and recruiter baselines from approved evidence.", href: "/targets", actionLabel: "Generate résumé pack" };
  if (kind === "update-resume" || kind === "first-resume") return { title: "Review your latest résumé pack", detail: "Inspect the defensibility receipt and update only what your evidence supports.", href: "/versions", actionLabel: "Open résumé pack" };
  return { title: "Tailor the right baseline to a real posting", detail: "The posting defines the requirements; Career Forge checks them against approved evidence.", href: "/tailor", actionLabel: "Tailor to a job" };
}

export function intentNextMove(state: CommandCenterState, kind = inferCareerGoal(state)): NextBestAction {
  if (state.pendingImportReviews.length || assessDossierReadiness(state.dossier).level === "not-ready") return goalEntryAction(state, kind);
  const interviewing = state.applications.find((application) => application.status === "interviewing");
  if (interviewing) return { title: `Prepare for ${interviewing.roleTitle} at ${interviewing.company}`, detail: "Practice the real role requirements, transferable evidence, and known gaps.", href: "/interview", actionLabel: "Practice interview" };
  const followUp = state.applications.find((application) => application.nextFollowUpAt && new Date(application.nextFollowUpAt).getTime() <= Date.now());
  if (followUp) return { title: `Follow up on ${followUp.company || followUp.roleTitle}`, detail: "This application has reached its scheduled follow-up date.", href: "/applications", actionLabel: "Log follow-up" };
  const draft = state.applications.find((application) => application.status === "drafting");
  if (draft) return { title: `Continue ${draft.roleTitle} at ${draft.company}`, detail: "Finish the evidence-backed application already in progress.", href: "/applications", actionLabel: "Continue application" };
  return goalEntryAction(state, kind);
}

export function recentCareerItems(state: CommandCenterState, limit = 3): RecentCareerItem[] {
  const items: RecentCareerItem[] = [
    ...state.pendingImportReviews.map((batch) => ({ id: batch.id, label: "Pending evidence review", detail: `${batch.proposals.length} facts still in the Truth Inbox`, href: "/profile#review", timestamp: batch.updatedAt })),
    ...state.applications.map((application) => ({ id: application.id, label: [application.roleTitle, application.company].filter(Boolean).join(" · ") || "Saved application", detail: `${application.status} application`, href: "/applications", timestamp: application.createdAt })),
    ...state.resumePacks.map((pack) => ({ id: pack.id, label: "Résumé pack", detail: `${pack.variants.length} baselines · ${pack.status.replace("-", " ")}`, href: "/versions", timestamp: pack.updatedAt })),
    ...state.resumeVersions.map((version) => ({ id: version.id, label: version.label || "Résumé version", detail: version.source === "tailor" ? "Job-specific résumé" : "Guided résumé", href: "/versions", timestamp: version.createdAt }))
  ];
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export function intentMilestones(state: CommandCenterState): Array<{ label: string; complete: boolean }> {
  const approved = state.dossier.evidence.some((item) => item.approved && !item.rejected);
  return [
    { label: "Goal selected", complete: Boolean(state.activeGoal) },
    { label: "Evidence collected", complete: state.dossier.evidence.length > 0 || state.pendingImportReviews.length > 0 },
    { label: "Evidence approved", complete: approved },
    { label: "Target analyzed", complete: state.applications.some((application) => application.analysisKeywords.length > 0 || application.analysisGaps.length > 0) },
    { label: "Artifact generated", complete: state.resumePacks.length > 0 || state.resumeVersions.length > 0 },
    { label: "Application saved", complete: state.applications.length > 0 },
    { label: "Follow-up scheduled", complete: state.applications.some((application) => Boolean(application.nextFollowUpAt)) }
  ];
}
