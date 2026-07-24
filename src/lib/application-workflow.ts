import type { ApplicationRecord, ApplicationStatus, CommandCenterState } from "@/types/command-center";

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
