import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Renewal dates change rarely, so refetching on every focus is noise.
      // 30 seconds means data feels fresh without constant refetches.
      staleTime: 30_000,

      // Keep unused data in cache for 5 minutes before garbage collection.
      gcTime: 5 * 60 * 1000,

      // Don't refetch when the user switches back to the tab.
      // Explicit user actions (refresh button, navigation) should trigger fetches.
      refetchOnWindowFocus: false,

      // Don't retry 4xx errors (client errors like 401, 422 are always pointless to retry).
      // Retry other failures twice (network issues, 5xx server errors).
      retry: (failureCount, error) => {
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          typeof error.status === "number"
        ) {
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
  },
});
