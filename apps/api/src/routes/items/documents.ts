import { Router } from "express";
import { z } from "zod";
import { documentSchema, cuidSchema } from "@renewal/shared";
import { db } from "../../db.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { uploadSingle, deleteStoredFile } from "../../middleware/upload.js";
import { sendParsed } from "../../lib/respond.js";
import { toDocument } from "./serialize.js";
import { ApiError } from "../../errors.js";
import { access, constants } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";
import type { RenewalItem as PrismaRenewalItem } from "../../../generated/prisma/client.js";

// Use mergeParams so :itemId from parent router is visible
export const documentsRouter = Router({ mergeParams: true });

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

/**
 * Find a document by ID and verify the parent item is owned by the user.
 */
async function findOwnedDocumentOrThrow(documentId: string, userId: string) {
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { item: true },
  });

  if (!document || document.item.userId !== userId) {
    throw ApiError.notFound("Document");
  }

  return document;
}

// GET /api/items/:itemId/documents - list documents for an item
documentsRouter.get(
  "/",
  requireAuth,
  validate({ params: z.object({ itemId: cuidSchema }) }),
  async (req, res) => {
    const { itemId } = req.params as { itemId: string };
    const userId = req.user!.id;

    // Verify ownership first
    await findOwnedItemOrThrow(itemId, userId);

    // Load documents, newest first
    const documents = await db.document.findMany({
      where: { itemId },
      orderBy: { createdAt: "desc" },
    });

    const serializedDocuments = documents.map(toDocument);
    sendParsed(res, z.array(documentSchema), serializedDocuments);
  }
);

// POST /api/items/:itemId/documents - upload a document
documentsRouter.post(
  "/",
  requireAuth,
  validate({ params: z.object({ itemId: cuidSchema }) }),
  // Verify ownership BEFORE accepting the upload to avoid writing files for non-owned items
  async (req: Request, res: Response, next: NextFunction) => {
    const { itemId } = req.params as { itemId: string };
    const userId = req.user!.id;

    try {
      await findOwnedItemOrThrow(itemId, userId);
      next();
    } catch (err) {
      next(err);
    }
  },
  // Now accept the upload
  uploadSingle("file"),
  async (req, res) => {
    const { itemId } = req.params as { itemId: string };

    // Reject when no file is present
    if (!req.file) {
      throw ApiError.validationFailed("No file uploaded");
    }

    // Create the Document row
    const document = await db.document.create({
      data: {
        itemId,
        storedName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      },
    });

    sendParsed(res, documentSchema, toDocument(document), 201);
  }
);

// GET /api/items/:itemId/documents/:documentId/download - download a document
documentsRouter.get(
  "/:documentId/download",
  requireAuth,
  validate({
    params: z.object({
      itemId: cuidSchema,
      documentId: cuidSchema,
    }),
  }),
  async (req, res) => {
    const { documentId } = req.params as { documentId: string };
    const userId = req.user!.id;

    // Verify ownership
    const document = await findOwnedDocumentOrThrow(documentId, userId);

    // Check if file exists on disk
    const filePath = `apps/api/uploads/${document.storedName}`;
    try {
      await access(filePath, constants.R_OK);
    } catch {
      throw ApiError.notFound(
        "Document file is missing from disk - the database record exists but the file was not found"
      );
    }

    // Download the file with original filename and Content-Type
    res.setHeader("Content-Type", document.mimeType);
    res.download(filePath, document.originalName);
  }
);

// DELETE /api/items/:itemId/documents/:documentId - delete a document
documentsRouter.delete(
  "/:documentId",
  requireAuth,
  validate({
    params: z.object({
      itemId: cuidSchema,
      documentId: cuidSchema,
    }),
  }),
  async (req, res) => {
    const { documentId } = req.params as { documentId: string };
    const userId = req.user!.id;

    // Verify ownership
    const document = await findOwnedDocumentOrThrow(documentId, userId);

    // Delete the database row first
    await db.document.delete({
      where: { id: documentId },
    });

    // Then delete the file - swallows ENOENT if file is missing
    await deleteStoredFile(document.storedName);

    res.status(204).send();
  }
);
