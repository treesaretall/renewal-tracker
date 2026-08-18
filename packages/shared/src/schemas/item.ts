import { z } from "zod";
import {
  categorySchema,
  costCentsSchema,
  cuidSchema,
  currencySchema,
  isoDateSchema,
  leadTimeDaysSchema,
  recurrenceSchema,
  statusSchema,
} from "./primitives.js";

// Full server representation
export const renewalItemSchema = z.object({
  id: cuidSchema,
  name: z.string().trim().min(1).max(120),
  category: categorySchema,
  provider: z.string().trim().max(120).optional(),
  dueDate: isoDateSchema,
  costCents: costCentsSchema.optional(),
  currency: currencySchema,
  recurrence: recurrenceSchema,
  recurrenceMonths: z.number().int().min(1).max(120).optional(),
  leadTimeDaysOverride: leadTimeDaysSchema.optional(),
  notes: z.string().max(2000).optional(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RenewalItem = z.infer<typeof renewalItemSchema>;

// Currency without default for base schema
const currencyWithoutDefault = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Must be 3-letter uppercase ISO code");

// Base object for client-settable fields (no defaults)
const renewalItemBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: categorySchema,
  provider: z.string().trim().max(120).optional(),
  dueDate: isoDateSchema,
  costCents: costCentsSchema.optional(),
  currency: currencyWithoutDefault,
  recurrence: recurrenceSchema,
  recurrenceMonths: z.number().int().min(1).max(120).optional(),
  leadTimeDaysOverride: leadTimeDaysSchema.optional(),
  notes: z.string().max(2000).optional(),
});

// Validation helper for custom recurrence
const validateCustomRecurrence = (data: unknown, ctx: z.RefinementCtx) => {
  const typedData = data as {
    recurrence?: string;
    recurrenceMonths?: number;
  };

  if (typedData.recurrence === "custom") {
    if (!typedData.recurrenceMonths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrenceMonths is required when recurrence is custom",
        path: ["recurrenceMonths"],
      });
    }
  } else if (typedData.recurrence !== undefined) {
    if (typedData.recurrenceMonths !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrenceMonths must be absent when recurrence is not custom",
        path: ["recurrenceMonths"],
      });
    }
  }
};

// POST body - everything a client may set, with default for currency
export const createRenewalItemSchema = renewalItemBaseSchema
  .extend({
    currency: currencySchema,
  })
  .superRefine(validateCustomRecurrence);

export type CreateRenewalItem = z.infer<typeof createRenewalItemSchema>;

// PATCH body - partial but requires at least one key
export const updateRenewalItemSchema = renewalItemBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided",
        path: [],
      });
    }
  })
  .superRefine(validateCustomRecurrence);

export type UpdateRenewalItem = z.infer<typeof updateRenewalItemSchema>;

// Query params for GET /items
export const renewalItemListQuerySchema = z.object({
  categories: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined))
    .pipe(z.array(categorySchema).optional()),
  statuses: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined))
    .pipe(z.array(statusSchema).optional()),
  search: z.string().optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => val === "true"),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  sort: z.enum(["dueDate", "name", "createdAt"]).default("dueDate"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export type RenewalItemListQuery = z.infer<typeof renewalItemListQuerySchema>;

// Body for the renew action
export const markRenewedSchema = z.object({
  renewedOn: isoDateSchema,
  costCents: costCentsSchema.optional(),
  notes: z.string().max(2000).optional(),
  nextDueDate: isoDateSchema.optional(),
});

export type MarkRenewed = z.infer<typeof markRenewedSchema>;
