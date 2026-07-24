import { normalizeCalendarDate } from "@/lib/calendar-date";
import type { ApplicationRecord } from "@/types/command-center";

function calendarDay(value: string | null | undefined): number | null {
  const date = normalizeCalendarDate(value);
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function selectInterviewApplication(
  applications: ApplicationRecord[],
  requestedId?: string | null,
  nowIso = new Date().toISOString()
): ApplicationRecord | null {
  const interviewing = applications.filter((application) => application.status === "interviewing");
  const requested = requestedId ? interviewing.find((application) => application.id === requestedId) : null;
  if (requested) return requested;

  const now = new Date(nowIso);
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return [...interviewing].sort((a, b) => {
    const aDay = calendarDay(a.interviewAt);
    const bDay = calendarDay(b.interviewAt);
    const aGroup = aDay === null ? 1 : aDay >= today ? 0 : 2;
    const bGroup = bDay === null ? 1 : bDay >= today ? 0 : 2;
    if (aGroup !== bGroup) return aGroup - bGroup;
    if (aDay !== null && bDay !== null) return aGroup === 2 ? bDay - aDay : aDay - bDay;
    return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
  })[0] ?? null;
}
