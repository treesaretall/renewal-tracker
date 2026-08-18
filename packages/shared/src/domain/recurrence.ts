import type { IsoDate, Recurrence } from "../schemas/primitives.js";
import { addMonthsIso, isBeforeIso } from "./dates.js";

/**
 * Maps recurrence types to their interval in months.
 * - null means the recurrence type is not applicable (none) or needs a custom value (custom)
 */
export const MONTHS_BY_RECURRENCE: Record<Recurrence, number | null> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  none: null,
  custom: null,
};

export interface RecurrenceInput {
  recurrence: Recurrence;
  recurrenceMonths: number | null | undefined;
}

/**
 * Returns the recurrence interval in months.
 * - Returns null for "none" (non-recurring items)
 * - For "custom", returns the recurrenceMonths value
 * - For standard recurrence types, returns the fixed interval
 */
export function recurrenceIntervalMonths(
  recurrence: Recurrence,
  recurrenceMonths: number | null | undefined
): number | null {
  if (recurrence === "none") {
    return null;
  }

  if (recurrence === "custom") {
    return recurrenceMonths ?? null;
  }

  return MONTHS_BY_RECURRENCE[recurrence];
}

export interface NextDueDateInput {
  dueDate: IsoDate;
  recurrence: Recurrence;
  recurrenceMonths: number | null | undefined;
}

/**
 * Calculates the next due date by rolling forward one recurrence interval.
 * Returns null for non-recurring items ("none").
 *
 * Note: Month-end dates may clamp when rolling forward. For example,
 * 2026-01-31 + 1 month = 2026-02-28, then 2026-02-28 + 1 month = 2026-03-28.
 * The day-of-month does not "heal" back to 31. This is the accepted trade-off
 * for using calendar arithmetic.
 */
export function nextDueDate(input: NextDueDateInput): IsoDate | null {
  const { dueDate, recurrence, recurrenceMonths } = input;

  const intervalMonths = recurrenceIntervalMonths(recurrence, recurrenceMonths);

  if (intervalMonths === null) {
    return null;
  }

  return addMonthsIso(dueDate, intervalMonths);
}

export interface CatchUpDueDateInput {
  dueDate: IsoDate;
  recurrence: Recurrence;
  recurrenceMonths: number | null | undefined;
  today: IsoDate;
}

/**
 * Repeatedly advances the due date until it is >= today.
 * This handles reopening the app after months away without producing
 * a date still in the past.
 *
 * Returns null for non-recurring items ("none").
 *
 * Throws an error if 1000 iterations are exceeded (prevents infinite loops
 * from zero or negative intervals).
 */
export function catchUpDueDate(input: CatchUpDueDateInput): IsoDate | null {
  const { dueDate, recurrence, recurrenceMonths, today } = input;

  const intervalMonths = recurrenceIntervalMonths(recurrence, recurrenceMonths);

  if (intervalMonths === null) {
    return null;
  }

  let currentDate = dueDate;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (isBeforeIso(currentDate, today)) {
    iterations++;

    if (iterations > MAX_ITERATIONS) {
      throw new Error(
        `catchUpDueDate exceeded ${MAX_ITERATIONS} iterations. ` +
          `This likely indicates a zero or negative recurrence interval. ` +
          `recurrence=${recurrence}, recurrenceMonths=${recurrenceMonths}, ` +
          `dueDate=${dueDate}, today=${today}`
      );
    }

    currentDate = addMonthsIso(currentDate, intervalMonths);
  }

  return currentDate;
}

/**
 * Returns a human-readable description of the recurrence pattern.
 *
 * Examples:
 * - "Every year" (annual)
 * - "Every 3 months" (quarterly)
 * - "Every 18 months" (custom)
 * - "One-off" (none)
 */
export function describeRecurrence(
  recurrence: Recurrence,
  recurrenceMonths: number | null | undefined
): string {
  if (recurrence === "none") {
    return "One-off";
  }

  const intervalMonths = recurrenceIntervalMonths(recurrence, recurrenceMonths);

  if (intervalMonths === null) {
    return "One-off";
  }

  if (intervalMonths === 12) {
    return "Every year";
  }

  if (intervalMonths === 1) {
    return "Every month";
  }

  return `Every ${intervalMonths} months`;
}
