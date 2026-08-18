import { db } from "../db.js";
import type { User, RenewalItem, ReminderSettings } from "../../generated/prisma/client.js";

let userCounter = 0;
let itemCounter = 0;

export async function createTestUser(
  overrides?: Partial<Omit<User, "id" | "createdAt">>
): Promise<User> {
  userCounter++;
  return db.user.create({
    data: {
      email: overrides?.email ?? `user${userCounter}@example.com`,
      passwordHash: overrides?.passwordHash ?? "$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash",
    },
  });
}

export async function createTestItem(
  userId: string,
  overrides?: Partial<Omit<RenewalItem, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<RenewalItem> {
  itemCounter++;

  const data: {
    userId: string;
    name: string;
    category: string;
    dueDate: string;
    currency: string;
    recurrence: string;
    provider?: string | null;
    costCents?: number | null;
    recurrenceMonths?: number | null;
    leadTimeDaysOverride?: number | null;
    notes?: string | null;
    archivedAt?: Date | null;
  } = {
    userId,
    name: overrides?.name ?? `Test Item ${itemCounter}`,
    category: overrides?.category ?? "subscription",
    dueDate: overrides?.dueDate ?? "2026-12-31",
    currency: overrides?.currency ?? "USD",
    recurrence: overrides?.recurrence ?? "none",
  };

  if (overrides?.provider !== undefined) data.provider = overrides.provider;
  if (overrides?.costCents !== undefined) data.costCents = overrides.costCents;
  if (overrides?.recurrenceMonths !== undefined) data.recurrenceMonths = overrides.recurrenceMonths;
  if (overrides?.leadTimeDaysOverride !== undefined) data.leadTimeDaysOverride = overrides.leadTimeDaysOverride;
  if (overrides?.notes !== undefined) data.notes = overrides.notes;
  if (overrides?.archivedAt !== undefined) data.archivedAt = overrides.archivedAt;

  return db.renewalItem.create({ data });
}

export async function createTestSettings(
  userId: string,
  overrides?: Partial<Omit<ReminderSettings, "userId">>
): Promise<ReminderSettings> {
  return db.reminderSettings.create({
    data: {
      userId,
      defaultLeadTimeDays: overrides?.defaultLeadTimeDays ?? 30,
      weekStartsOn: overrides?.weekStartsOn ?? 0,
      dateFormat: overrides?.dateFormat ?? "MM/dd/yyyy",
    },
  });
}
