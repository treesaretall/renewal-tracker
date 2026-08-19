import { describe, expect, it, beforeEach } from "vitest";
import { ZodError } from "zod";
import { db } from "../../db.js";
import { createTestUser, createTestItem } from "../../test/factories.js";
import { toRenewalItem, toDocument } from "./serialize.js";
import type { User, RenewalItem, Document } from "../../../generated/prisma/client.js";

describe("serialize", () => {
  let testUser: User;

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  describe("toRenewalItem", () => {
    it("round-trips a factory-created row", async () => {
      const row = await createTestItem(testUser.id, {
        name: "Netflix",
        category: "subscription",
        provider: "Netflix Inc",
        dueDate: "2026-09-15",
        costCents: 1599,
        currency: "USD",
        recurrence: "monthly",
        notes: "Premium plan",
      });

      const result = toRenewalItem(row);

      expect(result.id).toBe(row.id);
      expect(result.name).toBe("Netflix");
      expect(result.category).toBe("subscription");
      expect(result.provider).toBe("Netflix Inc");
      expect(result.dueDate).toBe("2026-09-15");
      expect(result.costCents).toBe(1599);
      expect(result.currency).toBe("USD");
      expect(result.recurrence).toBe("monthly");
      expect(result.notes).toBe("Premium plan");
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.archivedAt).toBeNull();
    });

    it("does not include userId in output", async () => {
      const row = await createTestItem(testUser.id);
      const result = toRenewalItem(row);

      expect(result).not.toHaveProperty("userId");
      expect("userId" in result).toBe(false);
    });

    it("throws ZodError for invalid dueDate", async () => {
      const row = await createTestItem(testUser.id, {
        dueDate: "2026-09-15",
      });

      // Corrupt the dueDate to simulate invalid DB state
      const corruptedRow: RenewalItem = {
        ...row,
        dueDate: "not-a-date",
      };

      expect(() => toRenewalItem(corruptedRow)).toThrow(ZodError);
    });

    it("converts archivedAt DateTime to ISO string", async () => {
      const archivedDate = new Date("2026-08-01T10:30:00.000Z");
      const row = await createTestItem(testUser.id, {
        archivedAt: archivedDate,
      });

      const result = toRenewalItem(row);

      expect(result.archivedAt).toBe("2026-08-01T10:30:00.000Z");
    });

    it("converts null values to undefined for optional fields", async () => {
      const row = await createTestItem(testUser.id, {
        provider: null,
        costCents: null,
        notes: null,
      });

      const result = toRenewalItem(row);

      expect(result.provider).toBeUndefined();
      expect(result.costCents).toBeUndefined();
      expect(result.notes).toBeUndefined();
    });
  });

  describe("toDocument", () => {
    let testItem: RenewalItem;

    beforeEach(async () => {
      testItem = await createTestItem(testUser.id);
    });

    it("round-trips a document row", async () => {
      const docRow = await db.document.create({
        data: {
          itemId: testItem.id,
          storedName: "abc123.pdf",
          originalName: "invoice.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        },
      });

      const result = toDocument(docRow);

      expect(result.id).toBe(docRow.id);
      expect(result.itemId).toBe(testItem.id);
      expect(result.originalName).toBe("invoice.pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.sizeBytes).toBe(1024);
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("does not include storedName in output", async () => {
      const docRow = await db.document.create({
        data: {
          itemId: testItem.id,
          storedName: "secret-filename.pdf",
          originalName: "invoice.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        },
      });

      const result = toDocument(docRow);

      expect(result).not.toHaveProperty("storedName");
      expect("storedName" in result).toBe(false);
    });

    it("throws ZodError for invalid MIME type", async () => {
      const docRow = await db.document.create({
        data: {
          itemId: testItem.id,
          storedName: "file.exe",
          originalName: "virus.exe",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        },
      });

      const corruptedRow: Document = {
        ...docRow,
        mimeType: "application/x-msdownload",
      };

      expect(() => toDocument(corruptedRow)).toThrow(ZodError);
    });
  });
});
