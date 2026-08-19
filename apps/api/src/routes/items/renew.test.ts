import { describe, expect, it, beforeEach } from "vitest";
import { API_ERROR_CODES } from "@renewal/shared";
import { db } from "../../db.js";
import { buildTestClient } from "../../test/client.js";
import { createTestUser, createTestItem } from "../../test/factories.js";
import type { User } from "../../../generated/prisma/client.js";

describe("POST /api/items/:id/renew", () => {
  let user: User;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("renewing an annual item due 2026-03-01 sets dueDate to 2027-03-01 and creates one event with periodDueDate 2026-03-01", async () => {
    const item = await createTestItem(user.id, {
      name: "Annual Insurance",
      category: "insurance",
      dueDate: "2026-03-01",
      recurrence: "annual",
    });

    const client = buildTestClient();
    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-03-01",
      });

    expect(res.status).toBe(200);
    expect(res.body.item.dueDate).toBe("2027-03-01");
    expect(res.body.event.periodDueDate).toBe("2026-03-01");
    expect(res.body.event.itemId).toBe(item.id);

    // Verify in database
    const updatedItem = await db.renewalItem.findUnique({
      where: { id: item.id },
    });
    expect(updatedItem?.dueDate).toBe("2027-03-01");

    const events = await db.renewalEvent.findMany({
      where: { itemId: item.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.periodDueDate).toBe("2026-03-01");
  });

  it("renewing a monthly item due 2026-01-31 sets dueDate to 2026-02-28 (month-end clamping)", async () => {
    const item = await createTestItem(user.id, {
      name: "Monthly Subscription",
      category: "subscription",
      dueDate: "2026-01-31",
      recurrence: "monthly",
    });

    const client = buildTestClient();
    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-01-31",
      });

    expect(res.status).toBe(200);
    // Date-fns clamps Jan 31 + 1 month to Feb 28 (2026 is not a leap year)
    expect(res.body.item.dueDate).toBe("2026-02-28");
    expect(res.body.event.periodDueDate).toBe("2026-01-31");
  });

  it("explicit nextDueDate in body wins over computed one", async () => {
    const item = await createTestItem(user.id, {
      name: "Annual Item",
      category: "subscription",
      dueDate: "2026-03-01",
      recurrence: "annual",
    });

    const client = buildTestClient();
    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-03-01",
        nextDueDate: "2026-06-01", // Explicit override
      });

    expect(res.status).toBe(200);
    // Should use explicit nextDueDate, not computed 2027-03-01
    expect(res.body.item.dueDate).toBe("2026-06-01");
    expect(res.body.event.periodDueDate).toBe("2026-03-01");
  });

  it("renewing a non-recurring item archives it and does not change dueDate", async () => {
    const item = await createTestItem(user.id, {
      name: "One-off Registration",
      category: "registration",
      dueDate: "2026-04-01",
      recurrence: "none",
    });

    const client = buildTestClient();
    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-04-01",
      });

    expect(res.status).toBe(200);
    expect(res.body.item.dueDate).toBe("2026-04-01"); // Unchanged
    expect(res.body.item.archivedAt).not.toBeNull(); // Archived
    expect(res.body.event.periodDueDate).toBe("2026-04-01");

    // Verify in database
    const updatedItem = await db.renewalItem.findUnique({
      where: { id: item.id },
    });
    expect(updatedItem?.dueDate).toBe("2026-04-01");
    expect(updatedItem?.archivedAt).not.toBeNull();
  });

  it("non-recurring item with explicit nextDueDate is NOT archived and dueDate is updated", async () => {
    const item = await createTestItem(user.id, {
      name: "One-off with Override",
      category: "registration",
      dueDate: "2026-04-01",
      recurrence: "none",
    });

    const client = buildTestClient();
    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-04-01",
        nextDueDate: "2027-04-01", // Explicit override
      });

    expect(res.status).toBe(200);
    expect(res.body.item.dueDate).toBe("2027-04-01"); // Updated
    expect(res.body.item.archivedAt).toBeNull(); // NOT archived
  });

  it("costCents and notes land on the event, not on the item", async () => {
    const item = await createTestItem(user.id, {
      name: "Item with Cost",
      category: "subscription",
      dueDate: "2026-05-01",
      costCents: 10000,
      recurrence: "monthly",
      notes: "Original notes",
    });

    const client = buildTestClient();
    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-05-01",
        costCents: 12000,
        notes: "Renewal notes",
      });

    expect(res.status).toBe(200);

    // Event should have the renewal costCents and notes
    expect(res.body.event.costCents).toBe(12000);
    expect(res.body.event.notes).toBe("Renewal notes");

    // Item should retain its original values
    expect(res.body.item.costCents).toBe(10000);
    expect(res.body.item.notes).toBe("Original notes");

    // Verify in database
    const updatedItem = await db.renewalItem.findUnique({
      where: { id: item.id },
    });
    expect(updatedItem?.costCents).toBe(10000);
    expect(updatedItem?.notes).toBe("Original notes");

    const event = await db.renewalEvent.findFirst({
      where: { itemId: item.id },
    });
    expect(event?.costCents).toBe(12000);
    expect(event?.notes).toBe("Renewal notes");
  });

  it("renewing twice produces two events and two roll-forwards", async () => {
    const item = await createTestItem(user.id, {
      name: "Quarterly Item",
      category: "subscription",
      dueDate: "2026-01-01",
      recurrence: "quarterly",
    });

    const client = buildTestClient();

    // First renewal
    const res1 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-01-01",
        notes: "First renewal",
      });

    expect(res1.status).toBe(200);
    expect(res1.body.item.dueDate).toBe("2026-04-01"); // +3 months
    expect(res1.body.event.periodDueDate).toBe("2026-01-01");
    expect(res1.body.event.notes).toBe("First renewal");

    // Second renewal
    const res2 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-04-01",
        notes: "Second renewal",
      });

    expect(res2.status).toBe(200);
    expect(res2.body.item.dueDate).toBe("2026-07-01"); // +3 months from 2026-04-01
    expect(res2.body.event.periodDueDate).toBe("2026-04-01");
    expect(res2.body.event.notes).toBe("Second renewal");

    // Verify two events in database
    const events = await db.renewalEvent.findMany({
      where: { itemId: item.id },
      orderBy: { renewedAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events[0]!.periodDueDate).toBe("2026-01-01");
    expect(events[0]!.notes).toBe("First renewal");
    expect(events[1]!.periodDueDate).toBe("2026-04-01");
    expect(events[1]!.notes).toBe("Second renewal");
  });

  it("renewing another user's item returns 404 and creates no event", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });

    const item = await createTestItem(user.id, {
      name: "User1 Item",
      category: "subscription",
      dueDate: "2026-06-01",
      recurrence: "annual",
    });

    const eventsBefore = await db.renewalEvent.count();

    const client = buildTestClient();
    const res = await client
      .asUser(user2)
      .post(`/api/items/${item.id}/renew`)
      .send({
        renewedOn: "2026-06-01",
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);

    // Verify no event was created
    const eventsAfter = await db.renewalEvent.count();
    expect(eventsAfter).toBe(eventsBefore);

    // Verify item dueDate unchanged
    const unchangedItem = await db.renewalItem.findUnique({
      where: { id: item.id },
    });
    expect(unchangedItem?.dueDate).toBe("2026-06-01");
  });
});

describe("GET /api/items/:id/history", () => {
  let user: User;
  let itemId: string;

  beforeEach(async () => {
    user = await createTestUser();

    const item = await createTestItem(user.id, {
      name: "Item with History",
      category: "subscription",
      dueDate: "2026-01-01",
      recurrence: "monthly",
    });
    itemId = item.id;
  });

  it("returns events newest first", async () => {
    // Create three events with different timestamps
    await db.renewalEvent.create({
      data: {
        itemId,
        periodDueDate: "2026-01-01",
        renewedAt: new Date("2026-01-01T10:00:00Z"),
        notes: "First",
      },
    });

    await db.renewalEvent.create({
      data: {
        itemId,
        periodDueDate: "2026-02-01",
        renewedAt: new Date("2026-02-01T10:00:00Z"),
        notes: "Second",
      },
    });

    await db.renewalEvent.create({
      data: {
        itemId,
        periodDueDate: "2026-03-01",
        renewedAt: new Date("2026-03-01T10:00:00Z"),
        notes: "Third",
      },
    });

    const client = buildTestClient();
    const res = await client.asUser(user).get(`/api/items/${itemId}/history`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    // Should be newest first (Third, Second, First)
    expect(res.body[0].notes).toBe("Third");
    expect(res.body[0].periodDueDate).toBe("2026-03-01");
    expect(res.body[1].notes).toBe("Second");
    expect(res.body[1].periodDueDate).toBe("2026-02-01");
    expect(res.body[2].notes).toBe("First");
    expect(res.body[2].periodDueDate).toBe("2026-01-01");
  });

  it("returns empty array for item with no events", async () => {
    const client = buildTestClient();
    const res = await client.asUser(user).get(`/api/items/${itemId}/history`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 404 when accessing another user's item history", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });

    const client = buildTestClient();
    const res = await client.asUser(user2).get(`/api/items/${itemId}/history`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });
});
