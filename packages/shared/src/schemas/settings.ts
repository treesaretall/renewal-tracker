import { z } from "zod";
import {
  categorySchema,
  leadTimeDaysSchema,
  weekStartsOnSchema,
  type Category,
} from "./primitives.js";

// Date format options
export const dateFormatSchema = z.enum([
  "yyyy-MM-dd",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
]);

export type DateFormat = z.infer<typeof dateFormatSchema>;

// Category-specific lead time overrides (null = inherit default)
const categoryLeadTimesSchema = z.record(
  categorySchema,
  z.union([leadTimeDaysSchema, z.null()]),
);

// Reminder settings schema
export const reminderSettingsSchema = z.object({
  defaultLeadTimeDays: leadTimeDaysSchema,
  weekStartsOn: weekStartsOnSchema,
  dateFormat: dateFormatSchema,
  categoryLeadTimes: categoryLeadTimesSchema,
});

export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

// Update schema - deep partial with at least one key required
// For categoryLeadTimes, we use a partial object (not record) to allow
// updating only specific categories rather than requiring all categories.
export const updateReminderSettingsSchema = z
  .object({
    defaultLeadTimeDays: leadTimeDaysSchema.optional(),
    weekStartsOn: weekStartsOnSchema.optional(),
    dateFormat: dateFormatSchema.optional(),
    categoryLeadTimes: z
      .object({
        insurance: z.union([leadTimeDaysSchema, z.null()]).optional(),
        registration: z.union([leadTimeDaysSchema, z.null()]).optional(),
        license: z.union([leadTimeDaysSchema, z.null()]).optional(),
        warranty: z.union([leadTimeDaysSchema, z.null()]).optional(),
        subscription: z.union([leadTimeDaysSchema, z.null()]).optional(),
        other: z.union([leadTimeDaysSchema, z.null()]).optional(),
      })
      .strict()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided",
        path: [],
      });
    }
  });

export type UpdateReminderSettings = z.infer<
  typeof updateReminderSettingsSchema
>;

// Default settings
// Note: Sensible per-category defaults (e.g., 14 days for registration) are
// settings-page suggestions, not hidden server behavior. The user must explicitly
// set them if they want different lead times per category.
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  defaultLeadTimeDays: 30,
  weekStartsOn: 0,
  dateFormat: "MM/dd/yyyy",
  categoryLeadTimes: {
    insurance: null,
    registration: null,
    license: null,
    warranty: null,
    subscription: null,
    other: null,
  },
} as const satisfies ReminderSettings;
