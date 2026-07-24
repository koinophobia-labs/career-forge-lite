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
  { kind: "new-job", label: "Get a New Job", description: "Use my experience to target real openings." },
  { kind: "career-change", label: "Change Careers", description: "Show how my experience carries into a new field." },
  { kind: "update-resume", label: "Update My Résumé", description: "Improve the résumé I already have." },
  { kind: "first-resume", label: "Build My First Résumé", description: "Start with one job, project, or school experience." },
  { kind: "practice-interview", label: "Practice Interview", description: "Practice questions for a real interview." }
];

export function hasCareerActivity(state: CommandCenterState): boolean {
  return Boolean(
    state.dossier.evidence.length || state.pendingImportReviews.length || state.lanes.length ||
    state.resumePacks.length || state.resumeVersions.length || state.applications.length || state.outreach.length ||
    state.roleSprints.length
  );
}

export function isIntentFirstRun(state: CommandCenterState): boolean {
  return !state.activeGoal && !hasCareerActivity(state);
}

export function inferCareerGoal(state: CommandCenterState): CareerGoalKind {
  if (state.activeGoal) return state.activeGoal.kind;
  if (state.applications.some((application) => application.status === "interviewing")) return "practice-interview";
  if (state.applications.length || state.resumePacks.length || state.lanes.length || state.roleSprints.length) return "new-job";
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

function evidenceEntry(kind: CareerGoalKind): NextBestAction {
  if (kind === "first-resume") {
    return {
      title: "Start with one job or project",
      detail: "Add the most recent experience you can explain. Everything else can wait.",
      href: "/profile#manual-history",
      actionLabel: "Add recent experience"
    };
  }
  return {
    title: "Add the work history you already have",
    detail: "Upload or paste an old résumé. Career Forge will pull out the facts and show only the items that need your attention.",
    href: "/profile#import",
    actionLabel: "Add my work history"
  };
}

export function goalEntryAction(state: CommandCenterState, kind: CareerGoalKind): NextBestAction {
  if (kind === "practice-interview") {
    return {
      title: "Choose the interview you want to practice",
      detail: "Prepare from a real role, saved application, or interview stage.",
      href: "/interview",
      actionLabel: "Choose an interview"
    };
  }
  if (state.pendingImportReviews.length) {
    return {
      title: "Check the facts that need your attention",
      detail: "Clear facts are preselected. Review anything uncertain, then save once.",
      href: "/profile#review",
      actionLabel: "Finish fact review"
    };
  }
  if (assessDossierReadiness(state.dossier).level === "not-ready") return evidenceEntry(kind);
  if (kind === "career-change") {
    return {
      title: "Choose the new job direction you want to test",
      detail: "Compare your current experience with a realistic next role.",
      href: "/targets",
      actionLabel: "Choose a target role"
    };
  }
  if (kind === "update-resume" && state.resumePacks.length) {
    return {
      title: "Open your latest résumé",
      detail: "Review the current version and update only what your experience supports.",
      href: "/versions",
      actionLabel: "Update my résumé"
    };
  }
  if (kind === "first-resume" && state.resumePacks.length) {
    return {
      title: "Continue your first résumé",
      detail: "Review each claim, make edits, and export when it looks right.",
      href: "/versions",
      actionLabel: "Continue my résumé"
    };
  }
  if (!state.lanes.some((lane) => lane.status === "active")) {
    return {
      title: "Choose the job you want to target",
      detail: "Career Forge will show which directions your approved experience can support.",
      href: "/targets",
      actionLabel: "Choose a target role"
    };
  }
  if (!state.resumePacks.length) {
    return {
      title: "Build your first résumé",
      detail: "Create ATS and recruiter versions from the facts you approved.",
      href: "/targets",
      actionLabel: "Build my résumé"
    };
  }
  if (kind === "update-resume" || kind === "first-resume") {
    return {
      title: "Review your latest résumé",
      detail: "Check the wording, make edits, and export when it is ready.",
      href: "/versions",
      actionLabel: "Open my résumé"
    };
  }
  return {
    title: "Tailor your résumé to a real job",
    detail: "Paste the job posting. Career Forge will use the right résumé and avoid claims your experience cannot support.",
    href: "/tailor",
    actionLabel: "Tailor to a job"
  };
}

export function intentNextMove(state: CommandCenterState, kind = inferCareerGoal(state)): NextBestAction {
  const pendingSprint = [...state.roleSprints]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .find((sprint) => {
      if (sprint.status !== "completed" || !sprint.evidenceId) return false;
      const evidence = state.dossier.evidence.find((item) => item.id === sprint.evidenceId);
      return Boolean(evidence && !evidence.approved && !evidence.rejected);
    });
  if (pendingSprint) {
    return {
      title: "Review the practice proof you finished",
      detail: `Your Role Sprint for “${pendingSprint.requirement}” is complete. Approve it as labeled practice or keep editing it.`,
      href: `/role-sprint?id=${pendingSprint.id}`,
      actionLabel: "Review practice proof"
    };
  }

  const draftSprint = [...state.roleSprints]
    .filter((sprint) => sprint.status === "draft")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (draftSprint) {
    return {
      title: "Finish the Role Sprint you started",
      detail: `Continue the practice task for “${draftSprint.requirement}” before starting another job workflow.`,
      href: `/role-sprint?id=${draftSprint.id}`,
      actionLabel: "Continue Role Sprint"
    };
  }

  if (state.pendingImportReviews.length || assessDossierReadiness(state.dossier).level === "not-ready") return goalEntryAction(state, kind);
  const interviewing = state.applications.find((application) => application.status === "interviewing");
  if (interviewing) {
    return {
      title: `Prepare for ${interviewing.roleTitle} at ${interviewing.company}`,
      detail: "Practice the real requirements, your strongest examples, and the gaps you should answer honestly.",
      href: "/interview",
      actionLabel: "Practice interview"
    };
  }
  const followUp = state.applications.find((application) => application.nextFollowUpAt && new Date(application.nextFollowUpAt).getTime() <= Date.now());
  if (followUp) return { title: `Follow up on ${followUp.company || followUp.roleTitle}`, detail: "This application is ready for a follow-up.", href: "/applications", actionLabel: "Log follow-up" };
  const draft = state.applications.find((application) => application.status === "drafting");
  if (draft) return { title: `Continue ${draft.roleTitle} at ${draft.company}`, detail: "Return to the saved job, finish the application, or continue its linked Role Sprint.", href: `/tailor?applicationId=${draft.id}`, actionLabel: "Continue saved job" };
  return goalEntryAction(state, kind);
}

export function recentCareerItems(state: CommandCenterState, limit = 3): RecentCareerItem[] {
  const items: RecentCareerItem[] = [
    ...state.pendingImportReviews.map((batch) => ({ id: batch.id, label: "Facts to review", detail: `${batch.proposals.length} imported facts`, href: "/profile#review", timestamp: batch.updatedAt })),
    ...state.roleSprints.map((sprint) => ({
      id: sprint.id,
      label: sprint.title || sprint.requirement,
      detail: sprint.status === "draft" ? "Role Sprint in progress" : sprint.status === "completed" ? "Practice proof ready for review" : "Approved practice proof",
      href: `/role-sprint?id=${sprint.id}`,
      timestamp: sprint.updatedAt
    })),
    ...state.applications.map((application) => ({ id: application.id, label: [application.roleTitle, application.company].filter(Boolean).join(" · ") || "Saved application", detail: `${application.status} application`, href: `/tailor?applicationId=${application.id}`, timestamp: application.createdAt })),
    ...state.resumePacks.map((pack) => ({ id: pack.id, label: "Résumé pack", detail: `${pack.variants.length} versions · ${pack.status.replace("-", " ")}`, href: "/versions", timestamp: pack.updatedAt })),
    ...state.resumeVersions.map((version) => ({ id: version.id, label: version.label || "Résumé version", detail: version.source === "tailor" ? "Tailored résumé" : "Guided résumé", href: "/versions", timestamp: version.createdAt }))
  ];
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export function intentMilestones(state: CommandCenterState): Array<{ label: string; complete: boolean }> {
  const approved = state.dossier.evidence.some((item) => item.approved && !item.rejected);
  const targetChosen = state.lanes.some((lane) => lane.status === "active") || state.applications.some((application) => application.analysisKeywords.length > 0 || application.analysisGaps.length > 0);
  return [
    { label: "Goal selected", complete: Boolean(state.activeGoal) },
    { label: "Work history added", complete: state.dossier.evidence.length > 0 || state.pendingImportReviews.length > 0 },
    { label: "Facts reviewed", complete: approved },
    { label: "Target role chosen", complete: targetChosen },
    { label: "Résumé ready", complete: state.resumePacks.length > 0 || state.resumeVersions.length > 0 },
    { label: "Application saved", complete: state.applications.length > 0 },
    { label: "Follow-up scheduled", complete: state.applications.some((application) => Boolean(application.nextFollowUpAt)) }
  ];
}
