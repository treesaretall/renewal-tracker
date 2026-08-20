import { describe, expect, it, beforeEach } from "vitest";
import {
  API_ERROR_CODES,
  DEFAULT_REMINDER_SETTINGS,
  CATEGORIES,
  todayIso,
  addDaysIso,
} from "@renewal/shared";
import { db } from "../db.js";
import { buildTestClient } from "../test/client.js";
import { createTestUser, createTestItem, createTestSettings } from "../test/factories.js";
import type { User } from "../../generated/prisma/client.js";

describe("GET /api/settings", () => {
  it("returns 401 for unauthenticated request", async () => {
    const client = buildTestClient();
    const res = await client.get("/api/settings");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  it("returns documented defaults with all six categories present and null", async () => {
    const user = await createTestUser();
    await createTestSettings(user.id);

    const client = buildTestClient();
    const res = await client.asUser(user).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      defaultLeadTimeDays: DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays,
      weekStartsOn: DEFAULT_REMINDER_SETTINGS.weekStartsOn,
      dateFormat: DEFAULT_REMINDER_SETTINGS.dateFormat,
      categoryLeadTimes: {
        insurance: null,
        registration: null,
        license: null,
        warranty: null,
        subscription: null,
        other: null,
      },
    });

    // Verify all six categories are present
    expect(Object.keys(res.body.categoryLeadTimes).sort()).toEqual(
      CATEGORIES.slice().sort()
    );
  });

  it("creates settings from defaults if missing", async () => {
    const user = await createTestUser();
    // Don't create settings - let the endpoint create them

    const client = buildTestClient();
    const res = await client.asUser(user).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body.defaultLeadTimeDays).toBe(
      DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays
    );

    // Verify settings were created in the database
    const settings = await db.reminderSettings.findUnique({
      where: { userId: user.id },
    });
    expect(settings).toBeDefined();
    expect(settings!.defaultLeadTimeDays).toBe(
      DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays
    );
  });

  it("returns category-specific lead times when set", async () => {
    const user = await createTestUser();
    await createTestSettings(user.id);

    // Create a category-specific lead time
    await db.categoryLeadTime.create({
      data: {
        userId: user.id,
        category: "insurance",
        leadTimeDays: 60,
      },
    });

    const client = buildTestClient();
    const res = await client.asUser(user).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body.categoryLeadTimes.insurance).toBe(60);
    expect(res.body.categoryLeadTimes.registration).toBeNull();
    expect(res.body.categoryLeadTimes.license).toBeNull();
  });
});

describe("PATCH /api/settings", () => {
  let user: User;

  beforeEach(async () => {
    user = await createTestUser();
    await createTestSettings(user.id);
  });

  it("returns 401 for unauthenticated request", async () => {
    const client = buildTestClient();
    const res = await client.patch("/api/settings").send({
      defaultLeadTimeDays: 45,
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  it("updates only defaultLeadTimeDays when provided", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      defaultLeadTimeDays: 45,
    });

    expect(res.status).toBe(200);
    expect(res.body.defaultLeadTimeDays).toBe(45);
    expect(res.body.weekStartsOn).toBe(
      DEFAULT_REMINDER_SETTINGS.weekStartsOn
    );
    expect(res.body.dateFormat).toBe(DEFAULT_REMINDER_SETTINGS.dateFormat);

    // Verify in database
    const settings = await db.reminderSettings.findUnique({
      where: { userId: user.id },
    });
    expect(settings!.defaultLeadTimeDays).toBe(45);
  });

  it("updates weekStartsOn", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      weekStartsOn: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.weekStartsOn).toBe(1);
    expect(res.body.defaultLeadTimeDays).toBe(
      DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays
    );
  });

  it("updates dateFormat", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      dateFormat: "yyyy-MM-dd",
    });

    expect(res.status).toBe(200);
    expect(res.body.dateFormat).toBe("yyyy-MM-dd");
  });

  it("creates category lead time row and leaves other categories null", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: { insurance: 60 },
    });

    expect(res.status).toBe(200);
    expect(res.body.categoryLeadTimes.insurance).toBe(60);
    expect(res.body.categoryLeadTimes.registration).toBeNull();
    expect(res.body.categoryLeadTimes.license).toBeNull();
    expect(res.body.categoryLeadTimes.warranty).toBeNull();
    expect(res.body.categoryLeadTimes.subscription).toBeNull();
    expect(res.body.categoryLeadTimes.other).toBeNull();

    // Verify in database
    const categoryLeadTime = await db.categoryLeadTime.findUnique({
      where: {
        userId_category: {
          userId: user.id,
          category: "insurance",
        },
      },
    });
    expect(categoryLeadTime).toBeDefined();
    expect(categoryLeadTime!.leadTimeDays).toBe(60);

    // Verify other categories don't exist
    const allCategoryLeadTimes = await db.categoryLeadTime.findMany({
      where: { userId: user.id },
    });
    expect(allCategoryLeadTimes).toHaveLength(1);
  });

  it("updates existing category lead time row", async () => {
    // Create initial lead time
    await db.categoryLeadTime.create({
      data: {
        userId: user.id,
        category: "insurance",
        leadTimeDays: 60,
      },
    });

    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: { insurance: 90 },
    });

    expect(res.status).toBe(200);
    expect(res.body.categoryLeadTimes.insurance).toBe(90);

    // Verify in database
    const categoryLeadTime = await db.categoryLeadTime.findUnique({
      where: {
        userId_category: {
          userId: user.id,
          category: "insurance",
        },
      },
    });
    expect(categoryLeadTime!.leadTimeDays).toBe(90);
  });

  it("deletes category lead time row when set to null", async () => {
    // Create initial lead time
    await db.categoryLeadTime.create({
      data: {
        userId: user.id,
        category: "insurance",
        leadTimeDays: 60,
      },
    });

    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: { insurance: null },
    });

    expect(res.status).toBe(200);
    expect(res.body.categoryLeadTimes.insurance).toBeNull();

    // Verify row was deleted from database
    const categoryLeadTime = await db.categoryLeadTime.findUnique({
      where: {
        userId_category: {
          userId: user.id,
          category: "insurance",
        },
      },
    });
    expect(categoryLeadTime).toBeNull();
  });

  it("updates multiple category lead times in one request", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: {
        insurance: 60,
        registration: 14,
        license: 21,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.categoryLeadTimes.insurance).toBe(60);
    expect(res.body.categoryLeadTimes.registration).toBe(14);
    expect(res.body.categoryLeadTimes.license).toBe(21);
    expect(res.body.categoryLeadTimes.warranty).toBeNull();

    // Verify in database
    const allCategoryLeadTimes = await db.categoryLeadTime.findMany({
      where: { userId: user.id },
    });
    expect(allCategoryLeadTimes).toHaveLength(3);
  });

  it("updates scalar field and category lead times together", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      defaultLeadTimeDays: 45,
      categoryLeadTimes: { insurance: 60 },
    });

    expect(res.status).toBe(200);
    expect(res.body.defaultLeadTimeDays).toBe(45);
    expect(res.body.categoryLeadTimes.insurance).toBe(60);
  });

  it("returns 422 for defaultLeadTimeDays > 365", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      defaultLeadTimeDays: 400,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(res.body.details).toBeDefined();
    expect(
      res.body.details.some((d: { path: string }) =>
        d.path.includes("defaultLeadTimeDays")
      )
    ).toBe(true);
  });

  it("returns 422 for defaultLeadTimeDays < 0", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      defaultLeadTimeDays: -1,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("returns 422 for empty object", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(res.body.details).toBeDefined();
    const errorMessages = res.body.details.map((d: { message: string }) => d.message);
    expect(errorMessages.some((m: string) => m.includes("At least one field must be provided"))).toBe(true);
  });

  it("returns 422 for unknown category key", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: { unknownCategory: 30 },
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("returns 422 for invalid weekStartsOn value", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      weekStartsOn: 5,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("returns 422 for invalid dateFormat value", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).patch("/api/settings").send({
      dateFormat: "invalid-format",
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("one user's settings changes do not affect another user's", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });
    await createTestSettings(user2.id);

    const client = buildTestClient();

    // Update user1's settings
    await client.asUser(user).patch("/api/settings").send({
      defaultLeadTimeDays: 45,
      categoryLeadTimes: { insurance: 60 },
    });

    // Verify user2's settings are unchanged
    const res2 = await client.asUser(user2).get("/api/settings");
    expect(res2.status).toBe(200);
    expect(res2.body.defaultLeadTimeDays).toBe(
      DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays
    );
    expect(res2.body.categoryLeadTimes.insurance).toBeNull();
  });
});

describe("Settings integration with items list", () => {
  it("after PATCH categoryLeadTimes, GET /api/items?statuses=due-soon reflects new lead time", async () => {
    const user = await createTestUser();
    await createTestSettings(user.id);

    const today = todayIso(new Date());
    const client = buildTestClient();

    // Create an insurance item 50 days out
    // With default lead time of 30 days, this is "upcoming" (not due-soon)
    // With lead time of 60 days for insurance, this becomes "due-soon"
    await createTestItem(user.id, {
      name: "Car Insurance",
      category: "insurance",
      dueDate: addDaysIso(today, 50),
    });

    // Verify with default settings, item is NOT in due-soon
    const beforeRes = await client
      .asUser(user)
      .get("/api/items?statuses=due-soon");
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.data).toHaveLength(0);

    // Update insurance category lead time to 60 days
    const patchRes = await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: { insurance: 60 },
    });
    expect(patchRes.status).toBe(200);

    // Now verify item appears in due-soon list
    const afterRes = await client
      .asUser(user)
      .get("/api/items?statuses=due-soon");
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.data).toHaveLength(1);
    expect(afterRes.body.data[0].name).toBe("Car Insurance");

    // And it should NOT appear in upcoming anymore
    const upcomingRes = await client
      .asUser(user)
      .get("/api/items?statuses=upcoming");
    expect(upcomingRes.status).toBe(200);
    expect(upcomingRes.body.data).toHaveLength(0);
  });

  it("item with leadTimeDaysOverride ignores category settings", async () => {
    const user = await createTestUser();
    await createTestSettings(user.id);

    const today = todayIso(new Date());
    const client = buildTestClient();

    // Create an insurance item 50 days out with override of 40 days
    await createTestItem(user.id, {
      name: "Car Insurance",
      category: "insurance",
      dueDate: addDaysIso(today, 50),
      leadTimeDaysOverride: 40,
    });

    // Set insurance category lead time to 60 days
    await client.asUser(user).patch("/api/settings").send({
      categoryLeadTimes: { insurance: 60 },
    });

    // With override of 40 days and item 50 days out, it's upcoming (not due-soon)
    const dueSoonRes = await client
      .asUser(user)
      .get("/api/items?statuses=due-soon");
    expect(dueSoonRes.status).toBe(200);
    expect(dueSoonRes.body.data).toHaveLength(0);

    const upcomingRes = await client
      .asUser(user)
      .get("/api/items?statuses=upcoming");
    expect(upcomingRes.status).toBe(200);
    expect(upcomingRes.body.data).toHaveLength(1);
    expect(upcomingRes.body.data[0].name).toBe("Car Insurance");
  });
});
