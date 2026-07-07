import { isProfileComplete, isProfileStarted } from "@/lib/command-center-store";
import type {
  ApplicationRecord,
  CommandCenterState,
  NextBestAction,
  OutreachContact
} from "@/types/command-center";

const DAY_MS = 24 * 60 * 60 * 1000;

export const APPLICATION_FOLLOW_UP_DAYS = 5;
export const OUTREACH_FOLLOW_UP_DAYS = 4;
export const MAX_OUTREACH_FOLLOW_UPS = 2;
export const WEEKLY_APPLICATION_TARGET = 5;

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function isDue(dueIso: string | null, nowIso: string): boolean {
  if (!dueIso) return false;
  return new Date(dueIso).getTime() <= new Date(nowIso).getTime();
}

// Marks an application follow-up as actually sent: records the completion
// timestamp durably AND reschedules the next follow-up, preserving the
// existing cadence behavior.
export function logApplicationFollowUp(app: ApplicationRecord, nowIso: string): ApplicationRecord {
  return {
    ...app,
    followUpsSent: [...(app.followUpsSent ?? []), nowIso],
    nextFollowUpAt: addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS)
  };
}

export function applicationFollowUpsDue(state: CommandCenterState, nowIso: string): ApplicationRecord[] {
  return state.applications
    .filter((app) => app.status === "applied" && isDue(app.nextFollowUpAt, nowIso))
    .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""));
}

export function outreachFollowUpsDue(state: CommandCenterState, nowIso: string): OutreachContact[] {
  return state.outreach
    .filter(
      (contact) =>
        contact.status === "sent" &&
        contact.followUpCount < MAX_OUTREACH_FOLLOW_UPS &&
        isDue(contact.nextFollowUpAt, nowIso)
    )
    .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""));
}

// Active applications (in play, not closed out) that have no resume version
// attached — candidates for a tailored resume session.
export function applicationsMissingTailoredResume(state: CommandCenterState): ApplicationRecord[] {
  const activeStatuses: ApplicationRecord["status"][] = ["drafting", "applied", "interviewing"];
  return state.applications.filter((app) => activeStatuses.includes(app.status) && !app.resumeVersionId);
}

export function upcomingInterviews(state: CommandCenterState, nowIso: string): ApplicationRecord[] {
  const now = new Date(nowIso).getTime();
  return state.applications
    .filter((app) => app.status === "interviewing" && app.interviewAt && new Date(app.interviewAt).getTime() >= now - DAY_MS)
    .sort((a, b) => (a.interviewAt ?? "").localeCompare(b.interviewAt ?? ""));
}

export function applicationsSentInLastDays(state: CommandCenterState, nowIso: string, days: number): number {
  const cutoff = new Date(nowIso).getTime() - days * DAY_MS;
  return state.applications.filter(
    (app) => app.appliedAt && new Date(app.appliedAt).getTime() >= cutoff && app.status !== "drafting"
  ).length;
}

export type DashboardStats = {
  activeLanes: number;
  applicationsSent: number;
  applicationsThisWeek: number;
  followUpsDue: number;
  interviews: number;
  resumeVersions: number;
  outreachInFlight: number;
};

export function computeDashboardStats(state: CommandCenterState, nowIso: string): DashboardStats {
  return {
    activeLanes: state.lanes.filter((lane) => lane.status !== "paused").length,
    applicationsSent: state.applications.filter((app) => app.status !== "drafting").length,
    applicationsThisWeek: applicationsSentInLastDays(state, nowIso, 7),
    followUpsDue: applicationFollowUpsDue(state, nowIso).length + outreachFollowUpsDue(state, nowIso).length,
    interviews: state.applications.filter((app) => app.status === "interviewing").length,
    resumeVersions: state.resumeVersions.length,
    outreachInFlight: state.outreach.filter((contact) => contact.status === "sent" || contact.status === "replied").length
  };
}

export function getNextBestAction(state: CommandCenterState, nowIso: string): NextBestAction {
  if (!isProfileStarted(state.profile)) {
    return {
      title: "Build your career profile",
      detail:
        "Everything downstream — target lanes, resume angles, tailored applications, outreach messages — is built from your profile. Ten minutes here pays off everywhere else.",
      href: "/profile",
      actionLabel: "Start profile"
    };
  }

  if (!state.lanes.length) {
    return {
      title: "Pick your first target lane",
      detail:
        "A lane is a role family you're actively pursuing. Choosing 2–3 lanes focuses every resume, application, and outreach message you send.",
      href: "/targets",
      actionLabel: "Choose lanes"
    };
  }

  const interviews = upcomingInterviews(state, nowIso);
  if (interviews.length) {
    const next = interviews[0];
    return {
      title: `Prep for your ${next.company} interview`,
      detail: `${next.roleTitle} at ${next.company}. Run Interview Mode against this lane's likely questions and review your proof points before the call.`,
      href: "/interview",
      actionLabel: "Open interview prep"
    };
  }

  const appFollowUps = applicationFollowUpsDue(state, nowIso);
  const contactFollowUps = outreachFollowUpsDue(state, nowIso);
  if (appFollowUps.length) {
    const next = appFollowUps[0];
    return {
      title: `Follow up on ${next.company}`,
      detail: `Your ${next.roleTitle} application is past its follow-up date. A short, specific nudge keeps you visible without being annoying.`,
      href: "/applications",
      actionLabel: "Log follow-up"
    };
  }
  if (contactFollowUps.length) {
    const next = contactFollowUps[0];
    return {
      title: `Follow up with ${next.name || "your contact"}`,
      detail: `No reply yet from ${next.name || "this contact"}${next.company ? ` at ${next.company}` : ""}. One polite follow-up roughly doubles response rates.`,
      href: "/outreach",
      actionLabel: "Send follow-up"
    };
  }

  const drafting = state.applications.filter((app) => app.status === "drafting");
  if (drafting.length) {
    const next = drafting[0];
    return {
      title: `Finish and send: ${next.roleTitle} at ${next.company}`,
      detail: "A drafted application earns nothing until it's sent. Tailor the resume against the job post and submit it today.",
      href: "/applications",
      actionLabel: "Open applications"
    };
  }

  if (!isProfileComplete(state.profile)) {
    return {
      title: "Finish your career profile",
      detail:
        "Your profile is started but thin. Add transferable skills and an experience summary so the tailoring engine has real material to work with.",
      href: "/profile",
      actionLabel: "Complete profile"
    };
  }

  if (applicationsSentInLastDays(state, nowIso, 7) < WEEKLY_APPLICATION_TARGET) {
    return {
      title: "Tailor and send an application",
      detail: `You've sent ${applicationsSentInLastDays(state, nowIso, 7)} of ${WEEKLY_APPLICATION_TARGET} target applications this week. Paste a job post into the tailoring engine and get a specific, honest angle for it.`,
      href: "/tailor",
      actionLabel: "Tailor a resume"
    };
  }

  const planned = state.outreach.filter((contact) => contact.status === "planned");
  if (planned.length) {
    const next = planned[0];
    return {
      title: `Send your message to ${next.name || "your planned contact"}`,
      detail: "You've queued this contact but haven't reached out. Applications get you in the pile; outreach gets you out of it.",
      href: "/outreach",
      actionLabel: "Open outreach"
    };
  }

  return {
    title: "Add outreach targets for your active lanes",
    detail:
      "Application pace is on target. The next multiplier is people: find 2–3 recruiters or team members at companies you've applied to and queue outreach.",
    href: "/outreach",
    actionLabel: "Plan outreach"
  };
}
