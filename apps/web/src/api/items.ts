import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  renewalItemSchema,
  createRenewalItemSchema,
  updateRenewalItemSchema,
  markRenewedSchema,
  markRenewedResponseSchema,
  renewalEventSchema,
  paginatedSchema,
  type CreateRenewalItem,
  type UpdateRenewalItem,
  type MarkRenewed,
  type RenewalItem,
} from "@renewal/shared";
import { keys } from "./keys";
import { request, requestVoid } from "./http";

/**
 * Fetch a paginated list of renewal items with filters.
 */
export function useItems(query: ReturnType<typeof import("../stores/useFilterStore")["useFilterStore"]["getState"]["selectItemListQuery"]>) {
  return useQuery({
    queryKey: keys.items.list(query),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (query.categories) params.set("categories", query.categories);
      if (query.statuses) params.set("statuses", query.statuses);
      if (query.search) params.set("search", query.search);
      params.set("includeArchived", String(query.includeArchived));
      params.set("sort", query.sort);
      params.set("direction", query.direction);

      return request(`/api/items?${params.toString()}`, {
        schema: paginatedSchema(renewalItemSchema),
        signal,
      });
    },
  });
}

/**
 * Fetch a single renewal item by ID.
 */
export function useItem(id: string) {
  return useQuery({
    queryKey: keys.items.detail(id),
    queryFn: ({ signal }) =>
      request(`/api/items/${id}`, {
        schema: renewalItemSchema,
        signal,
      }),
    enabled: !!id,
  });
}

/**
 * Create a new renewal item.
 */
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRenewalItem) =>
      request("/api/items", {
        method: "POST",
        body: createRenewalItemSchema.parse(data),
        schema: renewalItemSchema,
      }),
    onSuccess: () => {
      // Invalidate the list to refetch with the new item
      queryClient.invalidateQueries({ queryKey: keys.items.list() });
    },
  });
}

/**
 * Update a renewal item.
 * Uses optimistic update for instant feedback, with rollback on error.
 */
export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRenewalItem) =>
      request(`/api/items/${id}`, {
        method: "PATCH",
        body: updateRenewalItemSchema.parse(data),
        schema: renewalItemSchema,
      }),
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: keys.items.detail(id) });

      // Snapshot the previous value
      const previousItem = queryClient.getQueryData<RenewalItem>(
        keys.items.detail(id),
      );

      // Optimistically update the cache
      if (previousItem) {
        queryClient.setQueryData<RenewalItem>(keys.items.detail(id), {
          ...previousItem,
          ...newData,
          updatedAt: new Date().toISOString(),
        });
      }

      // Return context with the snapshot for rollback
      return { previousItem };
    },
    onError: (error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousItem) {
        queryClient.setQueryData(keys.items.detail(id), context.previousItem);
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency, regardless of success or error
      queryClient.invalidateQueries({ queryKey: keys.items.detail(id) });
      queryClient.invalidateQueries({ queryKey: keys.items.list() });
    },
  });
}

/**
 * Delete a renewal item.
 */
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => requestVoid(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      // Remove the item from the detail cache
      queryClient.removeQueries({ queryKey: keys.items.detail(id) });
      // Invalidate the list to refetch without the deleted item
      queryClient.invalidateQueries({ queryKey: keys.items.list() });
    },
  });
}

/**
 * Archive a renewal item.
 */
export function useArchiveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/items/${id}`, {
        method: "PATCH",
        body: { archivedAt: new Date().toISOString() },
        schema: renewalItemSchema,
      }),
    onSuccess: (_, id) => {
      // Invalidate both the detail and list
      queryClient.invalidateQueries({ queryKey: keys.items.detail(id) });
      queryClient.invalidateQueries({ queryKey: keys.items.list() });
    },
  });
}

/**
 * Mark a renewal item as renewed.
 */
export function useMarkRenewed(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MarkRenewed) =>
      request(`/api/items/${id}/renew`, {
        method: "POST",
        body: markRenewedSchema.parse(data),
        schema: markRenewedResponseSchema,
      }),
    onSuccess: () => {
      // Invalidate the item detail, list, and history
      queryClient.invalidateQueries({ queryKey: keys.items.detail(id) });
      queryClient.invalidateQueries({ queryKey: keys.items.list() });
      queryClient.invalidateQueries({ queryKey: keys.items.history(id) });
    },
  });
}

/**
 * Fetch renewal history for an item.
 */
export function useItemHistory(id: string) {
  return useQuery({
    queryKey: keys.items.history(id),
    queryFn: ({ signal }) =>
      request(`/api/items/${id}/history`, {
        schema: paginatedSchema(renewalEventSchema),
        signal,
      }),
    enabled: !!id,
  });
}
