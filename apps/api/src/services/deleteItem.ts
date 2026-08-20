import { db } from "../db.js";
import { deleteStoredFile } from "../middleware/upload.js";
import { ApiError } from "../errors.js";

/**
 * Delete a renewal item and all its associated files.
 *
 * This function:
 * 1. Verifies ownership
 * 2. Loads all document storedNames before deletion
 * 3. Deletes the item (which cascades Document and RenewalEvent rows via Prisma)
 * 4. Unlinks all files from disk
 *
 * Note: Archiving an item does NOT delete files. Archived items preserve their documents
 * so you can reference them later. Only hard deletion removes files.
 */
export async function deleteItemAndFiles(
  itemId: string,
  userId: string
): Promise<void> {
  // 1. Load the item and verify ownership
  const item = await db.renewalItem.findUnique({
    where: { id: itemId },
    include: { documents: true },
  });

  if (!item || item.userId !== userId) {
    throw ApiError.notFound("Renewal item");
  }

  // 2. Extract storedNames before deletion
  const storedNames = item.documents.map((doc) => doc.storedName);

  // 3. Delete the item (cascades to documents and events via Prisma schema)
  await db.renewalItem.delete({
    where: { id: itemId },
  });

  // 4. Delete all associated files from disk
  // Use Promise.allSettled to continue even if some files are already missing
  await Promise.allSettled(storedNames.map((name) => deleteStoredFile(name)));
}
