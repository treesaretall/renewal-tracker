import type { IsoDate } from "../schemas/primitives.js";
import {
  startOfWeekIso,
  endOfWeekIso,
  startOfMonthIso,
  endOfMonthIso,
  startOfYearIso,
  endOfYearIso,
  addDaysIso,
  addMonthsIso,
  isSameIso,
  formatIso,
} from "./dates.js";

export interface CalendarDay {
  date: IsoDate;
  dayOfMonth: number;
  isToday: boolean;
  isCurrentPeriod: boolean;
  isWeekend: boolean;
}

export interface CalendarWeek {
  weekStart: IsoDate;
  days: CalendarDay[];
}

export interface MonthGrid {
  month: IsoDate;
  label: string;
  weeks: CalendarWeek[];
}

export interface YearGrid {
  year: number;
  months: MonthGrid[];
}

export interface CalendarOptions {
  today: IsoDate;
  weekStartsOn: 0 | 1;
}

/**
 * Builds a single week of 7 days starting from the anchor date.
 * The week starts on the configured weekStartsOn day (Sunday=0, Monday=1).
 */
export function buildWeek(
  anchor: IsoDate,
  opts: CalendarOptions
): CalendarWeek {
  const { today, weekStartsOn } = opts;
  const weekStart = startOfWeekIso(anchor, weekStartsOn);

  const days: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(weekStart, i);
    const dayOfMonth = parseInt(date.split("-")[2]!, 10);

    // Weekend is Saturday (6) or Sunday (0)
    const dayOfWeek = (weekStartsOn + i) % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    days.push({
      date,
      dayOfMonth,
      isToday: isSameIso(date, today),
      isCurrentPeriod: true, // buildWeek doesn't have period context
      isWeekend,
    });
  }

  return {
    weekStart,
    days,
  };
}

/**
 * Builds a month grid with always 6 weeks × 7 days.
 * This prevents the grid height from changing between months.
 * Days outside the current month have isCurrentPeriod set to false.
 */
export function buildMonthGrid(
  anchor: IsoDate,
  opts: CalendarOptions
): MonthGrid {
  const { today, weekStartsOn } = opts;
  const monthStart = startOfMonthIso(anchor);
  const monthEnd = endOfMonthIso(anchor);

  // Get the year and month for the label
  const [year, month] = anchor.split("-").map((s) => parseInt(s, 10));
  const label = formatIso(anchor, "MMMM yyyy");

  // Find the first day to display (start of week containing the 1st)
  const gridStart = startOfWeekIso(monthStart, weekStartsOn);

  const weeks: CalendarWeek[] = [];

  // Always build 6 weeks to prevent height reflow
  for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
    const weekStart = addDaysIso(gridStart, weekIndex * 7);
    const days: CalendarDay[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = addDaysIso(weekStart, dayIndex);
      const dayOfMonth = parseInt(date.split("-")[2]!, 10);

      // Check if this date is in the current month
      const dateMonth = date.split("-")[1];
      const anchorMonth = anchor.split("-")[1];
      const isCurrentPeriod = dateMonth === anchorMonth;

      // Weekend is Saturday (6) or Sunday (0)
      const dayOfWeek = (weekStartsOn + dayIndex) % 7;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      days.push({
        date,
        dayOfMonth,
        isToday: isSameIso(date, today),
        isCurrentPeriod,
        isWeekend,
      });
    }

    weeks.push({
      weekStart,
      days,
    });
  }

  return {
    month: monthStart,
    label,
    weeks,
  };
}

/**
 * Builds a year grid containing 12 month grids.
 */
export function buildYearGrid(
  anchor: IsoDate,
  opts: CalendarOptions
): YearGrid {
  const year = parseInt(anchor.split("-")[0]!, 10);
  const yearStart = startOfYearIso(anchor);

  const months: MonthGrid[] = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthAnchor = addMonthsIso(yearStart, monthIndex);
    months.push(buildMonthGrid(monthAnchor, opts));
  }

  return {
    year,
    months,
  };
}

export type CalendarView = "week" | "month" | "year";

/**
 * Returns the inclusive date range that a view displays,
 * including spill-over days from adjacent periods.
 * The client uses this to fetch exactly the items a view needs.
 */
export function rangeOfView(
  anchor: IsoDate,
  view: CalendarView,
  opts: CalendarOptions
): { from: IsoDate; to: IsoDate } {
  const { weekStartsOn } = opts;

  switch (view) {
    case "week": {
      const from = startOfWeekIso(anchor, weekStartsOn);
      const to = endOfWeekIso(anchor, weekStartsOn);
      return { from, to };
    }

    case "month": {
      // Month view includes spill-over days (6 weeks total)
      const monthStart = startOfMonthIso(anchor);
      const from = startOfWeekIso(monthStart, weekStartsOn);
      // 6 weeks = 42 days, so end is 41 days after start
      const to = addDaysIso(from, 41);
      return { from, to };
    }

    case "year": {
      // Year view spans all 12 months, including spill-over
      const yearStart = startOfYearIso(anchor);
      const yearEnd = endOfYearIso(anchor);

      // First month's spill-over start
      const firstMonthStart = startOfMonthIso(yearStart);
      const from = startOfWeekIso(firstMonthStart, weekStartsOn);

      // Last month's spill-over end (last month + 6 weeks)
      const lastMonthStart = startOfMonthIso(yearEnd);
      const lastMonthGridStart = startOfWeekIso(lastMonthStart, weekStartsOn);
      const to = addDaysIso(lastMonthGridStart, 41);

      return { from, to };
    }
  }
}

/**
 * Navigates to the previous or next period.
 * delta: -1 for previous, +1 for next, or any integer offset.
 */
export function shiftAnchor(
  anchor: IsoDate,
  view: CalendarView,
  delta: number,
  opts: CalendarOptions
): IsoDate {
  const { weekStartsOn } = opts;

  switch (view) {
    case "week": {
      return addDaysIso(anchor, delta * 7);
    }

    case "month": {
      return addMonthsIso(anchor, delta);
    }

    case "year": {
      // For year view, shift by years (12 months)
      return addMonthsIso(anchor, delta * 12);
    }
  }
}
