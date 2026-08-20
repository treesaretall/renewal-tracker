import { Router } from "express";
import { z } from "zod";
import {
  renewalItemListQuerySchema,
  renewalItemSchema,
  renewalEventSchema,
  createRenewalItemSchema,
  updateRenewalItemSchema,
  markRenewedSchema,
  markRenewedResponseSchema,
  paginatedSchema,
  cuidSchema,
  todayIso,
  resolveLeadTimeDays,
  computeStatus,
  nextDueDate,
  type RenewalItem,
  type ReminderSettings,
  type RenewalStatus,
} from "@renewal/shared";
import { db } from "../../db.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate, type ValidatedRequest } from "../../middleware/validate.js";
import { sendParsed } from "../../lib/respond.js";
import { toRenewalItem, toRenewalEvent } from "./serialize.js";
import { ApiError } from "../../errors.js";
import { documentsRouter } from "./documents.js";
import { deleteItemAndFiles } from "../../services/deleteItem.js";
import { getSettingsForUser } from "../../services/settings.js";
import type { Response } from "express";
import type { RenewalItemListQuery } from "@renewal/shared";
import type { RenewalItem as PrismaRenewalItem } from "../../../generated/prisma/client.js";

export const itemsRouter = Router();

// Mount documents router at /api/items/:itemId/documents
itemsRouter.use("/:itemId/documents", documentsRouter);

/**
 * Find an item by ID and verify ownership. Returns 404 (not 403) when the item
 * doesn't exist or belongs to another user, so the API doesn't leak the existence
 * of other people's IDs. This is the single enforcement point for ownership checks
 * across all item operations.
 */
async function findOwnedItemOrThrow(
  itemId: string,
  userId: string
): Promise<PrismaRenewalItem> {
  const item = await db.renewalItem.findUnique({
    where: { id: itemId },
  });

  if (!item || item.userId !== userId) {
    throw ApiError.notFound("Renewal item");
  }

  return item;
}

interface ItemWithStatus extends RenewalItem {
  status: RenewalStatus;
}

itemsRouter.get(
  "/",
  requireAuth,
  validate({ query: renewalItemListQuerySchema }),
  async (req, res) => {
    const query = req.query as unknown as RenewalItemListQuery;
    const userId = req.user!.id;

    // Compute today once at the top of the handler
    const today = todayIso(new Date());

    // Build where clause scoped to the user
    const where: {
      userId: string;
      category?: { in: string[] };
      archivedAt?: null;
      dueDate?: { gte?: string; lte?: string };
      OR?: Array<{ name?: { contains: string; mode: "insensitive" } }>;
    } = {
      userId,
    };

    // Category filter
    if (query.categories && query.categories.length > 0) {
      where.category = { in: query.categories };
    }

    // Archive filter
    if (!query.includeArchived) {
      where.archivedAt = null;
    }

    // Date range filter
    if (query.from || query.to) {
      where.dueDate = {};
      if (query.from) {
        where.dueDate.gte = query.from;
      }
      if (query.to) {
        where.dueDate.lte = query.to;
      }
    }

    // Case-insensitive search across name, provider, notes
    // Note: SQLite doesn't support mode: "insensitive" in Prisma, so we rely on
    // SQLite's default case-insensitive LIKE behavior for ASCII text
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { provider: { contains: query.search } } as any,
        { notes: { contains: query.search } } as any,
      ];
    }

    // Determine order by
    const orderBy: Record<string, "asc" | "desc">[] = [];
    orderBy.push({ [query.sort]: query.direction });
    // Stable secondary sort on id to prevent pagination duplicates
    orderBy.push({ id: "asc" });

    // Load items from database
    const [rows, total] = await Promise.all([
      db.renewalItem.findMany({
        where,
        orderBy,
      }),
      db.renewalItem.count({ where }),
    ]);

    // Load settings once for all items
    const settings = await getSettingsForUser(userId);

    // Map rows to API shape and compute status for each
    // STATUS FILTERING TRADE-OFF: Status is derived via computeStatus() and cannot
    // be a SQL WHERE clause. We load all matching items, compute status in memory,
    // then filter by status if requested. This keeps one canonical definition of
    // status (no stored denormalized column to drift out of sync) at the cost of
    // not pushing status filtering into SQL. This is acceptable at this scale.
    let itemsWithStatus: ItemWithStatus[] = rows.map((row) => {
      const item = toRenewalItem(row);
      const leadTimeDays = resolveLeadTimeDays({
        itemOverride: item.leadTimeDaysOverride,
        category: item.category,
        settings,
      });
      const status = computeStatus({
        dueDate: item.dueDate,
        leadTimeDays,
        today,
      });

      return { ...item, status };
    });

    // Apply status filter in memory if requested
    if (query.statuses && query.statuses.length > 0) {
      itemsWithStatus = itemsWithStatus.filter((item) =>
        query.statuses!.includes(item.status)
      );
    }

    // Strip status from response (it was only needed for filtering)
    const data = itemsWithStatus.map(({ status: _status, ...item }) => item);

    sendParsed(res, paginatedSchema(renewalItemSchema), {
      data,
      total,
    });
  }
);

itemsRouter.get(
  "/:id",
  requireAuth,
  validate({ params: z.object({ id: cuidSchema }) }),
  async (req, res) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    const row = await findOwnedItemOrThrow(id, userId);
    const item = toRenewalItem(row);

    sendParsed(res, renewalItemSchema, item);
  }
);

itemsRouter.post(
  "/",
  requireAuth,
  validate({ body: createRenewalItemSchema }),
  async (req, res) => {
    const userId = req.user!.id;
    const body = req.body as any;

    const row = await db.renewalItem.create({
      data: {
        userId,
        name: body.name,
        category: body.category,
        provider: body.provider,
        dueDate: body.dueDate,
        costCents: body.costCents,
        currency: body.currency,
        recurrence: body.recurrence,
        recurrenceMonths: body.recurrenceMonths,
        leadTimeDaysOverride: body.leadTimeDaysOverride,
        notes: body.notes,
      },
    });

    const item = toRenewalItem(row);
    sendParsed(res, renewalItemSchema, item, 201);
  }
);

itemsRouter.patch(
  "/:id",
  requireAuth,
  validate({
    params: z.object({ id: cuidSchema }),
    body: updateRenewalItemSchema,
  }),
  async (req, res) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const body = req.body as any;

    // Verify ownership first
    await findOwnedItemOrThrow(id, userId);

    // Build update data with recurrence logic:
    // When recurrence changes to "none" or a fixed interval, null out recurrenceMonths
    const data: any = { ...body };
    if (body.recurrence !== undefined && body.recurrence !== "custom") {
      data.recurrenceMonths = null;
    }

    const row = await db.renewalItem.update({
      where: { id },
      data,
    });

    const item = toRenewalItem(row);
    sendParsed(res, renewalItemSchema, item);
  }
);

itemsRouter.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  const userId = req.user!.id;

  // Hard delete - removes item, cascaded DB rows, and all associated files
  await deleteItemAndFiles(id, userId);

  res.status(204).send();
});

// Archive vs delete: Archive preserves history for items you want to reference later
// (e.g., a lapsed policy you might renew, or historical cost tracking).
// Delete is for typos, test data, or entries you never want to see again.
//
// IMPORTANT: Archiving does NOT delete document files. Archived items keep their documents
// so you can reference them later. Only hard deletion (DELETE /api/items/:id) removes files.
itemsRouter.post(
  "/:id/archive",
  requireAuth,
  validate({ params: z.object({ id: cuidSchema }) }),
  async (req, res) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    // Verify ownership first
    await findOwnedItemOrThrow(id, userId);

    const row = await db.renewalItem.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    const item = toRenewalItem(row);
    sendParsed(res, renewalItemSchema, item);
  }
);

itemsRouter.post(
  "/:id/unarchive",
  requireAuth,
  validate({ params: z.object({ id: cuidSchema }) }),
  async (req, res) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    // Verify ownership first
    await findOwnedItemOrThrow(id, userId);

    const row = await db.renewalItem.update({
      where: { id },
      data: { archivedAt: null },
    });

    const item = toRenewalItem(row);
    sendParsed(res, renewalItemSchema, item);
  }
);

itemsRouter.post(
  "/:id/renew",
  requireAuth,
  validate({
    params: z.object({ id: cuidSchema }),
    body: markRenewedSchema,
  }),
  async (req, res) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const body = req.body as any;

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // 1. Load the owned item
      const item = await tx.renewalItem.findUnique({
        where: { id },
      });

      if (!item || item.userId !== userId) {
        throw ApiError.notFound("Renewal item");
      }

      // 2. Create a RenewalEvent recording the period just completed
      const event = await tx.renewalEvent.create({
        data: {
          itemId: id,
          periodDueDate: item.dueDate,
          renewedAt: new Date(body.renewedOn),
          costCents: body.costCents,
          notes: body.notes,
        },
      });

      // 3. Compute the next due date
      let computedNextDueDate: string | null;
      if (body.nextDueDate) {
        // Use explicit nextDueDate when provided
        computedNextDueDate = body.nextDueDate;
      } else {
        // Otherwise compute from recurrence
        const computed = nextDueDate({
          dueDate: item.dueDate as any,
          recurrence: item.recurrence as any,
          recurrenceMonths: item.recurrenceMonths,
        });
        computedNextDueDate = computed;
      }

      // 4. If non-recurring and no explicit nextDueDate, archive instead of rolling forward
      // A one-off renewal that's been dealt with is done - no need to track it further.
      // This prevents "renew" from leaving non-recurring items in an active state with
      // no meaningful due date.
      let updatedItem;
      if (item.recurrence === "none" && !body.nextDueDate) {
        updatedItem = await tx.renewalItem.update({
          where: { id },
          data: { archivedAt: new Date() },
        });
      } else if (computedNextDueDate) {
        // 5. Otherwise update dueDate
        updatedItem = await tx.renewalItem.update({
          where: { id },
          data: { dueDate: computedNextDueDate },
        });
      } else {
        // No next due date computed and not archived - shouldn't happen but handle it
        updatedItem = item;
      }

      return { item: updatedItem, event };
    });

    const response = {
      item: toRenewalItem(result.item),
      event: toRenewalEvent(result.event),
    };

    sendParsed(res, markRenewedResponseSchema, response);
  }
);

itemsRouter.get(
  "/:id/history",
  requireAuth,
  validate({ params: z.object({ id: cuidSchema }) }),
  async (req, res) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    // Verify ownership first
    await findOwnedItemOrThrow(id, userId);

    // Load events, newest first
    const events = await db.renewalEvent.findMany({
      where: { itemId: id },
      orderBy: { renewedAt: "desc" },
    });

    const serializedEvents = events.map(toRenewalEvent);
    sendParsed(res, z.array(renewalEventSchema), serializedEvents);
  }
);
