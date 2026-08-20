import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category, RenewalStatus } from "@renewal/shared";

export type SortField = "dueDate" | "name" | "createdAt";
export type SortDirection = "asc" | "desc";

interface FilterState {
  categories: Category[];
  statuses: RenewalStatus[];
  search: string;
  sort: SortField;
  direction: SortDirection;
  includeArchived: boolean;
}

interface FilterActions {
  toggleCategory: (category: Category) => void;
  toggleStatus: (status: RenewalStatus) => void;
  setSearch: (search: string) => void;
  setSort: (sort: SortField) => void;
  toggleDirection: () => void;
  setIncludeArchived: (includeArchived: boolean) => void;
  resetFilters: () => void;
}

interface FilterSelectors {
  /**
   * Derives the exact query object that the API hook needs.
   * Keeping this here means the filter shape and request shape can't drift.
   */
  selectItemListQuery: () => {
    categories?: string;
    statuses?: string;
    search?: string;
    includeArchived: boolean;
    sort: SortField;
    direction: SortDirection;
  };
}

type FilterStore = FilterState & FilterActions & FilterSelectors;

const initialState: FilterState = {
  categories: [],
  statuses: [],
  search: "",
  sort: "dueDate",
  direction: "asc",
  includeArchived: false,
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      toggleCategory: (category) =>
        set((state) => {
          const exists = state.categories.includes(category);
          return {
            categories: exists
              ? state.categories.filter((c) => c !== category)
              : [...state.categories, category],
          };
        }),

      toggleStatus: (status) =>
        set((state) => {
          const exists = state.statuses.includes(status);
          return {
            statuses: exists
              ? state.statuses.filter((s) => s !== status)
              : [...state.statuses, status],
          };
        }),

      setSearch: (search) => set({ search }),

      setSort: (sort) => set({ sort }),

      toggleDirection: () =>
        set((state) => ({
          direction: state.direction === "asc" ? "desc" : "asc",
        })),

      setIncludeArchived: (includeArchived) => set({ includeArchived }),

      resetFilters: () => set(initialState),

      selectItemListQuery: () => {
        const state = get();
        return {
          categories:
            state.categories.length > 0
              ? state.categories.join(",")
              : undefined,
          statuses:
            state.statuses.length > 0 ? state.statuses.join(",") : undefined,
          search: state.search || undefined,
          includeArchived: state.includeArchived,
          sort: state.sort,
          direction: state.direction,
        };
      },
    }),
    {
      name: "renewal-tracker-filters-v1",
      version: 1,
    },
  ),
);
