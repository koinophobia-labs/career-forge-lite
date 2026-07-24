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
    return { status, appliedAt: null, nextFollowUpAt: null, interviewAt: null, updatedAt: nowIso };
  }

  if (status === "applied") {
    const enteringApplied = application.status !== "applied";
    return {
      status,
      // Returning to Applied schedules a new follow-up without rewriting the
      // original submission date.
      appliedAt: application.appliedAt ?? nowIso,
      nextFollowUpAt: enteringApplied
        ? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS)
        : application.nextFollowUpAt ?? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS),
      interviewAt: null,
      updatedAt: nowIso
    };
  }

  if (status === "interviewing" || status === "offer") {
    return {
      status,
      appliedAt: application.appliedAt ?? nowIso,
      nextFollowUpAt: null,
      updatedAt: nowIso
    };
  }

  return { status, nextFollowUpAt: null, updatedAt: nowIso };
}

export function applicationPriority(application: ApplicationRecord): number {
  return STATUS_PRIORITY[application.status];
}

export function linkedRoleSprintCount(state: CommandCenterState, applicationId: string): number {
  return state.roleSprints.filter((sprint) => sprint.applicationId === applicationId).length;
}

/**
 * Removes the job workspace while making the sprint outcome explicit.
 * Approved practice evidence is preserved. Pending/rejected evidence is removed
 * with deleted sprint records so it cannot become an orphaned dossier item.
 */
export function removeApplicationWorkspace(
  state: CommandCenterState,
  applicationId: string,
  mode: ApplicationRemovalMode
): CommandCenterState {
  const linkedSprints = state.roleSprints.filter((sprint) => sprint.applicationId === applicationId);
  const removableEvidenceIds = new Set(
    linkedSprints
      .map((sprint) => sprint.evidenceId)
      .filter((id): id is string => Boolean(id))
      .filter((id) => {
        const evidence = state.dossier.evidence.find((item) => item.id === id);
        return Boolean(evidence && !evidence.approved);
      })
  );

  const dossier = mode === "remove-sprints" && removableEvidenceIds.size
    ? {
        ...state.dossier,
        evidence: state.dossier.evidence.filter((item) => !removableEvidenceIds.has(item.id))
      }
    : state.dossier;

  return {
    ...state,
    dossier,
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
