import type { Category } from "../schemas/primitives.js";
import type { ReminderSettings } from "../schemas/settings.js";

export interface ResolveLeadTimeInput {
  itemOverride: number | null | undefined;
  category: Category;
  settings: ReminderSettings;
}

/**
 * Resolves the lead time in days for a renewal item.
 *
 * Precedence (highest first):
 * 1. Item's own leadTimeDaysOverride
 * 2. Category-specific default from settings.categoryLeadTimes[category]
 * 3. Global default from settings.defaultLeadTimeDays
 *
 * Both null and undefined are treated as "not set".
 * 0 is a valid override and will not fall through.
 */
export function resolveLeadTimeDays(input: ResolveLeadTimeInput): number {
  const { itemOverride, category, settings } = input;

  // Check item override (0 is valid, so check for null/undefined explicitly)
  if (itemOverride !== null && itemOverride !== undefined) {
    return itemOverride;
  }

  // Check category default
  const categoryDefault = settings.categoryLeadTimes[category];
  if (categoryDefault !== null && categoryDefault !== undefined) {
    return categoryDefault;
  }

  // Fall back to global default
  return settings.defaultLeadTimeDays;
}

/**
 * Describes which source provided the lead time value.
 *
 * Returns:
 * - "item" if the item's own override is set
 * - "category" if using the category-specific default from settings
 * - "default" if using the global default from settings
 */
export function describeLeadTimeSource(
  input: ResolveLeadTimeInput
): "item" | "category" | "default" {
  const { itemOverride, category, settings } = input;

  // Check item override (0 is valid, so check for null/undefined explicitly)
  if (itemOverride !== null && itemOverride !== undefined) {
    return "item";
  }

  // Check category default
  const categoryDefault = settings.categoryLeadTimes[category];
  if (categoryDefault !== null && categoryDefault !== undefined) {
    return "category";
  }

  // Fall back to global default
  return "default";
}
