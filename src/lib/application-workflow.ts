import type { ApplicationRecord, ApplicationStatus, CommandCenterState } from "@/types/command-center";
import { APPLICATION_FOLLOW_UP_DAYS, addDays } from "@/lib/command-center-insights";

export type ApplicationRemovalMode = "keep-sprints" | "remove-sprints";

const STATUS_PRIORITY: Record<ApplicationStatus, number> = {
  offer: 0,
  interviewing: 1,
  applied: 2,
  drafting: 3,
  rejected: 4,
  closed: 5
};

/** Auto-saving a workspace must never move a live application backward. */
export function statusForWorkspaceSave(
  existingStatus: ApplicationStatus | undefined,
  requestedStatus: "drafting" | "applied"
): ApplicationStatus {
  if (!existingStatus) return requestedStatus;
  if (requestedStatus === "drafting") return existingStatus;
  if (existingStatus === "offer" || existingStatus === "interviewing") return existingStatus;
  return "applied";
}

/**
 * Keeps dates consistent with the selected stage. Only explicit status changes
 * call this helper; background workspace saves use statusForWorkspaceSave.
 */
export function applicationStatusPatch(
  application: ApplicationRecord,
  status: ApplicationStatus,
  nowIso: string
): Partial<ApplicationRecord> {
  if (status === "drafting") {
    return { status, appliedAt: null, nextFollowUpAt: null, interviewAt: null };
  }

  if (status === "applied") {
    const enteringApplied = application.status !== "applied";
    return {
      status,
      appliedAt: enteringApplied ? nowIso : application.appliedAt ?? nowIso,
      nextFollowUpAt: enteringApplied
        ? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS)
        : application.nextFollowUpAt ?? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS),
      interviewAt: null
    };
  }

  if (status === "interviewing") {
    return {
      status,
      appliedAt: application.appliedAt ?? nowIso,
      nextFollowUpAt: null
    };
  }

  if (status === "offer") {
    return {
      status,
      appliedAt: application.appliedAt ?? nowIso,
      nextFollowUpAt: null
    };
  }

  return { status, nextFollowUpAt: null };
}

export function applicationPriority(application: ApplicationRecord): number {
  return STATUS_PRIORITY[application.status];
}

export function linkedRoleSprintCount(state: CommandCenterState, applicationId: string): number {
  return state.roleSprints.filter((sprint) => sprint.applicationId === applicationId).length;
}

/**
 * Removes the job workspace while making the sprint outcome explicit.
 * Practice evidence is preserved because it may already support a résumé.
 */
export function removeApplicationWorkspace(
  state: CommandCenterState,
  applicationId: string,
  mode: ApplicationRemovalMode
): CommandCenterState {
  return {
    ...state,
    applications: state.applications.filter((application) => application.id !== applicationId),
    roleSprints: mode === "remove-sprints"
      ? state.roleSprints.filter((sprint) => sprint.applicationId !== applicationId)
      : state.roleSprints.map((sprint) =>
          sprint.applicationId === applicationId
            ? { ...sprint, applicationId: null, updatedAt: new Date().toISOString() }
            : sprint
        )
  };
}
