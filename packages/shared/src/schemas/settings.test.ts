import { describe, expect, it } from "vitest";
import {
  dateFormatSchema,
  DEFAULT_REMINDER_SETTINGS,
  reminderSettingsSchema,
  updateReminderSettingsSchema,
} from "./settings.js";

describe("dateFormatSchema", () => {
  it("accepts valid date formats", () => {
    expect(dateFormatSchema.parse("yyyy-MM-dd")).toBe("yyyy-MM-dd");
    expect(dateFormatSchema.parse("dd/MM/yyyy")).toBe("dd/MM/yyyy");
    expect(dateFormatSchema.parse("MM/dd/yyyy")).toBe("MM/dd/yyyy");
  });

  it("rejects invalid date formats", () => {
    expect(() => dateFormatSchema.parse("dd-MM-yyyy")).toThrow();
    expect(() => dateFormatSchema.parse("MM/DD/YYYY")).toThrow();
  });
});

describe("reminderSettingsSchema", () => {
  const validSettings = {
    defaultLeadTimeDays: 30,
    weekStartsOn: 0 as const,
    dateFormat: "MM/dd/yyyy" as const,
    categoryLeadTimes: {
      insurance: 45,
      registration: 14,
      license: null,
      warranty: null,
      subscription: 7,
      other: null,
    },
  };

  it("accepts valid settings", () => {
    expect(reminderSettingsSchema.parse(validSettings)).toEqual(validSettings);
  });

  it("accepts all categoryLeadTimes as null", () => {
    const settings = {
      ...validSettings,
      categoryLeadTimes: {
        insurance: null,
        registration: null,
        license: null,
        warranty: null,
        subscription: null,
        other: null,
      },
    };
    expect(reminderSettingsSchema.parse(settings)).toEqual(settings);
  });

  it("rejects invalid defaultLeadTimeDays", () => {
    const settings = {
      ...validSettings,
      defaultLeadTimeDays: 400,
    };
    expect(() => reminderSettingsSchema.parse(settings)).toThrow();
  });

  it("rejects invalid weekStartsOn", () => {
    const settings = {
      ...validSettings,
      weekStartsOn: 2,
    };
    expect(() => reminderSettingsSchema.parse(settings)).toThrow();
  });
});

describe("updateReminderSettingsSchema", () => {
  it("accepts partial update with one field", () => {
    const update = { defaultLeadTimeDays: 45 };
    expect(updateReminderSettingsSchema.parse(update)).toEqual(update);
  });

  it("accepts partial update with categoryLeadTimes", () => {
    const update = {
      categoryLeadTimes: {
        insurance: 60,
        registration: 14,
        license: null,
        warranty: null,
        subscription: null,
        other: null,
      },
    };
    expect(updateReminderSettingsSchema.parse(update)).toEqual(update);
  });

  it("accepts multiple fields", () => {
    const update = {
      defaultLeadTimeDays: 45,
      dateFormat: "yyyy-MM-dd" as const,
    };
    expect(updateReminderSettingsSchema.parse(update)).toEqual(update);
  });

  it("fails with empty update object (zero keys)", () => {
    const result = updateReminderSettingsSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "At least one field must be provided",
      );
    }
  });

  it("validates lead time constraints in partial updates", () => {
    const update = { defaultLeadTimeDays: 500 };
    const result = updateReminderSettingsSchema.safeParse(update);
    expect(result.success).toBe(false);
  });
});

describe("DEFAULT_REMINDER_SETTINGS", () => {
  it("has expected default values", () => {
    expect(DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays).toBe(30);
    expect(DEFAULT_REMINDER_SETTINGS.weekStartsOn).toBe(0);
    expect(DEFAULT_REMINDER_SETTINGS.dateFormat).toBe("MM/dd/yyyy");
  });

  it("has all categoryLeadTimes set to null", () => {
    const leadTimes = DEFAULT_REMINDER_SETTINGS.categoryLeadTimes;
    expect(leadTimes.insurance).toBe(null);
    expect(leadTimes.registration).toBe(null);
    expect(leadTimes.license).toBe(null);
    expect(leadTimes.warranty).toBe(null);
    expect(leadTimes.subscription).toBe(null);
    expect(leadTimes.other).toBe(null);
  });

  it("is valid according to reminderSettingsSchema", () => {
    expect(
      reminderSettingsSchema.parse(DEFAULT_REMINDER_SETTINGS),
    ).toEqual(DEFAULT_REMINDER_SETTINGS);
  });
});
