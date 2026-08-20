import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { API_ERROR_CODES, todayIso, addDaysIso } from "@renewal/shared";
import { db } from "../../db.js";
import { buildTestClient } from "../../test/client.js";
import { createTestUser, createTestSettings } from "../../test/factories.js";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { User } from "../../../generated/prisma/client.js";

// Minimal valid PDF (7 bytes) - just the header
const TINY_PDF = Buffer.from("%PDF-1.", "utf-8");

describe("POST /api/items", () => {
  let user: User;
  const today = todayIso(new Date());

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("returns 201 and follow-up GET /:id returns the same item", async () => {
    const client = buildTestClient();
    const payload = {
      name: "Car Insurance",
      category: "insurance",
      provider: "Geico",
      dueDate: addDaysIso(today, 30),
      costCents: 12599,
      currency: "USD",
      recurrence: "annual",
      leadTimeDaysOverride: 14,
      notes: "Policy #12345",
    };

    const postRes = await client.asUser(user).post("/api/items").send(payload);

    expect(postRes.status).toBe(201);
    expect(postRes.body.id).toBeDefined();
    expect(postRes.body.name).toBe("Car Insurance");
    expect(postRes.body.category).toBe("insurance");
    expect(postRes.body.provider).toBe("Geico");
    expect(postRes.body.dueDate).toBe(addDaysIso(today, 30));
    expect(postRes.body.costCents).toBe(12599);
    expect(postRes.body.currency).toBe("USD");
    expect(postRes.body.recurrence).toBe("annual");
    expect(postRes.body.recurrenceMonths).toBeUndefined();
    expect(postRes.body.leadTimeDaysOverride).toBe(14);
    expect(postRes.body.notes).toBe("Policy #12345");
    expect(postRes.body.archivedAt).toBeNull();
    expect(postRes.body.createdAt).toBeDefined();
    expect(postRes.body.updatedAt).toBeDefined();

    // Follow-up GET should return the same item
    const getRes = await client
      .asUser(user)
      .get(`/api/items/${postRes.body.id}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(postRes.body);
  });

  it("returns 422 when recurrence is custom but recurrenceMonths is missing", async () => {
    const client = buildTestClient();
    const payload = {
      name: "Quarterly Review",
      category: "other",
      dueDate: addDaysIso(today, 30),
      currency: "USD",
      recurrence: "custom",
      // recurrenceMonths is missing
    };

    const res = await client.asUser(user).post("/api/items").send(payload);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(res.body.details).toBeDefined();
    expect(
      res.body.details.some((d: any) => d.path.includes("recurrenceMonths"))
    ).toBe(true);
  });

  it("returns 422 for invalid date like 2026-02-31", async () => {
    const client = buildTestClient();
    const payload = {
      name: "Invalid Date Item",
      category: "subscription",
      dueDate: "2026-02-31", // Invalid date
      currency: "USD",
      recurrence: "none",
    };

    const res = await client.asUser(user).post("/api/items").send(payload);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("returns 422 when costCents is not an integer", async () => {
    const client = buildTestClient();
    const payload = {
      name: "Fractional Cost",
      category: "subscription",
      dueDate: addDaysIso(today, 30),
      costCents: 12.5, // Not an integer
      currency: "USD",
      recurrence: "none",
    };

    const res = await client.asUser(user).post("/api/items").send(payload);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("creates item with minimal fields", async () => {
    const client = buildTestClient();
    const payload = {
      name: "Minimal Item",
      category: "other",
      dueDate: addDaysIso(today, 30),
      currency: "USD",
      recurrence: "none",
    };

    const res = await client.asUser(user).post("/api/items").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Minimal Item");
    expect(res.body.provider).toBeUndefined();
    expect(res.body.costCents).toBeUndefined();
    expect(res.body.notes).toBeUndefined();
  });
});

describe("GET /api/items/:id", () => {
  let user1: User;
  let user2: User;

  beforeEach(async () => {
    user1 = await createTestUser({ email: "user1@example.com" });
    user2 = await createTestUser({ email: "user2@example.com" });
  });

  it("returns 404 (not 403) when trying to access another user's item", async () => {
    const client = buildTestClient();
    const today = todayIso(new Date());

    // Create item as user1
    const createRes = await client.asUser(user1).post("/api/items").send({
      name: "User1 Item",
      category: "subscription",
      dueDate: addDaysIso(today, 30),
      currency: "USD",
      recurrence: "none",
    });

    expect(createRes.status).toBe(201);
    const itemId = createRes.body.id;

    // Try to access as user2
    const getRes = await client.asUser(user2).get(`/api/items/${itemId}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
    // Should not be 403 to avoid leaking ID existence
  });

  it("returns 404 for non-existent item", async () => {
    const client = buildTestClient();
    const fakeId = "cmt00000000000000000000001";

    const res = await client.asUser(user1).get(`/api/items/${fakeId}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });
});

describe("PATCH /api/items/:id", () => {
  let user: User;
  let itemId: string;
  const today = todayIso(new Date());

  beforeEach(async () => {
    user = await createTestUser();

    const client = buildTestClient();
    const createRes = await client.asUser(user).post("/api/items").send({
      name: "Original Name",
      category: "insurance",
      provider: "Original Provider",
      dueDate: addDaysIso(today, 30),
      costCents: 10000,
      currency: "USD",
      recurrence: "custom",
      recurrenceMonths: 6,
      notes: "Original notes",
    });

    itemId = createRes.body.id;
  });

  it("changes only the provided fields and bumps updatedAt", async () => {
    const client = buildTestClient();

    // Get original item
    const originalRes = await client.asUser(user).get(`/api/items/${itemId}`);
    const originalItem = originalRes.body;

    // Wait a tiny bit to ensure updatedAt differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Patch only name and notes
    const patchRes = await client.asUser(user).patch(`/api/items/${itemId}`).send({
      name: "Updated Name",
      notes: "Updated notes",
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.name).toBe("Updated Name");
    expect(patchRes.body.notes).toBe("Updated notes");

    // Other fields should remain unchanged
    expect(patchRes.body.category).toBe(originalItem.category);
    expect(patchRes.body.provider).toBe(originalItem.provider);
    expect(patchRes.body.dueDate).toBe(originalItem.dueDate);
    expect(patchRes.body.costCents).toBe(originalItem.costCents);
    expect(patchRes.body.recurrence).toBe(originalItem.recurrence);
    expect(patchRes.body.recurrenceMonths).toBe(originalItem.recurrenceMonths);

    // updatedAt should be bumped
    expect(patchRes.body.updatedAt).not.toBe(originalItem.updatedAt);

    // createdAt should not change
    expect(patchRes.body.createdAt).toBe(originalItem.createdAt);
  });

  it("changing recurrence from custom to annual nulls recurrenceMonths", async () => {
    const client = buildTestClient();

    // Verify item has custom recurrence with recurrenceMonths
    const beforeRes = await client.asUser(user).get(`/api/items/${itemId}`);
    expect(beforeRes.body.recurrence).toBe("custom");
    expect(beforeRes.body.recurrenceMonths).toBe(6);

    // Change recurrence to annual
    const patchRes = await client
      .asUser(user)
      .patch(`/api/items/${itemId}`)
      .send({
        recurrence: "annual",
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.recurrence).toBe("annual");
    expect(patchRes.body.recurrenceMonths).toBeUndefined();

    // Verify with GET
    const afterRes = await client.asUser(user).get(`/api/items/${itemId}`);
    expect(afterRes.body.recurrence).toBe("annual");
    expect(afterRes.body.recurrenceMonths).toBeUndefined();
  });

  it("changing recurrence to none also nulls recurrenceMonths", async () => {
    const client = buildTestClient();

    const patchRes = await client
      .asUser(user)
      .patch(`/api/items/${itemId}`)
      .send({
        recurrence: "none",
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.recurrence).toBe("none");
    expect(patchRes.body.recurrenceMonths).toBeUndefined();
  });

  it("returns 422 with empty body", async () => {
    const client = buildTestClient();

    const res = await client.asUser(user).patch(`/api/items/${itemId}`).send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
  });

  it("returns 404 when patching another user's item", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });
    const client = buildTestClient();

    const res = await client.asUser(user2).patch(`/api/items/${itemId}`).send({
      name: "Hacked Name",
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });
});

describe("DELETE /api/items/:id", () => {
  let user: User;
  let itemId: string;
  const today = todayIso(new Date());

  beforeEach(async () => {
    user = await createTestUser();

    const client = buildTestClient();
    const createRes = await client.asUser(user).post("/api/items").send({
      name: "Item to Delete",
      category: "subscription",
      dueDate: addDaysIso(today, 30),
      currency: "USD",
      recurrence: "none",
    });

    itemId = createRes.body.id;
  });

  it("removes item and cascades to documents and events, second DELETE returns 404", async () => {
    // Seed one document
    await db.document.create({
      data: {
        itemId,
        storedName: "stored.pdf",
        originalName: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      },
    });

    // Seed one event
    await db.renewalEvent.create({
      data: {
        itemId,
        periodDueDate: addDaysIso(today, -30),
        costCents: 5000,
      },
    });

    // Verify they exist
    const docsBefore = await db.document.count({ where: { itemId } });
    const eventsBefore = await db.renewalEvent.count({ where: { itemId } });
    expect(docsBefore).toBe(1);
    expect(eventsBefore).toBe(1);

    const client = buildTestClient();

    // First DELETE should succeed
    const deleteRes = await client.asUser(user).delete(`/api/items/${itemId}`);
    expect(deleteRes.status).toBe(204);

    // Verify item is deleted
    const itemAfter = await db.renewalItem.findUnique({ where: { id: itemId } });
    expect(itemAfter).toBeNull();

    // Verify documents and events are cascaded
    const docsAfter = await db.document.count({ where: { itemId } });
    const eventsAfter = await db.renewalEvent.count({ where: { itemId } });
    expect(docsAfter).toBe(0);
    expect(eventsAfter).toBe(0);

    // Second DELETE should return 404
    const secondDeleteRes = await client
      .asUser(user)
      .delete(`/api/items/${itemId}`);
    expect(secondDeleteRes.status).toBe(404);
    expect(secondDeleteRes.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it("returns 404 when deleting another user's item", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });
    const client = buildTestClient();

    const res = await client.asUser(user2).delete(`/api/items/${itemId}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it("removes associated files from disk when item is deleted", async () => {
    const client = buildTestClient();

    // Upload two documents
    const doc1Res = await client
      .asUser(user)
      .post(`/api/items/${itemId}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const doc2Res = await client
      .asUser(user)
      .post(`/api/items/${itemId}/documents`)
      .attach("file", TINY_PDF, "invoice.pdf");

    expect(doc1Res.status).toBe(201);
    expect(doc2Res.status).toBe(201);

    // Get the stored filenames
    const doc1 = await db.document.findUnique({
      where: { id: doc1Res.body.id },
    });
    const doc2 = await db.document.findUnique({
      where: { id: doc2Res.body.id },
    });

    const storedName1 = doc1!.storedName;
    const storedName2 = doc2!.storedName;

    // Verify files exist on disk
    const filesBefore = await readdir("apps/api/uploads");
    expect(filesBefore).toContain(storedName1);
    expect(filesBefore).toContain(storedName2);

    // Delete the item
    const deleteRes = await client.asUser(user).delete(`/api/items/${itemId}`);
    expect(deleteRes.status).toBe(204);

    // Verify files are removed from disk
    const filesAfter = await readdir("apps/api/uploads");
    expect(filesAfter).not.toContain(storedName1);
    expect(filesAfter).not.toContain(storedName2);
  });
});

describe("POST /api/items/:id/archive and /api/items/:id/unarchive", () => {
  let user: User;
  let itemId: string;
  const today = todayIso(new Date());

  beforeEach(async () => {
    user = await createTestUser();
    await createTestSettings(user.id);

    const client = buildTestClient();
    const createRes = await client.asUser(user).post("/api/items").send({
      name: "Item to Archive",
      category: "subscription",
      dueDate: addDaysIso(today, 30),
      currency: "USD",
      recurrence: "none",
    });

    itemId = createRes.body.id;
  });

  afterEach(async () => {
    // Clean up uploads directory after each test
    const uploadsDir = "apps/api/uploads";
    try {
      const files = await readdir(uploadsDir);
      await Promise.all(
        files
          .filter((file) => file !== ".gitkeep")
          .map((file) =>
            import("node:fs/promises").then((fs) =>
              fs.unlink(join(uploadsDir, file)).catch(() => {})
            )
          )
      );
    } catch {
      // Directory might not exist, that's fine
    }
  });

  it("archive sets archivedAt and item drops out of default list, unarchive restores it", async () => {
    const client = buildTestClient();

    // Verify item is in default list
    const listBefore = await client.asUser(user).get("/api/items");
    expect(listBefore.status).toBe(200);
    const itemsBefore = listBefore.body.data.filter(
      (item: any) => item.id === itemId
    );
    expect(itemsBefore).toHaveLength(1);
    expect(itemsBefore[0].archivedAt).toBeNull();

    // Archive the item
    const archiveRes = await client
      .asUser(user)
      .post(`/api/items/${itemId}/archive`)
      .send({});

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.archivedAt).toBeDefined();
    expect(archiveRes.body.archivedAt).not.toBeNull();

    // Verify item is not in default list
    const listAfterArchive = await client.asUser(user).get("/api/items");
    expect(listAfterArchive.status).toBe(200);
    const itemsAfterArchive = listAfterArchive.body.data.filter(
      (item: any) => item.id === itemId
    );
    expect(itemsAfterArchive).toHaveLength(0);

    // Verify item appears with includeArchived=true
    const listWithArchived = await client
      .asUser(user)
      .get("/api/items?includeArchived=true");
    expect(listWithArchived.status).toBe(200);
    const archivedItems = listWithArchived.body.data.filter(
      (item: any) => item.id === itemId
    );
    expect(archivedItems).toHaveLength(1);
    expect(archivedItems[0].archivedAt).not.toBeNull();

    // Unarchive the item
    const unarchiveRes = await client
      .asUser(user)
      .post(`/api/items/${itemId}/unarchive`)
      .send({});

    expect(unarchiveRes.status).toBe(200);
    expect(unarchiveRes.body.archivedAt).toBeNull();

    // Verify item is back in default list
    const listAfterUnarchive = await client.asUser(user).get("/api/items");
    expect(listAfterUnarchive.status).toBe(200);
    const itemsAfterUnarchive = listAfterUnarchive.body.data.filter(
      (item: any) => item.id === itemId
    );
    expect(itemsAfterUnarchive).toHaveLength(1);
    expect(itemsAfterUnarchive[0].archivedAt).toBeNull();
  });

  it("returns 404 when archiving another user's item", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });
    const client = buildTestClient();

    const res = await client
      .asUser(user2)
      .post(`/api/items/${itemId}/archive`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it("returns 404 when unarchiving another user's item", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });
    const client = buildTestClient();

    const res = await client
      .asUser(user2)
      .post(`/api/items/${itemId}/unarchive`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it("keeps associated files on disk when item is archived (not deleted)", async () => {
    const client = buildTestClient();

    // Upload a document
    const docRes = await client
      .asUser(user)
      .post(`/api/items/${itemId}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    expect(docRes.status).toBe(201);

    // Get the stored filename
    const doc = await db.document.findUnique({
      where: { id: docRes.body.id },
    });

    const storedName = doc!.storedName;

    // Verify file exists on disk
    const filesBefore = await readdir("apps/api/uploads");
    expect(filesBefore).toContain(storedName);

    // Archive the item
    const archiveRes = await client
      .asUser(user)
      .post(`/api/items/${itemId}/archive`)
      .send({});

    expect(archiveRes.status).toBe(200);

    // Verify file still exists on disk (archiving does NOT delete files)
    const filesAfter = await readdir("apps/api/uploads");
    expect(filesAfter).toContain(storedName);

    // Verify document row still exists
    const docAfter = await db.document.findUnique({
      where: { id: docRes.body.id },
    });
    expect(docAfter).toBeDefined();
  });
});
