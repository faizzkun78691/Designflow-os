/** Date/time helpers for the task UI. */
import { format, isToday, isTomorrow, isPast, differenceInCalendarDays } from "date-fns";

export interface TimeRemaining {
  label: string;
  overdue: boolean;
  urgent: boolean;
}

/** Compact "time remaining" label for a due date, e.g. "3d left", "Overdue by 2d". */
export function timeRemaining(dueIso: string | null): TimeRemaining | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const days = differenceInCalendarDays(due, now);

  if (isPast(due) && !isToday(due)) {
    const label =
      days === -1 ? "Overdue by 1d" : `Overdue by ${Math.abs(days)}d`;
    return { label, overdue: true, urgent: true };
  }
  if (isToday(due)) return { label: "Due today", overdue: false, urgent: true };
  if (isTomorrow(due))
    return { label: "Due tomorrow", overdue: false, urgent: true };
  if (days <= 7)
    return { label: `${days}d left`, overdue: false, urgent: days <= 2 };
  return { label: format(due, "MMM d, yyyy"), overdue: false, urgent: false };
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy · h:mm a");
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

/**
 * Convert a wall-clock date+time in an IANA timezone to a UTC ISO string.
 * Uses the standard Intl round-trip trick so DST is handled correctly.
 */
export function zonedDateTimeToISO(
  date: string,
  time: string,
  timeZone: string,
): string {
  const asUTC = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(asUTC)) throw new Error("Invalid date or time.");
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(asUTC))) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const hour = parts.hour === "24" ? "00" : (parts.hour ?? "00");
  const asTZ = Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute ?? "00"}:${parts.second ?? "00"}Z`,
  );
  if (Number.isNaN(asTZ)) throw new Error("Invalid date or time.");
  const offset = asTZ - asUTC;
  return new Date(asUTC - offset).toISOString();
}

/** Split an ISO string into {date, time} parts for datetime-local style inputs. */
export function splitISOToDateTime(iso: string | null): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") };
}

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { value: "Asia/Karachi", label: "Karachi (PKT, UTC+5)" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Kolkata", label: "Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST, UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
];

export const DEFAULT_TIMEZONE = "Asia/Karachi";
