import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  reminderSettingsSchema,
  updateReminderSettingsSchema,
  type ReminderSettings,
  type UpdateReminderSettings,
} from "@renewal/shared";
import { keys } from "./keys";
import { request } from "./http";

/**
 * Fetch user settings.
 */
export function useSettings() {
  return useQuery({
    queryKey: keys.settings.detail(),
    queryFn: ({ signal }) =>
      request("/api/settings", {
        schema: reminderSettingsSchema,
        signal,
      }),
  });
}

/**
 * Update user settings.
 * Uses optimistic update so the lead-time control feels instant.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateReminderSettings) =>
      request("/api/settings", {
        method: "PATCH",
        body: updateReminderSettingsSchema.parse(data),
        schema: reminderSettingsSchema,
      }),
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: keys.settings.detail() });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<ReminderSettings>(
        keys.settings.detail(),
      );

      // Optimistically update the cache
      if (previousSettings) {
        queryClient.setQueryData<ReminderSettings>(keys.settings.detail(), {
          ...previousSettings,
          ...newData,
          // Merge categoryLeadTimes if provided
          categoryLeadTimes: newData.categoryLeadTimes
            ? {
                ...previousSettings.categoryLeadTimes,
                ...newData.categoryLeadTimes,
              }
            : previousSettings.categoryLeadTimes,
        });
      }

      // Return context with the snapshot for rollback
      return { previousSettings };
    },
    onError: (error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData(
          keys.settings.detail(),
          context.previousSettings,
        );
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: keys.settings.detail() });
    },
  });
}
