import { describe, it, expect } from "vitest";
import type { IsoDate } from "../schemas/primitives.js";
import {
  buildWeek,
  buildMonthGrid,
  buildYearGrid,
  rangeOfView,
  shiftAnchor,
  type CalendarOptions,
} from "./calendar.js";

describe("buildWeek", () => {
  it("builds a week with 7 days", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const week = buildWeek("2026-03-15" as IsoDate, opts);

    expect(week.days).toHaveLength(7);
    expect(week.weekStart).toBe("2026-03-15"); // March 15, 2026 is a Sunday
  });

  it("respects weekStartsOn: 0 (Sunday)", () => {
    const opts: CalendarOptions = {
      today: "2026-03-16" as IsoDate, // Monday
      weekStartsOn: 0,
    };

    const week = buildWeek("2026-03-16" as IsoDate, opts);

    expect(week.weekStart).toBe("2026-03-15"); // Previous Sunday
    expect(week.days[0]?.date).toBe("2026-03-15");
    expect(week.days[6]?.date).toBe("2026-03-21");
  });

  it("respects weekStartsOn: 1 (Monday)", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate, // Sunday
      weekStartsOn: 1,
    };

    const week = buildWeek("2026-03-15" as IsoDate, opts);

    expect(week.weekStart).toBe("2026-03-09"); // Previous Monday
    expect(week.days[0]?.date).toBe("2026-03-09");
    expect(week.days[6]?.date).toBe("2026-03-15");
  });

  it("marks isToday correctly", () => {
    const opts: CalendarOptions = {
      today: "2026-03-18" as IsoDate, // Wednesday
      weekStartsOn: 0,
    };

    const week = buildWeek("2026-03-18" as IsoDate, opts);

    const todayDay = week.days.find((d) => d.isToday);
    expect(todayDay?.date).toBe("2026-03-18");
    expect(week.days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("marks weekends correctly (Sunday = 0)", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const week = buildWeek("2026-03-15" as IsoDate, opts);

    // Sunday (index 0) and Saturday (index 6) should be weekends
    expect(week.days[0]?.isWeekend).toBe(true); // Sunday
    expect(week.days[1]?.isWeekend).toBe(false); // Monday
    expect(week.days[5]?.isWeekend).toBe(false); // Friday
    expect(week.days[6]?.isWeekend).toBe(true); // Saturday
  });
});

describe("buildMonthGrid", () => {
  it("always returns 6 weeks × 7 days = 42 days for Feb 2026", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-02-15" as IsoDate, opts);

    expect(grid.weeks).toHaveLength(6);
    grid.weeks.forEach((week) => {
      expect(week.days).toHaveLength(7);
    });

    // Total should be 42 days
    const totalDays = grid.weeks.flatMap((w) => w.days);
    expect(totalDays).toHaveLength(42);
  });

  it("always returns 6 weeks × 7 days for a month starting on Sunday", () => {
    // August 2026 starts on Saturday (Aug 1), so with weekStartsOn=0,
    // the grid will include some July days
    const opts: CalendarOptions = {
      today: "2026-08-15" as IsoDate,
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-08-15" as IsoDate, opts);

    expect(grid.weeks).toHaveLength(6);
    grid.weeks.forEach((week) => {
      expect(week.days).toHaveLength(7);
    });
  });

  it("marks days outside the current month with isCurrentPeriod false", () => {
    const opts: CalendarOptions = {
      today: "2026-02-15" as IsoDate,
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-02-15" as IsoDate, opts);

    const allDays = grid.weeks.flatMap((w) => w.days);

    // Count days in February 2026 (28 days)
    const febDays = allDays.filter((d) => d.isCurrentPeriod);
    expect(febDays).toHaveLength(28);

    // Count days outside February
    const spillDays = allDays.filter((d) => !d.isCurrentPeriod);
    expect(spillDays).toHaveLength(42 - 28);

    // Verify spill days are from adjacent months
    const spillDates = spillDays.map((d) => d.date);
    const hasJanuaryDays = spillDates.some((d) => d.startsWith("2026-01-"));
    const hasMarchDays = spillDates.some((d) => d.startsWith("2026-03-"));

    expect(hasJanuaryDays || hasMarchDays).toBe(true);
  });

  it("respects weekStartsOn: 1 (Monday) and shifts the leading spill", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 1,
    };

    const grid = buildMonthGrid("2026-03-15" as IsoDate, opts);

    // March 2026 starts on Sunday (2026-03-01)
    // With weekStartsOn=1 (Monday), the grid should start on the Monday before
    const firstDay = grid.weeks[0]?.days[0];
    expect(firstDay?.date).toBe("2026-02-23"); // Monday before March 1

    expect(grid.weeks).toHaveLength(6);
  });

  it("sets isToday true on exactly one day when today is inside the range", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-03-15" as IsoDate, opts);

    const allDays = grid.weeks.flatMap((w) => w.days);
    const todayDays = allDays.filter((d) => d.isToday);

    expect(todayDays).toHaveLength(1);
    expect(todayDays[0]?.date).toBe("2026-03-15");
  });

  it("sets isToday false on all days when today is outside the range", () => {
    const opts: CalendarOptions = {
      today: "2026-12-25" as IsoDate, // Today is in December
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-03-15" as IsoDate, opts); // Grid for March

    const allDays = grid.weeks.flatMap((w) => w.days);
    const todayDays = allDays.filter((d) => d.isToday);

    expect(todayDays).toHaveLength(0);
  });

  it("generates correct label", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-03-15" as IsoDate, opts);

    expect(grid.label).toBe("March 2026");
  });

  it("has correct month field (start of month)", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const grid = buildMonthGrid("2026-03-15" as IsoDate, opts);

    expect(grid.month).toBe("2026-03-01");
  });
});

describe("buildYearGrid", () => {
  it("returns 12 months", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const yearGrid = buildYearGrid("2026-03-15" as IsoDate, opts);

    expect(yearGrid.months).toHaveLength(12);
    expect(yearGrid.year).toBe(2026);
  });

  it("returns correct labels for all 12 months", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const yearGrid = buildYearGrid("2026-03-15" as IsoDate, opts);

    const expectedLabels = [
      "January 2026",
      "February 2026",
      "March 2026",
      "April 2026",
      "May 2026",
      "June 2026",
      "July 2026",
      "August 2026",
      "September 2026",
      "October 2026",
      "November 2026",
      "December 2026",
    ];

    const actualLabels = yearGrid.months.map((m) => m.label);
    expect(actualLabels).toEqual(expectedLabels);
  });

  it("each month has 6 weeks", () => {
    const opts: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 0,
    };

    const yearGrid = buildYearGrid("2026-03-15" as IsoDate, opts);

    yearGrid.months.forEach((month) => {
      expect(month.weeks).toHaveLength(6);
      month.weeks.forEach((week) => {
        expect(week.days).toHaveLength(7);
      });
    });
  });

  it("works when anchor is any date in the year", () => {
    const opts: CalendarOptions = {
      today: "2026-07-20" as IsoDate,
      weekStartsOn: 0,
    };

    const yearGrid = buildYearGrid("2026-07-20" as IsoDate, opts);

    expect(yearGrid.year).toBe(2026);
    expect(yearGrid.months[0]?.label).toBe("January 2026");
    expect(yearGrid.months[11]?.label).toBe("December 2026");
  });
});

describe("rangeOfView", () => {
  const opts: CalendarOptions = {
    today: "2026-03-15" as IsoDate,
    weekStartsOn: 0,
  };

  it("returns the week range for week view", () => {
    const range = rangeOfView("2026-03-18" as IsoDate, "week", opts);

    // March 18, 2026 is a Wednesday
    // Week starts on Sunday March 15
    expect(range.from).toBe("2026-03-15");
    expect(range.to).toBe("2026-03-21");
  });

  it("returns the month range including spill-over days for month view", () => {
    const range = rangeOfView("2026-03-15" as IsoDate, "month", opts);

    // March 2026 starts on Sunday, so no leading spill with weekStartsOn=0
    // But we still need 6 weeks = 42 days
    expect(range.from).toBe("2026-03-01");
    expect(range.to).toBe("2026-04-11"); // 42 days from March 1
  });

  it("includes spill-over days from adjacent months in month view", () => {
    const range = rangeOfView("2026-02-15" as IsoDate, "month", opts);

    // February 2026 starts on Sunday (Feb 1)
    // With weekStartsOn=0, grid starts on Feb 1
    expect(range.from).toBe("2026-02-01");

    // 42 days from Feb 1
    const expectedTo = "2026-03-14";
    expect(range.to).toBe(expectedTo);
  });

  it("returns the year range including all months' spill-over for year view", () => {
    const range = rangeOfView("2026-06-15" as IsoDate, "year", opts);

    // January 2026 starts on Thursday
    // With weekStartsOn=0, grid starts on the Sunday before
    expect(range.from).toBe("2025-12-28");

    // December 2026: Dec 1 is Tuesday
    // Grid starts on Sunday Nov 29
    // Plus 42 days = Jan 9, 2027
    expect(range.to).toBe("2027-01-09");
  });

  it("respects weekStartsOn for range calculation", () => {
    const optsMonday: CalendarOptions = {
      today: "2026-03-15" as IsoDate,
      weekStartsOn: 1,
    };

    const range = rangeOfView("2026-03-15" as IsoDate, "week", optsMonday);

    // March 15, 2026 is a Sunday
    // With weekStartsOn=1 (Monday), week starts on Monday March 9
    expect(range.from).toBe("2026-03-09");
    expect(range.to).toBe("2026-03-15");
  });
});

describe("shiftAnchor", () => {
  const opts: CalendarOptions = {
    today: "2026-03-15" as IsoDate,
    weekStartsOn: 0,
  };

  it("shifts week by +1 (next week)", () => {
    const result = shiftAnchor("2026-03-15" as IsoDate, "week", 1, opts);
    expect(result).toBe("2026-03-22");
  });

  it("shifts week by -1 (previous week)", () => {
    const result = shiftAnchor("2026-03-15" as IsoDate, "week", -1, opts);
    expect(result).toBe("2026-03-08");
  });

  it("shifts month by +1 lands in the next month", () => {
    const result = shiftAnchor("2026-03-15" as IsoDate, "month", 1, opts);
    expect(result).toBe("2026-04-15");
  });

  it("shifts month by -1 on 2026-01-15 lands in December 2025", () => {
    const result = shiftAnchor("2026-01-15" as IsoDate, "month", -1, opts);
    expect(result).toBe("2025-12-15");
  });

  it("shifts year by +1", () => {
    const result = shiftAnchor("2026-03-15" as IsoDate, "year", 1, opts);
    expect(result).toBe("2027-03-15");
  });

  it("shifts year by -1", () => {
    const result = shiftAnchor("2026-03-15" as IsoDate, "year", -1, opts);
    expect(result).toBe("2025-03-15");
  });

  it("handles multi-step navigation (+3 months)", () => {
    const result = shiftAnchor("2026-01-15" as IsoDate, "month", 3, opts);
    expect(result).toBe("2026-04-15");
  });

  it("handles multi-step navigation (-6 months)", () => {
    const result = shiftAnchor("2026-07-15" as IsoDate, "month", -6, opts);
    expect(result).toBe("2026-01-15");
  });

  it("handles month-end date clamping", () => {
    // January 31 + 1 month = February 28
    const result = shiftAnchor("2026-01-31" as IsoDate, "month", 1, opts);
    expect(result).toBe("2026-02-28");
  });
});
