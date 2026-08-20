import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentSchema, paginatedSchema } from "@renewal/shared";
import { keys } from "./keys";
import { request, requestFormData, requestVoid } from "./http";

/**
 * Fetch all documents for a renewal item.
 */
export function useDocuments(itemId: string) {
  return useQuery({
    queryKey: keys.documents.list(itemId),
    queryFn: ({ signal }) =>
      request(`/api/items/${itemId}/documents`, {
        schema: paginatedSchema(documentSchema),
        signal,
      }),
    enabled: !!itemId,
  });
}

/**
 * Upload a document for a renewal item.
 * Note: Upload progress is not exposed as TanStack Query mutations don't
 * provide a straightforward progress API. Use mutation.isPending to show
 * a loading state. For granular progress, a custom XHR/fetch wrapper would
 * be needed.
 */
export function useUploadDocument(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      requestFormData(`/api/items/${itemId}/documents`, {
        method: "POST",
        body: formData,
        schema: documentSchema,
      }),
    onSuccess: () => {
      // Invalidate the documents list to refetch with the new document
      queryClient.invalidateQueries({ queryKey: keys.documents.list(itemId) });
    },
  });
}

/**
 * Delete a document.
 */
export function useDeleteDocument(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      requestVoid(`/api/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => {
      // Invalidate the documents list to refetch without the deleted document
      queryClient.invalidateQueries({ queryKey: keys.documents.list(itemId) });
    },
  });
}
