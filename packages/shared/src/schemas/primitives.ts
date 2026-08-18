import { format, parse } from "date-fns";
import { z } from "zod";

// ISO date string (YYYY-MM-DD) with validation for impossible dates
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
  .refine(
    (value) => {
      const parsed = parse(value, "yyyy-MM-dd", new Date());
      if (isNaN(parsed.getTime())) return false;
      const roundTrip = format(parsed, "yyyy-MM-dd");
      return roundTrip === value;
    },
    { message: "Invalid date" },
  )
  .brand<"IsoDate">();

export type IsoDate = z.infer<typeof isoDateSchema>;

// Category enum
export const categorySchema = z.enum([
  "insurance",
  "registration",
  "license",
  "warranty",
  "subscription",
  "other",
]);

export type Category = z.infer<typeof categorySchema>;
export const CATEGORIES = categorySchema.options;

// Recurrence enum
export const recurrenceSchema = z.enum([
  "none",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "custom",
]);

export type Recurrence = z.infer<typeof recurrenceSchema>;
export const RECURRENCES = recurrenceSchema.options;

// Status enum
export const statusSchema = z.enum(["overdue", "due-soon", "upcoming"]);

export type RenewalStatus = z.infer<typeof statusSchema>;
export const STATUSES = statusSchema.options;

// Lead time days
export const leadTimeDaysSchema = z.number().int().min(0).max(365);

export type LeadTimeDays = z.infer<typeof leadTimeDaysSchema>;

// Cost in cents
export const costCentsSchema = z.number().int().min(0).max(100_000_000);

export type CostCents = z.infer<typeof costCentsSchema>;

// Currency code
export const currencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Must be 3-letter uppercase ISO code")
  .default("USD");

export type Currency = z.infer<typeof currencySchema>;

// Week starts on (0 = Sunday, 1 = Monday)
export const weekStartsOnSchema = z.union([z.literal(0), z.literal(1)]);

export type WeekStartsOn = z.infer<typeof weekStartsOnSchema>;

// CUID for IDs
export const cuidSchema = z.string().min(1);

export type Cuid = z.infer<typeof cuidSchema>;
