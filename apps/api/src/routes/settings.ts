import { Router } from "express";
import {
  reminderSettingsSchema,
  updateReminderSettingsSchema,
  type Category,
} from "@renewal/shared";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { sendParsed } from "../lib/respond.js";
import { getSettingsForUser } from "../services/settings.js";

export const settingsRouter = Router();

/**
 * GET /api/settings
 *
 * Load the user's ReminderSettings plus their CategoryLeadTime rows and assemble
 * into a complete reminderSettingsSchema-shaped object, with categoryLeadTimes as
 * a complete Record<Category, number | null> (every category present, null where
 * unset). Returning a complete record rather than a sparse one keeps the client's
 * form logic trivial.
 *
 * If the settings row is somehow missing, creates it from DEFAULT_REMINDER_SETTINGS
 * rather than 404ing.
 */
settingsRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const settings = await getSettingsForUser(userId);
  sendParsed(res, reminderSettingsSchema, settings);
});

/**
 * PATCH /api/settings
 *
 * Update the user's reminder settings. In a transaction: update the scalar fields
 * that were provided, and for each key present in categoryLeadTimes either upsert
 * the CategoryLeadTime row (when non-null) or delete it (when null).
 *
 * Responds with the full assembled settings object, same shape as GET.
 */
settingsRouter.patch(
  "/",
  requireAuth,
  validate({ body: updateReminderSettingsSchema }),
  async (req, res) => {
    const userId = req.user!.id;
    const body = req.body as any;

    await db.$transaction(async (tx) => {
      // Update scalar fields if provided
      const scalarUpdates: {
        defaultLeadTimeDays?: number;
        weekStartsOn?: number;
        dateFormat?: string;
      } = {};

      if (body.defaultLeadTimeDays !== undefined) {
        scalarUpdates.defaultLeadTimeDays = body.defaultLeadTimeDays;
      }
      if (body.weekStartsOn !== undefined) {
        scalarUpdates.weekStartsOn = body.weekStartsOn;
      }
      if (body.dateFormat !== undefined) {
        scalarUpdates.dateFormat = body.dateFormat;
      }

      if (Object.keys(scalarUpdates).length > 0) {
        await tx.reminderSettings.upsert({
          where: { userId },
          update: scalarUpdates,
          create: {
            userId,
            ...scalarUpdates,
          },
        });
      }

      // Handle category lead time updates
      if (body.categoryLeadTimes !== undefined) {
        const updates = Object.entries(body.categoryLeadTimes);

        for (const [category, leadTimeDays] of updates) {
          if (leadTimeDays === null) {
            // Delete the row when set to null (revert to default)
            await tx.categoryLeadTime.deleteMany({
              where: {
                userId,
                category: category as Category,
              },
            });
          } else {
            // Upsert when set to a value
            await tx.categoryLeadTime.upsert({
              where: {
                userId_category: {
                  userId,
                  category: category as Category,
                },
              },
              update: {
                leadTimeDays: leadTimeDays as number,
              },
              create: {
                userId,
                category: category as Category,
                leadTimeDays: leadTimeDays as number,
              },
            });
          }
        }
      }
    });

    // Reload and return the full settings object
    const settings = await getSettingsForUser(userId);
    sendParsed(res, reminderSettingsSchema, settings);
  }
);
