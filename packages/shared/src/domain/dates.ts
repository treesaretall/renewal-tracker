import {
  parseISO,
  format,
  addDays,
  addMonths,
  differenceInDays,
  isBefore,
  isAfter,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
} from "date-fns";
import type { IsoDate } from "../schemas/primitives.js";

/**
 * Internal helper: converts an ISO date string to a Date object.
 * Only used within this module to interface with date-fns.
 * Not exported from the barrel.
 */
function toDate(iso: IsoDate): Date {
  return parseISO(iso);
}

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD).
 */
export function toIso(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd") as IsoDate;
}

/**
 * Gets today's date as an ISO string.
 * Takes the current time as an argument to avoid reading the clock internally.
 */
export function todayIso(now: Date): IsoDate {
  return toIso(now);
}

/**
 * Adds the specified number of days to a date.
 */
export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  return toIso(addDays(toDate(iso), days));
}

/**
 * Adds the specified number of months to a date.
 * Month-end dates are clamped to the last valid day of the target month.
 * Example: 2026-01-31 + 1 month = 2026-02-28 (not 2026-03-03)
 * Example: 2026-08-31 + 6 months = 2027-02-28
 */
export function addMonthsIso(iso: IsoDate, months: number): IsoDate {
  return toIso(addMonths(toDate(iso), months));
}

/**
 * Returns the whole number of calendar days from b to a, with sign preserved.
 * Positive if a is after b, negative if a is before b.
 * Always returns a whole number of days regardless of DST transitions.
 */
export function differenceInDaysIso(a: IsoDate, b: IsoDate): number {
  return differenceInDays(toDate(a), toDate(b));
}

/**
 * Compares two ISO dates for sorting.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 * Safe for Array.sort because ISO date strings (YYYY-MM-DD) sort lexicographically.
 */
export function compareIso(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Returns true if the first date is before the second date.
 */
export function isBeforeIso(a: IsoDate, b: IsoDate): boolean {
  return isBefore(toDate(a), toDate(b));
}

/**
 * Returns true if the first date is after the second date.
 */
export function isAfterIso(a: IsoDate, b: IsoDate): boolean {
  return isAfter(toDate(a), toDate(b));
}

/**
 * Returns true if the two dates are the same day.
 */
export function isSameIso(a: IsoDate, b: IsoDate): boolean {
  return isSameDay(toDate(a), toDate(b));
}

/**
 * Returns the start of the month for the given date.
 */
export function startOfMonthIso(iso: IsoDate): IsoDate {
  return toIso(startOfMonth(toDate(iso)));
}

/**
 * Returns the end of the month for the given date.
 */
export function endOfMonthIso(iso: IsoDate): IsoDate {
  return toIso(endOfMonth(toDate(iso)));
}

/**
 * Returns the start of the week for the given date.
 * @param weekStartsOn 0 = Sunday, 1 = Monday, etc.
 */
export function startOfWeekIso(
  iso: IsoDate,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
): IsoDate {
  return toIso(startOfWeek(toDate(iso), { weekStartsOn }));
}

/**
 * Returns the end of the week for the given date.
 * @param weekStartsOn 0 = Sunday, 1 = Monday, etc.
 */
export function endOfWeekIso(
  iso: IsoDate,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
): IsoDate {
  return toIso(endOfWeek(toDate(iso), { weekStartsOn }));
}

/**
 * Returns the start of the year for the given date.
 */
export function startOfYearIso(iso: IsoDate): IsoDate {
  return toIso(startOfYear(toDate(iso)));
}

/**
 * Returns the end of the year for the given date.
 */
export function endOfYearIso(iso: IsoDate): IsoDate {
  return toIso(endOfYear(toDate(iso)));
}

/**
 * Formats an ISO date string for display.
 * Uses date-fns format patterns.
 * @param pattern e.g., "MMM d, yyyy" for "Jan 1, 2026"
 */
export function formatIso(iso: IsoDate, pattern: string): string {
  return format(toDate(iso), pattern);
}

/**
 * Returns true if the date is within the given range (inclusive on both ends).
 */
export function isWithinRangeIso(
  iso: IsoDate,
  from: IsoDate,
  to: IsoDate
): boolean {
  return isWithinInterval(toDate(iso), {
    start: toDate(from),
    end: toDate(to),
  });
}
