import { describe, it, expect } from "vitest";
import type { IsoDate } from "../schemas/primitives.js";
import {
  toIso,
  todayIso,
  addDaysIso,
  addMonthsIso,
  differenceInDaysIso,
  compareIso,
  isBeforeIso,
  isAfterIso,
  isSameIso,
  startOfMonthIso,
  endOfMonthIso,
  startOfWeekIso,
  endOfWeekIso,
  startOfYearIso,
  endOfYearIso,
  formatIso,
  isWithinRangeIso,
} from "./dates.js";

describe("toIso", () => {
  it("converts a Date to YYYY-MM-DD format", () => {
    const date = new Date("2026-03-15T12:30:00Z");
    expect(toIso(date)).toBe("2026-03-15");
  });
});

describe("todayIso", () => {
  it("returns today's date as ISO string without calling new Date()", () => {
    const now = new Date("2026-08-18T10:30:00Z");
    expect(todayIso(now)).toBe("2026-08-18");
  });
});

describe("addDaysIso", () => {
  it("adds positive days", () => {
    expect(addDaysIso("2026-01-15" as IsoDate, 10)).toBe("2026-01-25");
  });

  it("adds negative days", () => {
    expect(addDaysIso("2026-01-15" as IsoDate, -5)).toBe("2026-01-10");
  });

  it("handles month boundaries", () => {
    expect(addDaysIso("2026-01-30" as IsoDate, 5)).toBe("2026-02-04");
  });

  it("handles year boundaries", () => {
    expect(addDaysIso("2026-12-30" as IsoDate, 5)).toBe("2027-01-04");
  });
});

describe("addMonthsIso", () => {
  it("adds months normally", () => {
    expect(addMonthsIso("2026-01-15" as IsoDate, 1)).toBe("2026-02-15");
    expect(addMonthsIso("2026-01-15" as IsoDate, 3)).toBe("2026-04-15");
  });

  it("clamps month-end dates: 2026-01-31 + 1 month = 2026-02-28", () => {
    expect(addMonthsIso("2026-01-31" as IsoDate, 1)).toBe("2026-02-28");
  });

  it("clamps month-end dates: 2026-08-31 + 6 months = 2027-02-28", () => {
    expect(addMonthsIso("2026-08-31" as IsoDate, 6)).toBe("2027-02-28");
  });

  it("handles leap year: 2028-01-31 + 1 month = 2028-02-29", () => {
    expect(addMonthsIso("2028-01-31" as IsoDate, 1)).toBe("2028-02-29");
  });

  it("handles non-leap year: 2026-01-31 + 1 month = 2026-02-28 (not 02-29)", () => {
    // 2026 is not a leap year, so Feb only has 28 days
    expect(addMonthsIso("2026-01-31" as IsoDate, 1)).toBe("2026-02-28");
  });

  it("handles negative months", () => {
    expect(addMonthsIso("2026-03-31" as IsoDate, -1)).toBe("2026-02-28");
  });

  it("handles year boundaries", () => {
    expect(addMonthsIso("2026-11-15" as IsoDate, 3)).toBe("2027-02-15");
  });
});

describe("differenceInDaysIso", () => {
  it("returns positive difference when a is after b", () => {
    expect(differenceInDaysIso("2026-01-10" as IsoDate, "2026-01-05" as IsoDate)).toBe(5);
  });

  it("returns negative difference when a is before b", () => {
    expect(differenceInDaysIso("2026-01-05" as IsoDate, "2026-01-10" as IsoDate)).toBe(-5);
  });

  it("returns 0 for the same date", () => {
    expect(differenceInDaysIso("2026-01-15" as IsoDate, "2026-01-15" as IsoDate)).toBe(0);
  });

  it("returns whole days across a month boundary", () => {
    // Jan 31 to Feb 5 is 5 days
    expect(differenceInDaysIso("2026-02-05" as IsoDate, "2026-01-31" as IsoDate)).toBe(5);
  });

  it("returns whole days across DST transition in March", () => {
    // DST in the US typically occurs on the second Sunday of March
    // 2026-03-08 is when clocks spring forward (2 AM -> 3 AM)
    // The difference should still be a whole number of days, not 23 or 25 hours
    const before = "2026-03-07" as IsoDate;
    const after = "2026-03-09" as IsoDate;
    expect(differenceInDaysIso(after, before)).toBe(2);
  });

  it("returns whole days across DST transition spanning multiple days", () => {
    // March 1 to March 15, crossing DST on March 8
    const start = "2026-03-01" as IsoDate;
    const end = "2026-03-15" as IsoDate;
    expect(differenceInDaysIso(end, start)).toBe(14);
  });
});

describe("compareIso", () => {
  it("returns -1 when a < b", () => {
    expect(compareIso("2026-01-05" as IsoDate, "2026-01-10" as IsoDate)).toBe(-1);
  });

  it("returns 1 when a > b", () => {
    expect(compareIso("2026-01-10" as IsoDate, "2026-01-05" as IsoDate)).toBe(1);
  });

  it("returns 0 when a === b", () => {
    expect(compareIso("2026-01-10" as IsoDate, "2026-01-10" as IsoDate)).toBe(0);
  });

  it("works correctly with Array.sort to sort dates ascending", () => {
    const dates: IsoDate[] = [
      "2026-03-15" as IsoDate,
      "2026-01-05" as IsoDate,
      "2027-12-31" as IsoDate,
      "2026-01-01" as IsoDate,
      "2026-06-20" as IsoDate,
    ];

    const sorted = [...dates].sort(compareIso);

    expect(sorted).toEqual([
      "2026-01-01",
      "2026-01-05",
      "2026-03-15",
      "2026-06-20",
      "2027-12-31",
    ]);
  });

  it("works correctly with Array.sort to sort dates descending", () => {
    const dates: IsoDate[] = [
      "2026-03-15" as IsoDate,
      "2026-01-05" as IsoDate,
      "2027-12-31" as IsoDate,
      "2026-01-01" as IsoDate,
      "2026-06-20" as IsoDate,
    ];

    const sorted = [...dates].sort((a, b) => compareIso(b, a));

    expect(sorted).toEqual([
      "2027-12-31",
      "2026-06-20",
      "2026-03-15",
      "2026-01-05",
      "2026-01-01",
    ]);
  });
});

describe("isBeforeIso", () => {
  it("returns true when a is before b", () => {
    expect(isBeforeIso("2026-01-05" as IsoDate, "2026-01-10" as IsoDate)).toBe(true);
  });

  it("returns false when a is after b", () => {
    expect(isBeforeIso("2026-01-10" as IsoDate, "2026-01-05" as IsoDate)).toBe(false);
  });

  it("returns false when dates are equal", () => {
    expect(isBeforeIso("2026-01-10" as IsoDate, "2026-01-10" as IsoDate)).toBe(false);
  });
});

describe("isAfterIso", () => {
  it("returns true when a is after b", () => {
    expect(isAfterIso("2026-01-10" as IsoDate, "2026-01-05" as IsoDate)).toBe(true);
  });

  it("returns false when a is before b", () => {
    expect(isAfterIso("2026-01-05" as IsoDate, "2026-01-10" as IsoDate)).toBe(false);
  });

  it("returns false when dates are equal", () => {
    expect(isAfterIso("2026-01-10" as IsoDate, "2026-01-10" as IsoDate)).toBe(false);
  });
});

describe("isSameIso", () => {
  it("returns true for the same date", () => {
    expect(isSameIso("2026-01-15" as IsoDate, "2026-01-15" as IsoDate)).toBe(true);
  });

  it("returns false for different dates", () => {
    expect(isSameIso("2026-01-15" as IsoDate, "2026-01-16" as IsoDate)).toBe(false);
  });
});

describe("startOfMonthIso", () => {
  it("returns the first day of the month", () => {
    expect(startOfMonthIso("2026-03-15" as IsoDate)).toBe("2026-03-01");
    expect(startOfMonthIso("2026-12-31" as IsoDate)).toBe("2026-12-01");
  });
});

describe("endOfMonthIso", () => {
  it("returns the last day of the month", () => {
    expect(endOfMonthIso("2026-01-15" as IsoDate)).toBe("2026-01-31");
    expect(endOfMonthIso("2026-02-10" as IsoDate)).toBe("2026-02-28");
  });

  it("handles leap year February", () => {
    expect(endOfMonthIso("2028-02-15" as IsoDate)).toBe("2028-02-29");
  });
});

describe("startOfWeekIso", () => {
  it("returns the start of the week (Sunday by default)", () => {
    // 2026-03-15 is a Sunday
    expect(startOfWeekIso("2026-03-15" as IsoDate)).toBe("2026-03-15");
    // 2026-03-16 is a Monday, so the previous Sunday is 2026-03-15
    expect(startOfWeekIso("2026-03-16" as IsoDate)).toBe("2026-03-15");
  });

  it("returns the start of the week (Monday when specified)", () => {
    // 2026-03-16 is a Monday
    expect(startOfWeekIso("2026-03-16" as IsoDate, 1)).toBe("2026-03-16");
    // 2026-03-17 is a Tuesday, so the previous Monday is 2026-03-16
    expect(startOfWeekIso("2026-03-17" as IsoDate, 1)).toBe("2026-03-16");
  });
});

describe("endOfWeekIso", () => {
  it("returns the end of the week (Saturday by default)", () => {
    // 2026-03-21 is a Saturday
    expect(endOfWeekIso("2026-03-21" as IsoDate)).toBe("2026-03-21");
    // 2026-03-16 is a Monday, so the next Saturday is 2026-03-21
    expect(endOfWeekIso("2026-03-16" as IsoDate)).toBe("2026-03-21");
  });

  it("returns the end of the week (Sunday when week starts Monday)", () => {
    // 2026-03-22 is a Sunday
    expect(endOfWeekIso("2026-03-22" as IsoDate, 1)).toBe("2026-03-22");
    // 2026-03-16 is a Monday, so the next Sunday is 2026-03-22
    expect(endOfWeekIso("2026-03-16" as IsoDate, 1)).toBe("2026-03-22");
  });
});

describe("startOfYearIso", () => {
  it("returns January 1st of the year", () => {
    expect(startOfYearIso("2026-06-15" as IsoDate)).toBe("2026-01-01");
    expect(startOfYearIso("2026-12-31" as IsoDate)).toBe("2026-01-01");
  });
});

describe("endOfYearIso", () => {
  it("returns December 31st of the year", () => {
    expect(endOfYearIso("2026-06-15" as IsoDate)).toBe("2026-12-31");
    expect(endOfYearIso("2026-01-01" as IsoDate)).toBe("2026-12-31");
  });
});

describe("formatIso", () => {
  it("formats dates for display", () => {
    const date = "2026-03-15" as IsoDate;
    expect(formatIso(date, "MMM d, yyyy")).toBe("Mar 15, 2026");
    expect(formatIso(date, "yyyy-MM-dd")).toBe("2026-03-15");
    expect(formatIso(date, "MMMM do, yyyy")).toBe("March 15th, 2026");
  });
});

describe("isWithinRangeIso", () => {
  it("returns true when date is within range (inclusive)", () => {
    expect(
      isWithinRangeIso(
        "2026-03-15" as IsoDate,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      )
    ).toBe(true);
  });

  it("returns true when date equals the start boundary", () => {
    expect(
      isWithinRangeIso(
        "2026-03-01" as IsoDate,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      )
    ).toBe(true);
  });

  it("returns true when date equals the end boundary", () => {
    expect(
      isWithinRangeIso(
        "2026-03-31" as IsoDate,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      )
    ).toBe(true);
  });

  it("returns false when date is before the range", () => {
    expect(
      isWithinRangeIso(
        "2026-02-28" as IsoDate,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      )
    ).toBe(false);
  });

  it("returns false when date is after the range", () => {
    expect(
      isWithinRangeIso(
        "2026-04-01" as IsoDate,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      )
    ).toBe(false);
  });
});

describe("leap year handling", () => {
  it("recognizes that 2028-02-29 exists (leap year)", () => {
    // If we can add months to end up on Feb 29, 2028, it exists
    expect(addMonthsIso("2028-01-29" as IsoDate, 1)).toBe("2028-02-29");
    expect(endOfMonthIso("2028-02-15" as IsoDate)).toBe("2028-02-29");
  });

  it("recognizes that 2026-02-29 does not exist (non-leap year)", () => {
    // 2026 is not a leap year, so Feb only has 28 days
    expect(endOfMonthIso("2026-02-15" as IsoDate)).toBe("2026-02-28");
    expect(addMonthsIso("2026-01-29" as IsoDate, 1)).toBe("2026-02-28");
  });
});
