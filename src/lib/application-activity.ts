import type { CommandCenterState } from "@/types/command-center";

export const APPLICATION_ACTIVITY_KEY = "career-forge-application-activity-v1";

type ActivityMap = Record<string, string>;

function readMap(): ActivityMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPLICATION_ACTIVITY_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function restoreApplicationActivity(state: CommandCenterState): CommandCenterState {
  const activity = readMap();
  return {
    ...state,
    applications: state.applications.map((application) => ({
      ...application,
      updatedAt: activity[application.id] ?? application.updatedAt ?? application.createdAt
    }))
  };
}

export function persistApplicationActivity(state: CommandCenterState): void {
  if (typeof window === "undefined") return;
  const activity = Object.fromEntries(state.applications.map((application) => [application.id, application.updatedAt ?? application.createdAt]));
  try {
    window.localStorage.setItem(APPLICATION_ACTIVITY_KEY, JSON.stringify(activity));
  } catch {
    // The main save-health warning handles quota failures. This index is
    // reconstructable from application creation timestamps if it cannot save.
  }
}
