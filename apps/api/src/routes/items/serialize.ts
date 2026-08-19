import { renewalItemSchema, documentSchema } from "@renewal/shared";
import type { RenewalItem as PrismaRenewalItem, Document as PrismaDocument, RenewalEvent as PrismaRenewalEvent } from "../../../generated/prisma/client.js";
import type { RenewalItem, Document } from "@renewal/shared";

export function toRenewalItem(row: PrismaRenewalItem): RenewalItem {
  const candidate = {
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider ?? undefined,
    dueDate: row.dueDate,
    costCents: row.costCents ?? undefined,
    currency: row.currency,
    recurrence: row.recurrence,
    recurrenceMonths: row.recurrenceMonths ?? undefined,
    leadTimeDaysOverride: row.leadTimeDaysOverride ?? undefined,
    notes: row.notes ?? undefined,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return renewalItemSchema.parse(candidate);
}

export function toRenewalEvent(_row: PrismaRenewalEvent): unknown {
  throw new Error("toRenewalEvent not yet implemented");
}

export function toDocument(row: PrismaDocument): Document {
  const candidate = {
    id: row.id,
    itemId: row.itemId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };

  return documentSchema.parse(candidate);
}
