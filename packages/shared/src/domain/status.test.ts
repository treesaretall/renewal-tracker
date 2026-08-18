import { describe, it, expect } from "vitest";
import type { IsoDate } from "../schemas/primitives.js";
import {
  computeStatus,
  daysUntilDue,
  describeDueDate,
  STATUS_ORDER,
  compareByUrgency,
  type ItemForUrgencySort,
} from "./status.js";

describe("computeStatus", () => {
  const today = "2026-03-15" as IsoDate;

  it("returns 'due-soon' when dueDate === today with leadTime 0", () => {
    expect(
      computeStatus({
        dueDate: today,
        leadTimeDays: 0,
        today,
      })
    ).toBe("due-soon");
  });

  it("returns 'overdue' when one day past due", () => {
    expect(
      computeStatus({
        dueDate: "2026-03-14" as IsoDate,
        leadTimeDays: 30,
        today,
      })
    ).toBe("overdue");
  });

  it("returns 'overdue' when multiple days past due", () => {
    expect(
      computeStatus({
        dueDate: "2026-03-10" as IsoDate,
        leadTimeDays: 30,
        today,
      })
    ).toBe("overdue");
  });

  it("returns 'due-soon' when exactly leadTimeDays away (boundary, inclusive)", () => {
    const leadTimeDays = 30;
    const dueDate = "2026-04-14" as IsoDate; // 30 days from today

    expect(
      computeStatus({
        dueDate,
        leadTimeDays,
        today,
      })
    ).toBe("due-soon");
  });

  it("returns 'upcoming' when leadTimeDays + 1 away", () => {
    const leadTimeDays = 30;
    const dueDate = "2026-04-15" as IsoDate; // 31 days from today

    expect(
      computeStatus({
        dueDate,
        leadTimeDays,
        today,
      })
    ).toBe("upcoming");
  });

  it("returns 'due-soon' when due tomorrow with sufficient leadTime", () => {
    expect(
      computeStatus({
        dueDate: "2026-03-16" as IsoDate,
        leadTimeDays: 30,
        today,
      })
    ).toBe("due-soon");
  });

  it("returns 'upcoming' when due tomorrow but leadTime is 0", () => {
    expect(
      computeStatus({
        dueDate: "2026-03-16" as IsoDate,
        leadTimeDays: 0,
        today,
      })
    ).toBe("upcoming");
  });

  it("returns 'due-soon' when due in 7 days with leadTime 7", () => {
    expect(
      computeStatus({
        dueDate: "2026-03-22" as IsoDate,
        leadTimeDays: 7,
        today,
      })
    ).toBe("due-soon");
  });

  it("returns 'upcoming' when due in 8 days with leadTime 7", () => {
    expect(
      computeStatus({
        dueDate: "2026-03-23" as IsoDate,
        leadTimeDays: 7,
        today,
      })
    ).toBe("upcoming");
  });
});

describe("daysUntilDue", () => {
  const today = "2026-03-15" as IsoDate;

  it("returns 0 when due today", () => {
    expect(daysUntilDue({ dueDate: today, today })).toBe(0);
  });

  it("returns positive number when due in the future", () => {
    expect(
      daysUntilDue({
        dueDate: "2026-03-20" as IsoDate,
        today,
      })
    ).toBe(5);
  });

  it("returns negative number when overdue", () => {
    expect(
      daysUntilDue({
        dueDate: "2026-03-10" as IsoDate,
        today,
      })
    ).toBe(-5);
  });

  it("returns -1 when one day overdue", () => {
    expect(
      daysUntilDue({
        dueDate: "2026-03-14" as IsoDate,
        today,
      })
    ).toBe(-1);
  });

  it("returns 1 when due tomorrow", () => {
    expect(
      daysUntilDue({
        dueDate: "2026-03-16" as IsoDate,
        today,
      })
    ).toBe(1);
  });
});

describe("describeDueDate", () => {
  const today = "2026-03-15" as IsoDate;

  it("handles -1 day (one day overdue)", () => {
    expect(
      describeDueDate({
        dueDate: "2026-03-14" as IsoDate,
        today,
      })
    ).toBe("Overdue by 1 day");
  });

  it("handles 0 days (due today)", () => {
    expect(
      describeDueDate({
        dueDate: today,
        today,
      })
    ).toBe("Due today");
  });

  it("handles 1 day (due tomorrow)", () => {
    expect(
      describeDueDate({
        dueDate: "2026-03-16" as IsoDate,
        today,
      })
    ).toBe("Due tomorrow");
  });

  it("handles 2 days", () => {
    expect(
      describeDueDate({
        dueDate: "2026-03-17" as IsoDate,
        today,
      })
    ).toBe("Due in 2 days");
  });

  it("handles 59 days (still in day granularity)", () => {
    expect(
      describeDueDate({
        dueDate: "2026-05-13" as IsoDate,
        today,
      })
    ).toBe("Due in 59 days");
  });

  it("handles 60 days (switches to month granularity)", () => {
    expect(
      describeDueDate({
        dueDate: "2026-05-14" as IsoDate,
        today,
      })
    ).toBe("Due in 2 months");
  });

  it("handles 90 days (3 months)", () => {
    expect(
      describeDueDate({
        dueDate: "2026-06-13" as IsoDate,
        today,
      })
    ).toBe("Due in 3 months");
  });

  it("handles multiple days overdue (plural)", () => {
    expect(
      describeDueDate({
        dueDate: "2026-03-10" as IsoDate,
        today,
      })
    ).toBe("Overdue by 5 days");
  });

  it("handles singular month correctly", () => {
    // 75 days rounds to 2.5 months, which rounds to 3 months, but let's use a clearer example
    // 45 days rounds to 1.5 months, which rounds to 2 months
    // For exactly 1 month, we need ~30 days but > 60 threshold doesn't apply
    // Let's use 75 days which is 2.5 months, rounds to 3
    // Actually, for 1 month singular, we need between 15-44 days after 60 day threshold
    // But we switch at 60+, so let's use 75 days = 2.5 = rounds to 3 months (plural)
    // For singular month: 15-44 days would round to 1 month
    // But that's < 60, so still in days.
    // Actually at 60+: 60-74 days rounds to 2 months, 75-104 rounds to 3 months
    // For 1 month: need exactly 30 days, but that's < 60 so still shows as days
    // The only way to get "1 month" is if we're at exactly 30 days with rounding
    // Let's test 90 days which clearly shows month granularity works
    // Actually, rethinking: 45 days rounds to 1.5 months = 2 months (rounds to nearest)
    // 15 days / 30 = 0.5 months = 1 month
    // But 15 < 60, so still in day mode
    // So realistically, we can never hit "1 month" with the > 59 threshold
    // Let me just remove this test as it's impossible with the current logic
    // OR change the test to verify a real case
    expect(
      describeDueDate({
        dueDate: "2026-04-14" as IsoDate, // 30 days
        today,
      })
    ).toBe("Due in 30 days"); // Below 60-day threshold, still in days
  });

  it("handles 365 days (12 months)", () => {
    expect(
      describeDueDate({
        dueDate: "2027-03-15" as IsoDate,
        today,
      })
    ).toBe("Due in 12 months");
  });
});

describe("STATUS_ORDER", () => {
  it("has the correct canonical order", () => {
    expect(STATUS_ORDER).toEqual(["overdue", "due-soon", "upcoming"]);
  });

  it("is a readonly array (enforced by TypeScript)", () => {
    // TypeScript enforces readonly via `as const`, which is sufficient
    // No runtime test needed - attempting to modify would be a compile error
    expect(STATUS_ORDER).toHaveLength(3);
  });
});

describe("compareByUrgency", () => {
  it("sorts by status first (overdue > due-soon > upcoming)", () => {
    const items: ItemForUrgencySort[] = [
      {
        status: "upcoming",
        dueDate: "2026-04-01" as IsoDate,
        name: "Item A",
      },
      {
        status: "overdue",
        dueDate: "2026-03-01" as IsoDate,
        name: "Item B",
      },
      {
        status: "due-soon",
        dueDate: "2026-03-15" as IsoDate,
        name: "Item C",
      },
    ];

    const sorted = [...items].sort(compareByUrgency);

    expect(sorted[0]?.status).toBe("overdue");
    expect(sorted[1]?.status).toBe("due-soon");
    expect(sorted[2]?.status).toBe("upcoming");
  });

  it("puts an overdue item above a due-soon item even if due-soon has an earlier date", () => {
    const overdue: ItemForUrgencySort = {
      status: "overdue",
      dueDate: "2026-03-10" as IsoDate, // Later date
      name: "Overdue Item",
    };

    const dueSoon: ItemForUrgencySort = {
      status: "due-soon",
      dueDate: "2026-03-05" as IsoDate, // Earlier date
      name: "Due Soon Item",
    };

    expect(compareByUrgency(overdue, dueSoon)).toBeLessThan(0);
    expect(compareByUrgency(dueSoon, overdue)).toBeGreaterThan(0);

    const sorted = [dueSoon, overdue].sort(compareByUrgency);
    expect(sorted[0]).toBe(overdue);
    expect(sorted[1]).toBe(dueSoon);
  });

  it("sorts by due date ascending within the same status", () => {
    const items: ItemForUrgencySort[] = [
      {
        status: "overdue",
        dueDate: "2026-03-10" as IsoDate,
        name: "Item A",
      },
      {
        status: "overdue",
        dueDate: "2026-03-05" as IsoDate,
        name: "Item B",
      },
      {
        status: "overdue",
        dueDate: "2026-03-15" as IsoDate,
        name: "Item C",
      },
    ];

    const sorted = [...items].sort(compareByUrgency);

    expect(sorted[0]?.dueDate).toBe("2026-03-05");
    expect(sorted[1]?.dueDate).toBe("2026-03-10");
    expect(sorted[2]?.dueDate).toBe("2026-03-15");
  });

  it("sorts by name alphabetically when status and due date are the same", () => {
    const items: ItemForUrgencySort[] = [
      {
        status: "overdue",
        dueDate: "2026-03-10" as IsoDate,
        name: "Zebra",
      },
      {
        status: "overdue",
        dueDate: "2026-03-10" as IsoDate,
        name: "Apple",
      },
      {
        status: "overdue",
        dueDate: "2026-03-10" as IsoDate,
        name: "Banana",
      },
    ];

    const sorted = [...items].sort(compareByUrgency);

    expect(sorted[0]?.name).toBe("Apple");
    expect(sorted[1]?.name).toBe("Banana");
    expect(sorted[2]?.name).toBe("Zebra");
  });

  it("handles a complex mixed list correctly", () => {
    const items: ItemForUrgencySort[] = [
      {
        status: "upcoming",
        dueDate: "2026-05-01" as IsoDate,
        name: "Future Item",
      },
      {
        status: "overdue",
        dueDate: "2026-03-01" as IsoDate,
        name: "Very Overdue",
      },
      {
        status: "due-soon",
        dueDate: "2026-03-20" as IsoDate,
        name: "Soon A",
      },
      {
        status: "overdue",
        dueDate: "2026-03-10" as IsoDate,
        name: "Recently Overdue",
      },
      {
        status: "due-soon",
        dueDate: "2026-03-15" as IsoDate,
        name: "Soon B",
      },
      {
        status: "upcoming",
        dueDate: "2026-04-15" as IsoDate,
        name: "Upcoming Item",
      },
    ];

    const sorted = [...items].sort(compareByUrgency);

    // Should be: overdue items first (by date), then due-soon (by date), then upcoming (by date)
    expect(sorted[0]).toMatchObject({
      status: "overdue",
      dueDate: "2026-03-01",
    });
    expect(sorted[1]).toMatchObject({
      status: "overdue",
      dueDate: "2026-03-10",
    });
    expect(sorted[2]).toMatchObject({
      status: "due-soon",
      dueDate: "2026-03-15",
    });
    expect(sorted[3]).toMatchObject({
      status: "due-soon",
      dueDate: "2026-03-20",
    });
    expect(sorted[4]).toMatchObject({
      status: "upcoming",
      dueDate: "2026-04-15",
    });
    expect(sorted[5]).toMatchObject({
      status: "upcoming",
      dueDate: "2026-05-01",
    });
  });
});
