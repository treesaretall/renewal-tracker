import { describe, it, expect } from "vitest";
import type { ReminderSettings } from "../schemas/settings.js";
import {
  resolveLeadTimeDays,
  describeLeadTimeSource,
  type ResolveLeadTimeInput,
} from "./leadTime.js";

describe("resolveLeadTimeDays", () => {
  it("follows precedence hierarchy with table-driven tests", () => {
    const cases: Array<{
      name: string;
      itemOverride: number | null | undefined;
      categoryDefault: number | null;
      globalDefault: number;
      expected: number;
      expectedSource: "item" | "category" | "default";
    }> = [
      // All three levels set
      {
        name: "item override takes precedence over category and global",
        itemOverride: 10,
        categoryDefault: 20,
        globalDefault: 30,
        expected: 10,
        expectedSource: "item",
      },
      // Only item and global set (category unset)
      {
        name: "item override takes precedence over global when category unset",
        itemOverride: 10,
        categoryDefault: null,
        globalDefault: 30,
        expected: 10,
        expectedSource: "item",
      },
      // Only category and global set (item unset with null)
      {
        name: "category default used when item is null",
        itemOverride: null,
        categoryDefault: 20,
        globalDefault: 30,
        expected: 20,
        expectedSource: "category",
      },
      // Only category and global set (item unset with undefined)
      {
        name: "category default used when item is undefined",
        itemOverride: undefined,
        categoryDefault: 20,
        globalDefault: 30,
        expected: 20,
        expectedSource: "category",
      },
      // Only global set (both item and category unset)
      {
        name: "global default used when both item and category are null",
        itemOverride: null,
        categoryDefault: null,
        globalDefault: 30,
        expected: 30,
        expectedSource: "default",
      },
      {
        name: "global default used when item is undefined and category is null",
        itemOverride: undefined,
        categoryDefault: null,
        globalDefault: 30,
        expected: 30,
        expectedSource: "default",
      },
      // Critical: 0 is a valid override at item level
      {
        name: "item override of 0 is respected (not treated as falsy)",
        itemOverride: 0,
        categoryDefault: 20,
        globalDefault: 30,
        expected: 0,
        expectedSource: "item",
      },
      // Critical: 0 is a valid override at category level
      {
        name: "category default of 0 is respected (not treated as falsy)",
        itemOverride: null,
        categoryDefault: 0,
        globalDefault: 30,
        expected: 0,
        expectedSource: "category",
      },
      // Edge case: 0 at global level (should work as expected)
      {
        name: "global default of 0 is used when item and category are unset",
        itemOverride: null,
        categoryDefault: null,
        globalDefault: 0,
        expected: 0,
        expectedSource: "default",
      },
    ];

    cases.forEach(
      ({
        name,
        itemOverride,
        categoryDefault,
        globalDefault,
        expected,
        expectedSource,
      }) => {
        const settings: ReminderSettings = {
          defaultLeadTimeDays: globalDefault,
          weekStartsOn: 0,
          dateFormat: "MM/dd/yyyy",
          categoryLeadTimes: {
            insurance: categoryDefault,
            registration: null,
            license: null,
            warranty: null,
            subscription: null,
            other: null,
          },
        };

        const input: ResolveLeadTimeInput = {
          itemOverride,
          category: "insurance",
          settings,
        };

        expect(resolveLeadTimeDays(input), name).toBe(expected);
        expect(describeLeadTimeSource(input), `${name} (source)`).toBe(
          expectedSource
        );
      }
    );
  });

  it("respects category-specific defaults for different categories", () => {
    const settings: ReminderSettings = {
      defaultLeadTimeDays: 30,
      weekStartsOn: 0,
      dateFormat: "MM/dd/yyyy",
      categoryLeadTimes: {
        insurance: 45,
        registration: 14,
        license: null,
        warranty: 60,
        subscription: 7,
        other: null,
      },
    };

    expect(
      resolveLeadTimeDays({
        itemOverride: null,
        category: "insurance",
        settings,
      })
    ).toBe(45);

    expect(
      resolveLeadTimeDays({
        itemOverride: null,
        category: "registration",
        settings,
      })
    ).toBe(14);

    expect(
      resolveLeadTimeDays({
        itemOverride: null,
        category: "license",
        settings,
      })
    ).toBe(30); // Falls back to global default

    expect(
      resolveLeadTimeDays({
        itemOverride: null,
        category: "warranty",
        settings,
      })
    ).toBe(60);

    expect(
      resolveLeadTimeDays({
        itemOverride: null,
        category: "subscription",
        settings,
      })
    ).toBe(7);

    expect(
      resolveLeadTimeDays({
        itemOverride: null,
        category: "other",
        settings,
      })
    ).toBe(30); // Falls back to global default
  });
});

describe("describeLeadTimeSource", () => {
  const settings: ReminderSettings = {
    defaultLeadTimeDays: 30,
    weekStartsOn: 0,
    dateFormat: "MM/dd/yyyy",
    categoryLeadTimes: {
      insurance: 45,
      registration: null,
      license: null,
      warranty: null,
      subscription: null,
      other: null,
    },
  };

  it('returns "item" when item override is set', () => {
    expect(
      describeLeadTimeSource({
        itemOverride: 10,
        category: "insurance",
        settings,
      })
    ).toBe("item");
  });

  it('returns "item" when item override is 0', () => {
    expect(
      describeLeadTimeSource({
        itemOverride: 0,
        category: "insurance",
        settings,
      })
    ).toBe("item");
  });

  it('returns "category" when item is unset but category default is set', () => {
    expect(
      describeLeadTimeSource({
        itemOverride: null,
        category: "insurance",
        settings,
      })
    ).toBe("category");
  });

  it('returns "category" when category default is 0', () => {
    const settingsWithZeroCategory: ReminderSettings = {
      ...settings,
      categoryLeadTimes: {
        ...settings.categoryLeadTimes,
        registration: 0,
      },
    };

    expect(
      describeLeadTimeSource({
        itemOverride: null,
        category: "registration",
        settings: settingsWithZeroCategory,
      })
    ).toBe("category");
  });

  it('returns "default" when both item and category are unset', () => {
    expect(
      describeLeadTimeSource({
        itemOverride: null,
        category: "registration",
        settings,
      })
    ).toBe("default");
  });

  it('returns "default" when item is undefined and category is null', () => {
    expect(
      describeLeadTimeSource({
        itemOverride: undefined,
        category: "registration",
        settings,
      })
    ).toBe("default");
  });
});
