import { describe, it, expect } from "vitest";
import type { IsoDate } from "../schemas/primitives.js";
import {
  MONTHS_BY_RECURRENCE,
  recurrenceIntervalMonths,
  nextDueDate,
  catchUpDueDate,
  describeRecurrence,
} from "./recurrence.js";

describe("MONTHS_BY_RECURRENCE", () => {
  it("has correct mappings for standard recurrence types", () => {
    expect(MONTHS_BY_RECURRENCE.monthly).toBe(1);
    expect(MONTHS_BY_RECURRENCE.quarterly).toBe(3);
    expect(MONTHS_BY_RECURRENCE.semiannual).toBe(6);
    expect(MONTHS_BY_RECURRENCE.annual).toBe(12);
    expect(MONTHS_BY_RECURRENCE.none).toBe(null);
    expect(MONTHS_BY_RECURRENCE.custom).toBe(null);
  });
});

describe("recurrenceIntervalMonths", () => {
  it("returns null for 'none'", () => {
    expect(recurrenceIntervalMonths("none", null)).toBe(null);
    expect(recurrenceIntervalMonths("none", 12)).toBe(null);
  });

  it("returns recurrenceMonths for 'custom'", () => {
    expect(recurrenceIntervalMonths("custom", 18)).toBe(18);
    expect(recurrenceIntervalMonths("custom", 5)).toBe(5);
  });

  it("returns null for 'custom' when recurrenceMonths is null", () => {
    expect(recurrenceIntervalMonths("custom", null)).toBe(null);
  });

  it("returns null for 'custom' when recurrenceMonths is undefined", () => {
    expect(recurrenceIntervalMonths("custom", undefined)).toBe(null);
  });

  it("returns fixed intervals for standard recurrence types", () => {
    expect(recurrenceIntervalMonths("monthly", null)).toBe(1);
    expect(recurrenceIntervalMonths("quarterly", null)).toBe(3);
    expect(recurrenceIntervalMonths("semiannual", null)).toBe(6);
    expect(recurrenceIntervalMonths("annual", null)).toBe(12);
  });
});

describe("nextDueDate", () => {
  it("rolls forward annual recurrence across a year boundary", () => {
    const result = nextDueDate({
      dueDate: "2026-12-15" as IsoDate,
      recurrence: "annual",
      recurrenceMonths: null,
    });

    expect(result).toBe("2027-12-15");
  });

  it("handles monthly from 2026-01-31 producing 2026-02-28 (clamped)", () => {
    const firstRoll = nextDueDate({
      dueDate: "2026-01-31" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
    });

    expect(firstRoll).toBe("2026-02-28");
  });

  it("handles monthly from 2026-02-28 producing 2026-03-28 (day does not heal back to 31)", () => {
    // This documents that the day-of-month does not "heal" back to 31,
    // and that this is the accepted trade-off for using calendar arithmetic.
    const secondRoll = nextDueDate({
      dueDate: "2026-02-28" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
    });

    expect(secondRoll).toBe("2026-03-28");
  });

  it("returns null for 'none' recurrence", () => {
    const result = nextDueDate({
      dueDate: "2026-03-15" as IsoDate,
      recurrence: "none",
      recurrenceMonths: null,
    });

    expect(result).toBe(null);
  });

  it("handles custom recurrence with recurrenceMonths 18", () => {
    const result = nextDueDate({
      dueDate: "2026-01-15" as IsoDate,
      recurrence: "custom",
      recurrenceMonths: 18,
    });

    expect(result).toBe("2027-07-15");
  });

  it("returns null for custom recurrence when recurrenceMonths is null", () => {
    const result = nextDueDate({
      dueDate: "2026-01-15" as IsoDate,
      recurrence: "custom",
      recurrenceMonths: null,
    });

    expect(result).toBe(null);
  });

  it("handles quarterly recurrence", () => {
    const result = nextDueDate({
      dueDate: "2026-01-15" as IsoDate,
      recurrence: "quarterly",
      recurrenceMonths: null,
    });

    expect(result).toBe("2026-04-15");
  });

  it("handles semiannual recurrence", () => {
    const result = nextDueDate({
      dueDate: "2026-01-15" as IsoDate,
      recurrence: "semiannual",
      recurrenceMonths: null,
    });

    expect(result).toBe("2026-07-15");
  });
});

describe("catchUpDueDate", () => {
  it("returns null for 'none' recurrence", () => {
    const result = catchUpDueDate({
      dueDate: "2024-01-15" as IsoDate,
      recurrence: "none",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    expect(result).toBe(null);
  });

  it("returns the same date if already >= today", () => {
    const result = catchUpDueDate({
      dueDate: "2026-06-15" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    expect(result).toBe("2026-06-15");
  });

  it("advances from a date two years stale to the first date >= today", () => {
    const result = catchUpDueDate({
      dueDate: "2024-03-15" as IsoDate, // 2 years ago
      recurrence: "annual",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    // Should roll forward: 2024-03-15 → 2025-03-15 → 2026-03-15
    expect(result).toBe("2026-03-15");
  });

  it("handles monthly catch-up over several months", () => {
    const result = catchUpDueDate({
      dueDate: "2025-10-15" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    // Should roll forward monthly until >= 2026-03-15
    // 2025-10-15 → 2025-11-15 → 2025-12-15 → 2026-01-15 → 2026-02-15 → 2026-03-15
    expect(result).toBe("2026-03-15");
  });

  it("handles quarterly catch-up", () => {
    const result = catchUpDueDate({
      dueDate: "2025-06-15" as IsoDate,
      recurrence: "quarterly",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    // 2025-06-15 → 2025-09-15 → 2025-12-15 → 2026-03-15
    expect(result).toBe("2026-03-15");
  });

  it("handles custom recurrence with recurrenceMonths 18", () => {
    const result = catchUpDueDate({
      dueDate: "2024-01-15" as IsoDate,
      recurrence: "custom",
      recurrenceMonths: 18,
      today: "2026-03-15" as IsoDate,
    });

    // 2024-01-15 → 2025-07-15 → 2027-01-15
    // First date >= 2026-03-15 is 2027-01-15
    expect(result).toBe("2027-01-15");
  });

  it("stops exactly when reaching today (inclusive)", () => {
    const result = catchUpDueDate({
      dueDate: "2026-01-15" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    // 2026-01-15 → 2026-02-15 → 2026-03-15
    expect(result).toBe("2026-03-15");
  });

  it("advances one more step if the date equals today but we need >= today", () => {
    // Actually, >= today means "today" is acceptable, so if we land exactly on today, we stop
    const result = catchUpDueDate({
      dueDate: "2026-02-15" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    expect(result).toBe("2026-03-15");
  });

  it("advances just past today if the interval overshoots", () => {
    const result = catchUpDueDate({
      dueDate: "2026-01-01" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
      today: "2026-03-15" as IsoDate,
    });

    // 2026-01-01 → 2026-02-01 → 2026-03-01 → 2026-04-01
    // First date >= 2026-03-15 is 2026-04-01
    expect(result).toBe("2026-04-01");
  });

  it("throws an error if 1000 iterations are exceeded", () => {
    expect(() => {
      catchUpDueDate({
        dueDate: "2026-01-15" as IsoDate,
        recurrence: "custom",
        recurrenceMonths: 0, // Zero interval - would loop forever
        today: "2026-03-15" as IsoDate,
      });
    }).toThrow(/exceeded 1000 iterations/);
  });

  it("throws an error with clear message including recurrence details", () => {
    expect(() => {
      catchUpDueDate({
        dueDate: "2026-01-15" as IsoDate,
        recurrence: "custom",
        recurrenceMonths: -1, // Negative interval
        today: "2026-03-15" as IsoDate,
      });
    }).toThrow(/recurrence=custom/);
  });

  it("handles the day-of-month clamping in catch-up (2026-01-31 case)", () => {
    // Starting from Jan 31, monthly recurrence will clamp to Feb 28, then stay at 28
    const result = catchUpDueDate({
      dueDate: "2026-01-31" as IsoDate,
      recurrence: "monthly",
      recurrenceMonths: null,
      today: "2026-04-15" as IsoDate,
    });

    // 2026-01-31 → 2026-02-28 → 2026-03-28 → 2026-04-28
    // First date >= 2026-04-15 is 2026-04-28
    expect(result).toBe("2026-04-28");
  });
});

describe("describeRecurrence", () => {
  it('returns "One-off" for none', () => {
    expect(describeRecurrence("none", null)).toBe("One-off");
  });

  it('returns "Every year" for annual', () => {
    expect(describeRecurrence("annual", null)).toBe("Every year");
  });

  it('returns "Every month" for monthly', () => {
    expect(describeRecurrence("monthly", null)).toBe("Every month");
  });

  it('returns "Every 3 months" for quarterly', () => {
    expect(describeRecurrence("quarterly", null)).toBe("Every 3 months");
  });

  it('returns "Every 6 months" for semiannual', () => {
    expect(describeRecurrence("semiannual", null)).toBe("Every 6 months");
  });

  it('returns "Every 18 months" for custom with recurrenceMonths 18', () => {
    expect(describeRecurrence("custom", 18)).toBe("Every 18 months");
  });

  it('returns "One-off" for custom with null recurrenceMonths', () => {
    expect(describeRecurrence("custom", null)).toBe("One-off");
  });

  it('returns "Every 5 months" for custom with recurrenceMonths 5', () => {
    expect(describeRecurrence("custom", 5)).toBe("Every 5 months");
  });

  it('returns "Every year" for custom with recurrenceMonths 12', () => {
    expect(describeRecurrence("custom", 12)).toBe("Every year");
  });

  it('returns "Every month" for custom with recurrenceMonths 1', () => {
    expect(describeRecurrence("custom", 1)).toBe("Every month");
  });
});
