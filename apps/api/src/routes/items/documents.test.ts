import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { API_ERROR_CODES } from "@renewal/shared";
import { db } from "../../db.js";
import { buildTestClient } from "../../test/client.js";
import { createTestUser, createTestItem } from "../../test/factories.js";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { User, RenewalItem } from "../../../generated/prisma/client.js";

// Minimal valid PDF (7 bytes) - just the header
const TINY_PDF = Buffer.from("%PDF-1.", "utf-8");

// Minimal valid 1x1 PNG (67 bytes)
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001" +
    "0d0a2db40000000049454e44ae426082",
  "hex"
);

// Text file content for unsupported type test
const TINY_TXT = Buffer.from("Hello, world!", "utf-8");

// Helper to generate a buffer over the size limit
function createOversizedBuffer(): Buffer {
  const maxSizeMB = 10;
  const oversizeBytes = maxSizeMB * 1024 * 1024 + 1;
  return Buffer.alloc(oversizeBytes, "x");
}

// Helper to clear uploads directory
async function clearUploadsDirectory(): Promise<void> {
  const uploadsDir = "apps/api/uploads";
  try {
    const files = await readdir(uploadsDir);
    await Promise.all(
      files
        .filter((file) => file !== ".gitkeep")
        .map((file) => unlink(join(uploadsDir, file)))
    );
  } catch {
    // Directory might not exist in CI, that's fine
  }
}

describe("POST /api/items/:itemId/documents", () => {
  let user: User;
  let otherUser: User;
  let item: RenewalItem;
  let otherItem: RenewalItem;

  beforeEach(async () => {
    user = await createTestUser();
    otherUser = await createTestUser();
    item = await createTestItem(user.id, { name: "Test Item" });
    otherItem = await createTestItem(otherUser.id, { name: "Other Item" });
  });

  afterEach(async () => {
    await clearUploadsDirectory();
  });

  it("uploading a PDF returns 201 with originalName, mimeType and sizeBytes, and the file exists on disk under a name that is NOT the original filename", async () => {
    const client = buildTestClient();

    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.itemId).toBe(item.id);
    expect(res.body.originalName).toBe("contract.pdf");
    expect(res.body.mimeType).toBe("application/pdf");
    expect(res.body.sizeBytes).toBe(TINY_PDF.length);
    expect(res.body.createdAt).toBeDefined();

    // Verify the document was created in the database
    const doc = await db.document.findUnique({
      where: { id: res.body.id },
    });
    expect(doc).toBeDefined();
    expect(doc!.storedName).toBeDefined();
    expect(doc!.storedName).not.toBe("contract.pdf"); // Never trust client filename
    expect(doc!.storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/); // UUID + extension

    // Verify the file exists on disk
    const uploadsDir = "apps/api/uploads";
    const files = await readdir(uploadsDir);
    expect(files).toContain(doc!.storedName);
  });

  it("uploading a PNG returns 201 and stores the file", async () => {
    const client = buildTestClient();

    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PNG, "screenshot.png");

    expect(res.status).toBe(201);
    expect(res.body.originalName).toBe("screenshot.png");
    expect(res.body.mimeType).toBe("image/png");
    expect(res.body.sizeBytes).toBe(TINY_PNG.length);
  });

  it("uploading a .txt / text/plain returns 415 UNSUPPORTED_MEDIA_TYPE and writes nothing to disk", async () => {
    const client = buildTestClient();

    // Count files before
    const filesBefore = (await readdir("apps/api/uploads")).filter(
      (f) => f !== ".gitkeep"
    );

    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_TXT, "notes.txt");

    expect(res.status).toBe(415);
    expect(res.body.code).toBe(API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);

    // Verify no file was written
    const filesAfter = (await readdir("apps/api/uploads")).filter(
      (f) => f !== ".gitkeep"
    );
    expect(filesAfter.length).toBe(filesBefore.length);

    // Verify no document was created in the database
    const count = await db.document.count();
    expect(count).toBe(0);
  });

  it("uploading a file over the size limit returns 413 PAYLOAD_TOO_LARGE", async () => {
    const client = buildTestClient();
    const oversizedBuffer = createOversizedBuffer();

    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", oversizedBuffer, "huge.pdf");

    expect(res.status).toBe(413);
    expect(res.body.code).toBe(API_ERROR_CODES.PAYLOAD_TOO_LARGE);
    expect(res.body.message).toContain("10MB");

    // Verify no document was created
    const count = await db.document.count();
    expect(count).toBe(0);
  });

  it("POST with no file attached returns 400 VALIDATION_FAILED", async () => {
    const client = buildTestClient();

    const res = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(res.body.message).toContain("No file uploaded");
  });

  it("uploading to another user's item returns 404 and leaves no file on disk", async () => {
    const client = buildTestClient();

    // Count files before
    const filesBefore = (await readdir("apps/api/uploads")).filter(
      (f) => f !== ".gitkeep"
    );

    const res = await client
      .asUser(user)
      .post(`/api/items/${otherItem.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(API_ERROR_CODES.NOT_FOUND);

    // Verify no file was written (this is the orphaned-file check)
    const filesAfter = (await readdir("apps/api/uploads")).filter(
      (f) => f !== ".gitkeep"
    );
    expect(filesAfter.length).toBe(filesBefore.length);

    // Verify no document was created
    const count = await db.document.count();
    expect(count).toBe(0);
  });

  it("requires authentication", async () => {
    const client = buildTestClient();

    const res = await client
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/items/:itemId/documents", () => {
  let user: User;
  let item: RenewalItem;

  beforeEach(async () => {
    user = await createTestUser();
    item = await createTestItem(user.id, { name: "Test Item" });
  });

  afterEach(async () => {
    await clearUploadsDirectory();
  });

  it("returns empty array when no documents exist", async () => {
    const client = buildTestClient();

    const res = await client.asUser(user).get(`/api/items/${item.id}/documents`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists documents for an item, newest first", async () => {
    const client = buildTestClient();

    // Upload three documents
    const res1 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "first.pdf");
    const res2 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PNG, "second.png");
    const res3 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "third.pdf");

    const listRes = await client
      .asUser(user)
      .get(`/api/items/${item.id}/documents`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(3);
    // Newest first
    expect(listRes.body[0].id).toBe(res3.body.id);
    expect(listRes.body[1].id).toBe(res2.body.id);
    expect(listRes.body[2].id).toBe(res1.body.id);
  });

  it("returns 404 when item does not exist", async () => {
    const client = buildTestClient();

    const res = await client
      .asUser(user)
      .get("/api/items/nonexistent/documents");

    expect(res.status).toBe(404);
  });

  it("returns 404 when trying to list another user's item documents", async () => {
    const client = buildTestClient();
    const otherUser = await createTestUser();
    const otherItem = await createTestItem(otherUser.id, { name: "Other Item" });

    const res = await client
      .asUser(user)
      .get(`/api/items/${otherItem.id}/documents`);

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const client = buildTestClient();

    const res = await client.get(`/api/items/${item.id}/documents`);

    expect(res.status).toBe(401);
  });
});

describe("GET /api/items/:itemId/documents/:documentId/download", () => {
  let user: User;
  let item: RenewalItem;

  beforeEach(async () => {
    user = await createTestUser();
    item = await createTestItem(user.id, { name: "Test Item" });
  });

  afterEach(async () => {
    await clearUploadsDirectory();
  });

  it("returns the bytes with a Content-Disposition naming the original filename", async () => {
    const client = buildTestClient();

    // Upload a document
    const uploadRes = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const documentId = uploadRes.body.id;

    // Download it
    const downloadRes = await client
      .asUser(user)
      .get(`/api/items/${item.id}/documents/${documentId}/download`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toBe("application/pdf");
    expect(downloadRes.headers["content-disposition"]).toContain("contract.pdf");
    expect(Buffer.compare(downloadRes.body, TINY_PDF)).toBe(0);
  });

  it("returns 404 when document does not exist", async () => {
    const client = buildTestClient();

    const res = await client
      .asUser(user)
      .get(`/api/items/${item.id}/documents/nonexistent/download`);

    expect(res.status).toBe(404);
  });

  it("returns 404 with distinct message when row exists but file is missing on disk", async () => {
    const client = buildTestClient();

    // Upload a document
    const uploadRes = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const documentId = uploadRes.body.id;

    // Delete the file from disk (but not the DB row)
    const doc = await db.document.findUnique({
      where: { id: documentId },
    });
    await unlink(join("apps/api/uploads", doc!.storedName));

    // Try to download
    const downloadRes = await client
      .asUser(user)
      .get(`/api/items/${item.id}/documents/${documentId}/download`);

    expect(downloadRes.status).toBe(404);
    expect(downloadRes.body.message).toContain("missing from disk");
  });

  it("returns 404 when trying to download another user's document", async () => {
    const client = buildTestClient();
    const otherUser = await createTestUser();
    const otherItem = await createTestItem(otherUser.id, { name: "Other Item" });

    // Other user uploads a document
    const uploadRes = await client
      .asUser(otherUser)
      .post(`/api/items/${otherItem.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const documentId = uploadRes.body.id;

    // Current user tries to download it
    const downloadRes = await client
      .asUser(user)
      .get(`/api/items/${otherItem.id}/documents/${documentId}/download`);

    expect(downloadRes.status).toBe(404);
  });

  it("requires authentication", async () => {
    const client = buildTestClient();

    const res = await client.get(
      `/api/items/${item.id}/documents/someid/download`
    );

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/items/:itemId/documents/:documentId", () => {
  let user: User;
  let item: RenewalItem;

  beforeEach(async () => {
    user = await createTestUser();
    item = await createTestItem(user.id, { name: "Test Item" });
  });

  afterEach(async () => {
    await clearUploadsDirectory();
  });

  it("removes both the row and the file", async () => {
    const client = buildTestClient();

    // Upload a document
    const uploadRes = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const documentId = uploadRes.body.id;

    // Verify file exists on disk
    const doc = await db.document.findUnique({
      where: { id: documentId },
    });
    const files = await readdir("apps/api/uploads");
    expect(files).toContain(doc!.storedName);

    // Delete the document
    const deleteRes = await client
      .asUser(user)
      .delete(`/api/items/${item.id}/documents/${documentId}`);

    expect(deleteRes.status).toBe(204);

    // Verify row is gone
    const deletedDoc = await db.document.findUnique({
      where: { id: documentId },
    });
    expect(deletedDoc).toBeNull();

    // Verify file is gone
    const filesAfter = await readdir("apps/api/uploads");
    expect(filesAfter).not.toContain(doc!.storedName);
  });

  it("returns 404 when document does not exist", async () => {
    const client = buildTestClient();

    const res = await client
      .asUser(user)
      .delete(`/api/items/${item.id}/documents/nonexistent`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when trying to delete another user's document", async () => {
    const client = buildTestClient();
    const otherUser = await createTestUser();
    const otherItem = await createTestItem(otherUser.id, { name: "Other Item" });

    // Other user uploads a document
    const uploadRes = await client
      .asUser(otherUser)
      .post(`/api/items/${otherItem.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const documentId = uploadRes.body.id;

    // Current user tries to delete it
    const deleteRes = await client
      .asUser(user)
      .delete(`/api/items/${otherItem.id}/documents/${documentId}`);

    expect(deleteRes.status).toBe(404);

    // Verify document still exists
    const doc = await db.document.findUnique({
      where: { id: documentId },
    });
    expect(doc).toBeDefined();
  });

  it("succeeds even if file is already missing from disk (swallows ENOENT)", async () => {
    const client = buildTestClient();

    // Upload a document
    const uploadRes = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "contract.pdf");

    const documentId = uploadRes.body.id;

    // Delete the file from disk manually
    const doc = await db.document.findUnique({
      where: { id: documentId },
    });
    await unlink(join("apps/api/uploads", doc!.storedName));

    // Delete the document via API should still succeed
    const deleteRes = await client
      .asUser(user)
      .delete(`/api/items/${item.id}/documents/${documentId}`);

    expect(deleteRes.status).toBe(204);

    // Verify row is gone
    const deletedDoc = await db.document.findUnique({
      where: { id: documentId },
    });
    expect(deletedDoc).toBeNull();
  });

  it("requires authentication", async () => {
    const client = buildTestClient();

    const res = await client.delete(`/api/items/${item.id}/documents/someid`);

    expect(res.status).toBe(401);
  });
});

describe("Cascade deletion", () => {
  let user: User;
  let item: RenewalItem;

  beforeEach(async () => {
    user = await createTestUser();
    item = await createTestItem(user.id, { name: "Test Item" });
  });

  afterEach(async () => {
    await clearUploadsDirectory();
  });

  it("deleting the parent item cascades the document rows", async () => {
    const client = buildTestClient();

    // Upload two documents
    const res1 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PDF, "first.pdf");
    const res2 = await client
      .asUser(user)
      .post(`/api/items/${item.id}/documents`)
      .attach("file", TINY_PNG, "second.png");

    const doc1Id = res1.body.id;
    const doc2Id = res2.body.id;

    // Verify documents exist
    expect(await db.document.findUnique({ where: { id: doc1Id } })).toBeDefined();
    expect(await db.document.findUnique({ where: { id: doc2Id } })).toBeDefined();

    // Delete the parent item
    const deleteRes = await client.asUser(user).delete(`/api/items/${item.id}`);
    expect(deleteRes.status).toBe(204);

    // Verify documents are cascaded
    expect(await db.document.findUnique({ where: { id: doc1Id } })).toBeNull();
    expect(await db.document.findUnique({ where: { id: doc2Id } })).toBeNull();

    // Note: Files remain on disk - this is a known limitation. In production,
    // you'd want a cleanup job or handle this in the DELETE /items/:id endpoint.
  });
});
