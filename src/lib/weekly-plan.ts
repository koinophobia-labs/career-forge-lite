import {
  applicationFollowUpsDue,
  computeDashboardStats,
  outreachFollowUpsDue,
  WEEKLY_APPLICATION_TARGET
} from "@/lib/command-center-insights";
import { isProfileComplete } from "@/lib/command-center-store";
import type { CommandCenterState } from "@/types/command-center";

export type WeeklyPlanItem = {
  title: string;
  detail: string;
  href: string;
};

// Deterministic, forward-looking weekly plan computed from real state — the
// onboarding artifact for a new user and the standing "what do I do this
// week" list for an active one. Always 3–5 concrete items, most urgent first.
export function buildWeeklyPlan(state: CommandCenterState, nowIso: string): WeeklyPlanItem[] {
  const items: WeeklyPlanItem[] = [];
  const stats = computeDashboardStats(state, nowIso);
  const followUpsDue = applicationFollowUpsDue(state, nowIso).length + outreachFollowUpsDue(state, nowIso).length;

  if (!isProfileComplete(state.profile)) {
    items.push({
      title: "Finish your profile",
      detail: "Situation, target roles, 3+ transferable skills, and proof points — everything downstream feeds on this.",
      href: "/profile"
    });
  }

  if (state.lanes.length < 2) {
    items.push({
      title: "Pick your target lanes",
      detail: "Choose 2–3 role lanes from the library so every job post gets matched against a real strategy.",
      href: "/targets"
    });
  }

  if (followUpsDue > 0) {
    items.push({
      title: `Clear ${followUpsDue} follow-up${followUpsDue === 1 ? "" : "s"} due now`,
      detail: "Follow-ups are the cheapest wins in the whole search — send them before anything else today.",
      href: "/applications"
    });
  }

  const remainingApps = Math.max(WEEKLY_APPLICATION_TARGET - stats.applicationsThisWeek, 0);
  if (remainingApps > 0) {
    items.push({
      title: `Send ${remainingApps} more application${remainingApps === 1 ? "" : "s"} this week`,
      detail: `Target is ${WEEKLY_APPLICATION_TARGET}/week. Paste a post into Tailor — analysis, resume lane, brief, and outreach message in one pass.`,
      href: "/tailor"
    });
  }

  if (stats.interviews > 0) {
    items.push({
      title: "Prep for your live interview",
      detail: "Run the prep pack against the saved application — gap-defense answers are built from its real analysis.",
      href: "/interview"
    });
  }

  if (state.applications.length > 0 && stats.outreachInFlight === 0) {
    items.push({
      title: "Open one outreach conversation",
      detail: "Applications with a human attached get answered. Send one recruiter or hiring-manager message.",
      href: "/outreach"
    });
  }

  const evergreen: WeeklyPlanItem[] = [
    {
      title: "Paste one job post into Tailor",
      detail: "Even a stretch posting sharpens your keyword coverage and produces a reusable brief.",
      href: "/tailor"
    },
    {
      title: "Rehearse one interview answer out loud",
      detail: "The answer coach flags rambling, missing numbers, and weak endings before an interviewer does.",
      href: "/interview"
    }
  ];
  for (const item of evergreen) {
    if (items.length >= 3) break;
    items.push(item);
  }

  return items.slice(0, 5);
}
