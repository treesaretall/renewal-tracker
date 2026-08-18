import { describe, expect, it } from "vitest";
import {
  createRenewalItemSchema,
  markRenewedSchema,
  renewalItemListQuerySchema,
  renewalItemSchema,
  updateRenewalItemSchema,
} from "./item.js";

describe("renewalItemSchema", () => {
  it("accepts valid renewal item", () => {
    const item = {
      id: "clh123456",
      name: "Car Insurance",
      category: "insurance",
      provider: "Acme Insurance",
      dueDate: "2026-12-31",
      costCents: 50000,
      currency: "USD",
      recurrence: "annual",
      leadTimeDaysOverride: 30,
      notes: "Important note",
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(renewalItemSchema.parse(item)).toEqual(item);
  });

  it("trims name whitespace", () => {
    const item = {
      id: "clh123456",
      name: "  Car Insurance  ",
      category: "insurance",
      dueDate: "2026-12-31",
      currency: "USD",
      recurrence: "annual",
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const parsed = renewalItemSchema.parse(item);
    expect(parsed.name).toBe("Car Insurance");
  });
});

describe("createRenewalItemSchema", () => {
  const validBase = {
    name: "Car Insurance",
    category: "insurance" as const,
    dueDate: "2026-12-31",
    currency: "USD",
    recurrence: "annual" as const,
  };

  it("accepts valid creation data", () => {
    expect(createRenewalItemSchema.parse(validBase)).toMatchObject(validBase);
  });

  it("fails when recurrence is custom without recurrenceMonths", () => {
    const data = {
      ...validBase,
      recurrence: "custom" as const,
    };

    const result = createRenewalItemSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "recurrenceMonths",
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("required when recurrence is custom");
    }
  });

  it("succeeds when recurrence is custom with recurrenceMonths", () => {
    const data = {
      ...validBase,
      recurrence: "custom" as const,
      recurrenceMonths: 18,
    };
    expect(createRenewalItemSchema.parse(data)).toMatchObject(data);
  });

  it("fails when recurrence is annual with recurrenceMonths", () => {
    const data = {
      ...validBase,
      recurrence: "annual" as const,
      recurrenceMonths: 12,
    };

    const result = createRenewalItemSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "recurrenceMonths",
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toContain(
        "must be absent when recurrence is not custom",
      );
    }
  });
});

describe("updateRenewalItemSchema", () => {
  it("accepts partial update", () => {
    const update = { name: "Updated Name" };
    expect(updateRenewalItemSchema.parse(update)).toEqual(update);
  });

  it("fails with empty update object", () => {
    const result = updateRenewalItemSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "At least one field must be provided",
      );
    }
  });

  it("validates custom recurrence rule on partial updates", () => {
    const data = {
      recurrence: "custom" as const,
    };

    const result = updateRenewalItemSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "recurrenceMonths",
      );
      expect(issue).toBeDefined();
    }
  });

  it("allows updating recurrenceMonths when recurrence is custom", () => {
    const data = {
      recurrence: "custom" as const,
      recurrenceMonths: 24,
    };
    expect(updateRenewalItemSchema.parse(data)).toEqual(data);
  });
});

describe("renewalItemListQuerySchema", () => {
  it("transforms comma-separated categories into array", () => {
    const query = { categories: "insurance,license" };
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed.categories).toEqual(["insurance", "license"]);
  });

  it("transforms comma-separated statuses into array", () => {
    const query = { statuses: "overdue,due-soon" };
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed.statuses).toEqual(["overdue", "due-soon"]);
  });

  it("applies sort default to dueDate", () => {
    const query = {};
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed.sort).toBe("dueDate");
  });

  it("applies direction default to asc", () => {
    const query = {};
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed.direction).toBe("asc");
  });

  it("coerces includeArchived from string to boolean", () => {
    const queryTrue = { includeArchived: "true" };
    const parsedTrue = renewalItemListQuerySchema.parse(queryTrue);
    expect(parsedTrue.includeArchived).toBe(true);

    const queryFalse = { includeArchived: "false" };
    const parsedFalse = renewalItemListQuerySchema.parse(queryFalse);
    expect(parsedFalse.includeArchived).toBe(false);
  });

  it("defaults includeArchived to false when not provided", () => {
    const query = {};
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed.includeArchived).toBe(false);
  });

  it("handles all query params together", () => {
    const query = {
      categories: "insurance,license",
      statuses: "overdue",
      search: "car",
      includeArchived: "true",
      from: "2026-01-01",
      to: "2026-12-31",
      sort: "name",
      direction: "desc",
    };
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed).toEqual({
      categories: ["insurance", "license"],
      statuses: ["overdue"],
      search: "car",
      includeArchived: true,
      from: "2026-01-01",
      to: "2026-12-31",
      sort: "name",
      direction: "desc",
    });
  });

  it("handles undefined categories and statuses", () => {
    const query = {};
    const parsed = renewalItemListQuerySchema.parse(query);
    expect(parsed.categories).toBeUndefined();
    expect(parsed.statuses).toBeUndefined();
  });
});

describe("markRenewedSchema", () => {
  it("accepts valid renew data", () => {
    const data = {
      renewedOn: "2026-08-15",
      costCents: 50000,
      notes: "Renewed successfully",
      nextDueDate: "2027-08-15",
    };
    expect(markRenewedSchema.parse(data)).toEqual(data);
  });

  it("accepts minimal renew data with only renewedOn", () => {
    const data = { renewedOn: "2026-08-15" };
    expect(markRenewedSchema.parse(data)).toEqual(data);
  });

  it("validates renewedOn as ISO date", () => {
    const data = { renewedOn: "invalid-date" };
    const result = markRenewedSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
