import { describe, expect, it } from "vitest";
import {
  categorySchema,
  costCentsSchema,
  cuidSchema,
  currencySchema,
  isoDateSchema,
  leadTimeDaysSchema,
  recurrenceSchema,
  statusSchema,
  weekStartsOnSchema,
  CATEGORIES,
  RECURRENCES,
  STATUSES,
} from "./primitives.js";

describe("isoDateSchema", () => {
  it("accepts valid ISO date", () => {
    expect(isoDateSchema.parse("2026-02-04")).toBe("2026-02-04");
    expect(isoDateSchema.parse("2026-12-31")).toBe("2026-12-31");
    expect(isoDateSchema.parse("2024-02-29")).toBe("2024-02-29"); // leap year
  });

  it("rejects impossible date 2026-02-31", () => {
    expect(() => isoDateSchema.parse("2026-02-31")).toThrow();
  });

  it("rejects date without leading zeros 2026-2-4", () => {
    expect(() => isoDateSchema.parse("2026-2-4")).toThrow();
  });

  it("rejects two-digit year 26-02-04", () => {
    expect(() => isoDateSchema.parse("26-02-04")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => isoDateSchema.parse("")).toThrow();
  });

  it("rejects ISO timestamp 2026-02-04T00:00:00Z", () => {
    expect(() => isoDateSchema.parse("2026-02-04T00:00:00Z")).toThrow();
  });
});

describe("categorySchema", () => {
  it("accepts valid category", () => {
    expect(categorySchema.parse("insurance")).toBe("insurance");
    expect(categorySchema.parse("other")).toBe("other");
  });

  it("rejects unknown category", () => {
    expect(() => categorySchema.parse("unknown")).toThrow();
    expect(() => categorySchema.parse("")).toThrow();
  });

  it("exports CATEGORIES array", () => {
    expect(CATEGORIES).toEqual([
      "insurance",
      "registration",
      "license",
      "warranty",
      "subscription",
      "other",
    ]);
  });
});

describe("recurrenceSchema", () => {
  it("accepts valid recurrence", () => {
    expect(recurrenceSchema.parse("none")).toBe("none");
    expect(recurrenceSchema.parse("annual")).toBe("annual");
  });

  it("exports RECURRENCES array", () => {
    expect(RECURRENCES).toEqual([
      "none",
      "monthly",
      "quarterly",
      "semiannual",
      "annual",
      "custom",
    ]);
  });
});

describe("statusSchema", () => {
  it("accepts valid status", () => {
    expect(statusSchema.parse("overdue")).toBe("overdue");
    expect(statusSchema.parse("due-soon")).toBe("due-soon");
  });

  it("exports STATUSES array", () => {
    expect(STATUSES).toEqual(["overdue", "due-soon", "upcoming"]);
  });
});

describe("leadTimeDaysSchema", () => {
  it("accepts valid values", () => {
    expect(leadTimeDaysSchema.parse(0)).toBe(0);
    expect(leadTimeDaysSchema.parse(30)).toBe(30);
    expect(leadTimeDaysSchema.parse(365)).toBe(365);
  });

  it("rejects -1", () => {
    expect(() => leadTimeDaysSchema.parse(-1)).toThrow();
  });

  it("rejects 366", () => {
    expect(() => leadTimeDaysSchema.parse(366)).toThrow();
  });

  it("rejects 1.5", () => {
    expect(() => leadTimeDaysSchema.parse(1.5)).toThrow();
  });
});

describe("costCentsSchema", () => {
  it("accepts valid values", () => {
    expect(costCentsSchema.parse(0)).toBe(0);
    expect(costCentsSchema.parse(100_000_000)).toBe(100_000_000);
  });

  it("rejects negative values", () => {
    expect(() => costCentsSchema.parse(-1)).toThrow();
  });

  it("rejects floats", () => {
    expect(() => costCentsSchema.parse(99.99)).toThrow();
  });
});

describe("currencySchema", () => {
  it("accepts valid ISO currency code", () => {
    expect(currencySchema.parse("USD")).toBe("USD");
    expect(currencySchema.parse("EUR")).toBe("EUR");
    expect(currencySchema.parse("GBP")).toBe("GBP");
  });

  it("defaults to USD", () => {
    expect(currencySchema.parse(undefined)).toBe("USD");
  });

  it("rejects lowercase", () => {
    expect(() => currencySchema.parse("usd")).toThrow();
  });

  it("rejects wrong length", () => {
    expect(() => currencySchema.parse("US")).toThrow();
    expect(() => currencySchema.parse("USDA")).toThrow();
  });
});

describe("weekStartsOnSchema", () => {
  it("accepts 0 (Sunday)", () => {
    expect(weekStartsOnSchema.parse(0)).toBe(0);
  });

  it("accepts 1 (Monday)", () => {
    expect(weekStartsOnSchema.parse(1)).toBe(1);
  });

  it("rejects other values", () => {
    expect(() => weekStartsOnSchema.parse(2)).toThrow();
    expect(() => weekStartsOnSchema.parse(6)).toThrow();
  });
});

describe("cuidSchema", () => {
  it("accepts non-empty string", () => {
    expect(cuidSchema.parse("clh1234567890")).toBe("clh1234567890");
    expect(cuidSchema.parse("abc")).toBe("abc");
  });

  it("rejects empty string", () => {
    expect(() => cuidSchema.parse("")).toThrow();
  });
});
