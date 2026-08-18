import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  allowedMimeTypeSchema,
  documentSchema,
  MAX_UPLOAD_BYTES,
} from "./document.js";

describe("ALLOWED_UPLOAD_MIME_TYPES", () => {
  it("exports readonly tuple of allowed MIME types", () => {
    expect(ALLOWED_UPLOAD_MIME_TYPES).toEqual([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
    ]);
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  it("equals 10 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("allowedMimeTypeSchema", () => {
  it("accepts allowed MIME types", () => {
    expect(allowedMimeTypeSchema.parse("application/pdf")).toBe(
      "application/pdf",
    );
    expect(allowedMimeTypeSchema.parse("image/png")).toBe("image/png");
    expect(allowedMimeTypeSchema.parse("image/jpeg")).toBe("image/jpeg");
    expect(allowedMimeTypeSchema.parse("image/webp")).toBe("image/webp");
    expect(allowedMimeTypeSchema.parse("image/heic")).toBe("image/heic");
  });

  it("rejects disallowed MIME types", () => {
    expect(() => allowedMimeTypeSchema.parse("image/gif")).toThrow();
    expect(() => allowedMimeTypeSchema.parse("image/svg+xml")).toThrow();
    expect(() => allowedMimeTypeSchema.parse("text/plain")).toThrow();
  });
});

describe("documentSchema", () => {
  const validDocument = {
    id: "clh123456",
    itemId: "clh654321",
    originalName: "invoice.pdf",
    mimeType: "application/pdf" as const,
    sizeBytes: 1024000,
    createdAt: "2026-08-18T10:00:00.000Z",
  };

  it("accepts valid document", () => {
    expect(documentSchema.parse(validDocument)).toEqual(validDocument);
  });

  it("rejects originalName that is too long", () => {
    const doc = {
      ...validDocument,
      originalName: "a".repeat(256),
    };
    expect(() => documentSchema.parse(doc)).toThrow();
  });

  it("rejects empty originalName", () => {
    const doc = {
      ...validDocument,
      originalName: "",
    };
    expect(() => documentSchema.parse(doc)).toThrow();
  });

  it("rejects invalid MIME type", () => {
    const doc = {
      ...validDocument,
      mimeType: "text/plain",
    };
    expect(() => documentSchema.parse(doc)).toThrow();
  });

  it("rejects negative sizeBytes", () => {
    const doc = {
      ...validDocument,
      sizeBytes: -1,
    };
    expect(() => documentSchema.parse(doc)).toThrow();
  });

  it("rejects zero sizeBytes", () => {
    const doc = {
      ...validDocument,
      sizeBytes: 0,
    };
    expect(() => documentSchema.parse(doc)).toThrow();
  });

  it("rejects non-integer sizeBytes", () => {
    const doc = {
      ...validDocument,
      sizeBytes: 1024.5,
    };
    expect(() => documentSchema.parse(doc)).toThrow();
  });
});
