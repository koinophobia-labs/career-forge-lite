import { normalizeCalendarDate } from "@/lib/calendar-date";
import type { ApplicationRecord } from "@/types/command-center";

function calendarDay(value: string | null | undefined): number | null {
  const date = normalizeCalendarDate(value);
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export type InterviewTiming = "upcoming" | "today" | "past" | "unscheduled";

export function interviewTiming(application: ApplicationRecord, nowIso = new Date().toISOString()): InterviewTiming {
  const interviewDay = calendarDay(application.interviewAt);
  if (interviewDay === null) return "unscheduled";
  const now = new Date(nowIso);
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  if (interviewDay < today) return "past";
  if (interviewDay === today) return "today";
  return "upcoming";
}

export function selectInterviewApplication(
  applications: ApplicationRecord[],
  requestedId?: string | null,
  nowIso = new Date().toISOString()
): ApplicationRecord | null {
  const interviewing = applications.filter((application) => application.status === "interviewing");
  const requested = requestedId ? interviewing.find((application) => application.id === requestedId) : null;
  if (requested) return requested;

  return [...interviewing].sort((a, b) => {
    const aTiming = interviewTiming(a, nowIso);
    const bTiming = interviewTiming(b, nowIso);
    const group = (timing: InterviewTiming) => timing === "today" ? 0 : timing === "upcoming" ? 1 : timing === "past" ? 2 : 3;
    const aGroup = group(aTiming);
    const bGroup = group(bTiming);
    if (aGroup !== bGroup) return aGroup - bGroup;
    const aDay = calendarDay(a.interviewAt);
    const bDay = calendarDay(b.interviewAt);
    if (aDay !== null && bDay !== null) return aGroup === 2 ? bDay - aDay : aDay - bDay;
    return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
  })[0] ?? null;
}
