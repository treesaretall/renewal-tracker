import type { IsoDate, RenewalStatus } from "../schemas/primitives.js";
import { differenceInDaysIso } from "./dates.js";

export interface ComputeStatusInput {
  dueDate: IsoDate;
  leadTimeDays: number;
  today: IsoDate;
}

/**
 * Computes the renewal status based on due date and lead time.
 *
 * Rules:
 * - "overdue": dueDate < today
 * - "due-soon": dueDate >= today AND daysUntil <= leadTimeDays (inclusive)
 * - "upcoming": daysUntil > leadTimeDays
 *
 * Note: Due today is "due-soon", not "overdue".
 */
export function computeStatus(input: ComputeStatusInput): RenewalStatus {
  const { dueDate, leadTimeDays, today } = input;
  const daysUntil = differenceInDaysIso(dueDate, today);

  if (daysUntil < 0) {
    return "overdue";
  }

  if (daysUntil <= leadTimeDays) {
    return "due-soon";
  }

  return "upcoming";
}

export interface DaysUntilDueInput {
  dueDate: IsoDate;
  today: IsoDate;
}

/**
 * Returns the number of days until the due date.
 * Negative values indicate the item is overdue.
 */
export function daysUntilDue(input: DaysUntilDueInput): number {
  return differenceInDaysIso(input.dueDate, input.today);
}

/**
 * Returns a human-readable description of when something is due.
 *
 * Examples:
 * - "Overdue by 3 days" (negative)
 * - "Due today" (0)
 * - "Due tomorrow" (1)
 * - "Due in 2 days" (2-59)
 * - "Due in 3 months" (60+)
 *
 * Switches to month granularity past 60 days.
 * Handles singular/plural correctly.
 */
export function describeDueDate(input: DaysUntilDueInput): string {
  const days = daysUntilDue(input);

  if (days < 0) {
    const overdueDays = Math.abs(days);
    return `Overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}`;
  }

  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "Due tomorrow";
  }

  if (days <= 59) {
    return `Due in ${days} days`;
  }

  // Switch to month granularity for 60+ days
  const months = Math.round(days / 30);
  return `Due in ${months} ${months === 1 ? "month" : "months"}`;
}

/**
 * Canonical ordering for renewal statuses.
 * Most urgent (overdue) first, least urgent (upcoming) last.
 */
export const STATUS_ORDER: readonly RenewalStatus[] = [
  "overdue",
  "due-soon",
  "upcoming",
] as const;

export interface ItemForUrgencySort {
  status: RenewalStatus;
  dueDate: IsoDate;
  name: string;
}

/**
 * Comparator for sorting items by urgency.
 *
 * Sort order:
 * 1. By status (overdue > due-soon > upcoming) using STATUS_ORDER
 * 2. By dueDate ascending (earliest first)
 * 3. By name alphabetically
 *
 * Use this everywhere a list needs urgency ordering to ensure
 * the dashboard and sidebar never disagree.
 */
export function compareByUrgency(
  a: ItemForUrgencySort,
  b: ItemForUrgencySort
): number {
  // Compare by status order first
  const aStatusIndex = STATUS_ORDER.indexOf(a.status);
  const bStatusIndex = STATUS_ORDER.indexOf(b.status);

  if (aStatusIndex !== bStatusIndex) {
    return aStatusIndex - bStatusIndex;
  }

  // Same status, compare by due date (ascending - earlier dates first)
  if (a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  // Same status and due date, compare by name
  return a.name.localeCompare(b.name);
}
