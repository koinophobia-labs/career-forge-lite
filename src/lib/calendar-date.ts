const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar fields are dates, not instants. Keep them as YYYY-MM-DD so a date
 * chosen in Chicago cannot render as the previous day after UTC conversion.
 */
export function normalizeCalendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (DATE_ONLY.test(trimmed)) return trimmed;
  const isoDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
  return isoDate?.[1] ?? null;
}

export function calendarDateInputValue(value: string | null | undefined): string {
  return normalizeCalendarDate(value) ?? "";
}

export function formatCalendarDate(value: string | null | undefined): string {
  const normalized = normalizeCalendarDate(value);
  if (!normalized) return "—";
  const match = normalized.match(DATE_ONLY);
  if (!match) return "—";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayNumber(value: string | null | undefined): number | null {
  const normalized = normalizeCalendarDate(value);
  const match = normalized?.match(DATE_ONLY);
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

export type DeadlineState = "none" | "open" | "urgent" | "passed";

export function deadlineState(deadline: string | null | undefined, nowIso = new Date().toISOString()): DeadlineState {
  const deadlineDay = dayNumber(deadline);
  if (deadlineDay === null) return "none";
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) return "none";
  const nowDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const daysRemaining = deadlineDay - nowDay;
  if (daysRemaining < 0) return "passed";
  if (daysRemaining <= 2) return "urgent";
  return "open";
}
