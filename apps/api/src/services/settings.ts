import { db } from "../db.js";
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
  type Category,
} from "@renewal/shared";

/**
 * Load reminder settings for a user from the database and assemble into a
 * complete ReminderSettings object.
 *
 * Assembles categoryLeadTimes as a complete Record<Category, number | null>
 * with every category present (null where unset). Returning a complete record
 * rather than a sparse one keeps the client's form logic trivial — the form
 * can iterate over all categories and bind each field without conditional checks.
 *
 * If the settings row is missing, creates it from DEFAULT_REMINDER_SETTINGS.
 */
export async function getSettingsForUser(
  userId: string
): Promise<ReminderSettings> {
  let settings = await db.reminderSettings.findUnique({
    where: { userId },
  });

  // Create settings if missing (shouldn't happen in normal flow since signup
  // creates them, but handle it gracefully rather than 404ing)
  if (!settings) {
    settings = await db.reminderSettings.create({
      data: {
        userId,
        defaultLeadTimeDays: DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays,
        weekStartsOn: DEFAULT_REMINDER_SETTINGS.weekStartsOn,
        dateFormat: DEFAULT_REMINDER_SETTINGS.dateFormat,
      },
    });
  }

  const categoryLeadTimes = await db.categoryLeadTime.findMany({
    where: { userId },
  });

  // Start with all categories as null, then overlay any existing rows
  const categoryLeadTimesMap: Record<Category, number | null> = {
    insurance: null,
    registration: null,
    license: null,
    warranty: null,
    subscription: null,
    other: null,
  };

  for (const entry of categoryLeadTimes) {
    categoryLeadTimesMap[entry.category as Category] = entry.leadTimeDays;
  }

  return {
    defaultLeadTimeDays: settings.defaultLeadTimeDays,
    weekStartsOn: settings.weekStartsOn as 0 | 1,
    dateFormat: settings.dateFormat as
      | "yyyy-MM-dd"
      | "dd/MM/yyyy"
      | "MM/dd/yyyy",
    categoryLeadTimes: categoryLeadTimesMap,
  };
}
