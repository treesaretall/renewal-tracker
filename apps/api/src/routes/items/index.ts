import { Router } from "express";
import {
  renewalItemListQuerySchema,
  renewalItemSchema,
  paginatedSchema,
  todayIso,
  resolveLeadTimeDays,
  computeStatus,
  type RenewalItem,
  type ReminderSettings,
  type Category,
  type RenewalStatus,
} from "@renewal/shared";
import { db } from "../../db.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate, type ValidatedRequest } from "../../middleware/validate.js";
import { sendParsed } from "../../lib/respond.js";
import { toRenewalItem } from "./serialize.js";
import type { Response } from "express";
import type { RenewalItemListQuery } from "@renewal/shared";

export const itemsRouter = Router();

/**
 * Load reminder settings for a user from the database.
 * Assembles the categoryLeadTimes map from separate CategoryLeadTime rows.
 */
async function loadSettings(userId: string): Promise<ReminderSettings> {
  const settings = await db.reminderSettings.findUniqueOrThrow({
    where: { userId },
  });

  const categoryLeadTimes = await db.categoryLeadTime.findMany({
    where: { userId },
  });

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
    dateFormat: settings.dateFormat as "yyyy-MM-dd" | "dd/MM/yyyy" | "MM/dd/yyyy",
    categoryLeadTimes: categoryLeadTimesMap,
  };
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
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { provider: { contains: query.search, mode: "insensitive" } } as any,
        { notes: { contains: query.search, mode: "insensitive" } } as any,
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
    const settings = await loadSettings(userId);

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
