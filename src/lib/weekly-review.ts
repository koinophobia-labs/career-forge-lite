import {
  applicationFollowUpsDue,
  applicationsMissingTailoredResume,
  outreachFollowUpsDue,
  WEEKLY_APPLICATION_TARGET
} from "@/lib/command-center-insights";
import { isProfileComplete, isProfileStarted } from "@/lib/command-center-store";
import type { CommandCenterState, NextBestAction } from "@/types/command-center";

// Weekly momentum review, computed live from stored timestamps. Two rolling
// windows: "this week" = the last 7 days, "last week" = the 7 days before
// that. Records revived without a real timestamp default to the 1970 epoch,
// which falls outside both windows — missing dates are simply not counted,
// never guessed.

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
export const STALE_LANE_DAYS = 14;

export type TrendDirection = "up" | "down" | "same" | "none";

export type WeeklyMetric = {
  key: string;
  label: string;
  thisWeek: number;
  lastWeek: number;
  trend: TrendDirection;
  detail: string;
};

export type StalledItem = {
  label: string;
  detail: string;
  href: string;
};

export type WeeklyReview = {
  metrics: WeeklyMetric[];
  moves: [NextBestAction, NextBestAction, NextBestAction];
  stalled: StalledItem[];
  totalThisWeek: number;
  hasAnyData: boolean;
  hasApplications: boolean;
};

function inWindow(iso: string | null, startMs: number, endMs: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time >= startMs && time < endMs;
}

function trendFor(thisWeek: number, lastWeek: number): TrendDirection {
  if (thisWeek === 0 && lastWeek === 0) return "none";
  if (thisWeek > lastWeek) return "up";
  if (thisWeek < lastWeek) return "down";
  return "same";
}

function metric(key: string, label: string, detail: string, thisWeek: number, lastWeek: number): WeeklyMetric {
  return { key, label, detail, thisWeek, lastWeek, trend: trendFor(thisWeek, lastWeek) };
}

export function computeWeeklyMetrics(state: CommandCenterState, nowIso: string): WeeklyMetric[] {
  const now = new Date(nowIso).getTime();
  const thisStart = now - WEEK_MS;
  const lastStart = now - 2 * WEEK_MS;

  const count = <T>(items: T[], pick: (item: T) => string | null) => ({
    thisWeek: items.filter((item) => inWindow(pick(item), thisStart, now)).length,
    lastWeek: items.filter((item) => inWindow(pick(item), lastStart, thisStart)).length
  });

  const appsAdded = count(state.applications, (app) => app.createdAt);
  const appsSent = count(state.applications, (app) => app.appliedAt);
  const tailored = count(
    state.resumeVersions.filter((version) => version.source === "tailor"),
    (version) => version.createdAt
  );
  const versions = count(state.resumeVersions, (version) => version.createdAt);
  const contactsAdded = count(state.outreach, (contact) => contact.createdAt);
  const contactsMessaged = count(state.outreach, (contact) => contact.lastContactedAt);
  const interviews = count(state.applications, (app) => app.interviewAt);
  // Completed follow-ups come only from the durable followUpsSent log — due
  // dates never count as completions.
  const followUpTimestamps = state.applications.flatMap((app) => app.followUpsSent ?? []);
  const followUpsCompleted = {
    thisWeek: followUpTimestamps.filter((iso) => inWindow(iso, thisStart, now)).length,
    lastWeek: followUpTimestamps.filter((iso) => inWindow(iso, lastStart, thisStart)).length
  };

  return [
    metric("apps_sent", "Applications sent", `target: ${WEEKLY_APPLICATION_TARGET}/week`, appsSent.thisWeek, appsSent.lastWeek),
    metric(
      "follow_ups_completed",
      "Follow-ups completed",
      "application follow-ups you actually sent",
      followUpsCompleted.thisWeek,
      followUpsCompleted.lastWeek
    ),
    metric("apps_added", "Applications added", "tracked in the pipeline", appsAdded.thisWeek, appsAdded.lastWeek),
    metric("tailored_resumes", "Tailored resumes", "built from a specific posting", tailored.thisWeek, tailored.lastWeek),
    metric("resume_versions", "Resume versions", "all versions generated", versions.thisWeek, versions.lastWeek),
    metric("outreach_added", "Outreach contacts added", "new people queued", contactsAdded.thisWeek, contactsAdded.lastWeek),
    metric(
      "outreach_messaged",
      "Contacts messaged",
      "latest touch in the window",
      contactsMessaged.thisWeek,
      contactsMessaged.lastWeek
    ),
    metric("interviews", "Interviews scheduled", "by interview date", interviews.thisWeek, interviews.lastWeek)
  ];
}

export function detectStalled(state: CommandCenterState, nowIso: string): StalledItem[] {
  const stalled: StalledItem[] = [];
  const now = new Date(nowIso).getTime();

  const untailored = applicationsMissingTailoredResume(state);
  if (untailored.length) {
    stalled.push({
      label: `${untailored.length} active application${untailored.length === 1 ? "" : "s"} with no tailored resume`,
      detail: `${untailored
        .slice(0, 3)
        .map((app) => `${app.roleTitle} @ ${app.company}`)
        .join(", ")}${untailored.length > 3 ? "…" : ""} — run each through the tailoring engine.`,
      href: "/tailor"
    });
  }

  const appFollowUps = applicationFollowUpsDue(state, nowIso);
  const contactFollowUps = outreachFollowUpsDue(state, nowIso);
  const dueCount = appFollowUps.length + contactFollowUps.length;
  if (dueCount) {
    stalled.push({
      label: `${dueCount} follow-up${dueCount === 1 ? "" : "s"} overdue`,
      detail: "Silence reads as disinterest. Each one is a two-minute message.",
      href: appFollowUps.length ? "/applications" : "/outreach"
    });
  }

  const interviewing = state.applications.filter((app) => app.status === "interviewing");
  if (interviewing.length) {
    stalled.push({
      label: `${interviewing.length} interview${interviewing.length === 1 ? "" : "s"} in play — rehearse before, not during`,
      detail: `${interviewing
        .slice(0, 3)
        .map((app) => `${app.roleTitle} @ ${app.company}`)
        .join(", ")} — run interview prep against the lane and its gap defenses.`,
      href: "/interview"
    });
  }

  const staleLanes = state.lanes.filter(
    (lane) =>
      lane.status === "active" &&
      !state.applications.some(
        (app) => app.laneId === lane.id && inWindow(app.createdAt, now - STALE_LANE_DAYS * DAY_MS, now)
      )
  );
  if (staleLanes.length) {
    stalled.push({
      label: `${staleLanes.length} active lane${staleLanes.length === 1 ? "" : "s"} with no applications in ${STALE_LANE_DAYS} days`,
      detail: `${staleLanes.map((lane) => lane.title).join(", ")} — apply into ${staleLanes.length === 1 ? "it" : "them"} or pause ${staleLanes.length === 1 ? "it" : "them"} deliberately.`,
      href: "/targets"
    });
  }

  return stalled;
}

function applicationMove(state: CommandCenterState, nowIso: string): NextBestAction {
  const untailored = applicationsMissingTailoredResume(state);
  if (untailored.length) {
    const next = untailored[0];
    return {
      title: `Tailor a resume for ${next.company}`,
      detail: `${next.roleTitle} is active with a generic resume. Run its posting through the tailoring engine and generate the version.`,
      href: "/tailor",
      actionLabel: "Tailor it"
    };
  }
  const now = new Date(nowIso).getTime();
  const sentThisWeek = state.applications.filter((app) => inWindow(app.appliedAt, now - WEEK_MS, now)).length;
  if (sentThisWeek < WEEKLY_APPLICATION_TARGET) {
    return {
      title: `Send ${WEEKLY_APPLICATION_TARGET - sentThisWeek} more application${WEEKLY_APPLICATION_TARGET - sentThisWeek === 1 ? "" : "s"} this week`,
      detail: `You're at ${sentThisWeek} of ${WEEKLY_APPLICATION_TARGET}. Paste the next posting into the tailoring engine — analysis to submission in one sitting.`,
      href: "/tailor",
      actionLabel: "Start the next one"
    };
  }
  return {
    title: "Application pace is on target — hold it",
    detail: `${sentThisWeek} sent in the last 7 days. Queue next week's postings now so Monday starts warm.`,
    href: "/tailor",
    actionLabel: "Queue the next posting"
  };
}

function outreachMove(state: CommandCenterState, nowIso: string): NextBestAction {
  const appFollowUps = applicationFollowUpsDue(state, nowIso);
  if (appFollowUps.length) {
    const next = appFollowUps[0];
    return {
      title: `Follow up on ${next.company}`,
      detail: `The ${next.roleTitle} application is past its follow-up date. Short, specific, sent today.`,
      href: "/applications",
      actionLabel: "Send the follow-up"
    };
  }
  const contactFollowUps = outreachFollowUpsDue(state, nowIso);
  if (contactFollowUps.length) {
    const next = contactFollowUps[0];
    return {
      title: `Nudge ${next.name || "your contact"}${next.company ? ` at ${next.company}` : ""}`,
      detail: "No reply yet — one polite follow-up roughly doubles response rates.",
      href: "/outreach",
      actionLabel: "Send follow-up"
    };
  }
  const planned = state.outreach.filter((contact) => contact.status === "planned");
  if (planned.length) {
    return {
      title: `Send your queued message to ${planned[0].name || "your planned contact"}`,
      detail: "It's written into the templates already — personalize the brackets and send.",
      href: "/outreach",
      actionLabel: "Open outreach"
    };
  }
  return {
    title: "Queue two people at companies you applied to",
    detail: "Find the recruiter or a team member for your most recent applications and add them with the right relationship type.",
    href: "/outreach",
    actionLabel: "Add contacts"
  };
}

function prepMove(state: CommandCenterState): NextBestAction {
  const interviewing = state.applications.find((app) => app.status === "interviewing");
  if (interviewing) {
    return {
      title: `Rehearse for ${interviewing.company}`,
      detail: `Run interview prep against the ${interviewing.roleTitle} application — the gap-defense answers are the ones worth practicing out loud.`,
      href: "/interview",
      actionLabel: "Open prep"
    };
  }
  if (!isProfileComplete(state.profile)) {
    return {
      title: "Strengthen your profile",
      detail: "Tailoring, interview prep, and outreach all sharpen with more real material — add proof points and skills.",
      href: "/profile",
      actionLabel: "Open profile"
    };
  }
  return {
    title: "Practice one gap-defense answer",
    detail: "Pick your active lane in interview prep and draft one honest gap answer with the coach. Ten minutes now beats improvising later.",
    href: "/interview",
    actionLabel: "Practice now"
  };
}

export function computeWeeklyReview(state: CommandCenterState, nowIso: string): WeeklyReview {
  const metrics = computeWeeklyMetrics(state, nowIso);
  const totalThisWeek = metrics.reduce((sum, item) => sum + item.thisWeek, 0);

  return {
    metrics,
    moves: [applicationMove(state, nowIso), outreachMove(state, nowIso), prepMove(state)],
    stalled: detectStalled(state, nowIso),
    totalThisWeek,
    hasAnyData:
      isProfileStarted(state.profile) ||
      state.lanes.length > 0 ||
      state.applications.length > 0 ||
      state.outreach.length > 0 ||
      state.resumeVersions.length > 0,
    hasApplications: state.applications.length > 0
  };
}

// Dashboard nudge: the user has an established search but this week is quiet.
export function isMomentumLow(state: CommandCenterState, nowIso: string): boolean {
  const established = state.applications.length + state.resumeVersions.length + state.outreach.length >= 2;
  if (!established) return false;
  const totalThisWeek = computeWeeklyMetrics(state, nowIso).reduce((sum, item) => sum + item.thisWeek, 0);
  return totalThisWeek < 2;
}
