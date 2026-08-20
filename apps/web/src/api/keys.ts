/**
 * Query key factory for TanStack Query.
 *
 * Every query key must be built here so invalidation can never miss a cache
 * entry through a typo'd inline array. All keys are typed as readonly tuples.
 */

export const keys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  items: {
    list: (filters?: Record<string, unknown>) =>
      ["items", "list", filters] as const,
    detail: (id: string) => ["items", "detail", id] as const,
    history: (id: string) => ["items", "history", id] as const,
  },
  documents: {
    list: (itemId: string) => ["documents", "list", itemId] as const,
  },
  settings: {
    detail: () => ["settings", "detail"] as const,
  },
} as const;
