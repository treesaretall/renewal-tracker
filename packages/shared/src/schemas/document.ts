import { z } from "zod";
import { cuidSchema } from "./primitives.js";

// Allowed MIME types for uploads
export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
] as const;

export const allowedMimeTypeSchema = z.enum(ALLOWED_UPLOAD_MIME_TYPES);

export type AllowedMimeType = z.infer<typeof allowedMimeTypeSchema>;

// Maximum upload size in bytes (10 MB)
// IMPORTANT: Server must enforce this same limit - keep values in sync
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Document schema
export const documentSchema = z.object({
  id: cuidSchema,
  itemId: cuidSchema,
  originalName: z.string().min(1).max(255),
  mimeType: allowedMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export type Document = z.infer<typeof documentSchema>;
