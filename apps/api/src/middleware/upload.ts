import multer, { type FileFilterCallback } from "multer";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { unlink } from "node:fs/promises";
import { ALLOWED_UPLOAD_MIME_TYPES } from "@renewal/shared";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import type { Request, Response, NextFunction } from "express";

const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

// Multer configuration with disk storage
const storage = multer.diskStorage({
  destination: "apps/api/uploads/",
  filename: (_req, file, cb) => {
    // Never trust the client's filename for the path - use a random UUID
    // with only the extension from the original filename
    const ext = extname(file.originalname).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype as never)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Upload middleware wrapper that translates multer errors into our ApiError format.
 * - LIMIT_FILE_SIZE -> PAYLOAD_TOO_LARGE
 * - Rejected mimetype -> UNSUPPORTED_MEDIA_TYPE
 */
export const uploadSingle = (fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const upload = multerUpload.single(fieldName);

    upload(req, res, (err: unknown) => {
      if (err) {
        // Multer error handling
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(
              ApiError.payloadTooLarge(
                `File size exceeds ${env.MAX_UPLOAD_MB}MB limit`
              )
            );
          }
          // Other multer errors (LIMIT_FILE_COUNT, LIMIT_UNEXPECTED_FILE, etc.)
          return next(
            ApiError.validationFailed(`Upload failed: ${err.message}`)
          );
        }
        // Unknown error
        return next(err);
      }

      // Check if file was rejected by fileFilter
      if (!req.file && req.body && Object.keys(req.body).length === 0) {
        // This heuristic detects when multer rejected the file silently
        // Note: this is not foolproof, but catches most cases
        return next(
          ApiError.unsupportedMediaType(
            `File type not allowed. Accepted types: ${ALLOWED_UPLOAD_MIME_TYPES.join(", ")}`
          )
        );
      }

      next();
    });
  };
};

/**
 * Delete a stored file by its filename.
 * Swallows ENOENT errors - a missing file must not block deleting the DB row.
 */
export async function deleteStoredFile(storedName: string): Promise<void> {
  try {
    await unlink(`apps/api/uploads/${storedName}`);
  } catch (err) {
    // Swallow ENOENT - file already gone is fine
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
