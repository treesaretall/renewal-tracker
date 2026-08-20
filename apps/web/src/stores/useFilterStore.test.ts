import { describe, it, expect, beforeEach } from "vitest";
import { useFilterStore } from "./useFilterStore";

describe("useFilterStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useFilterStore.getState().resetFilters();
  });

  describe("toggleCategory", () => {
    it("adds a category when not present", () => {
      const { toggleCategory, categories } = useFilterStore.getState();

      expect(categories).toEqual([]);

      toggleCategory("insurance");

      expect(useFilterStore.getState().categories).toEqual(["insurance"]);
    });

    it("removes a category when already present", () => {
      const { toggleCategory } = useFilterStore.getState();

      toggleCategory("insurance");
      expect(useFilterStore.getState().categories).toEqual(["insurance"]);

      toggleCategory("insurance");
      expect(useFilterStore.getState().categories).toEqual([]);
    });

    it("is idempotent per category", () => {
      const { toggleCategory } = useFilterStore.getState();

      toggleCategory("insurance");
      toggleCategory("license");
      toggleCategory("insurance");

      expect(useFilterStore.getState().categories).toEqual(["license"]);

      toggleCategory("insurance");
      expect(useFilterStore.getState().categories).toEqual([
        "license",
        "insurance",
      ]);
    });
  });

  describe("toggleStatus", () => {
    it("adds a status when not present", () => {
      const { toggleStatus, statuses } = useFilterStore.getState();

      expect(statuses).toEqual([]);

      toggleStatus("overdue");

      expect(useFilterStore.getState().statuses).toEqual(["overdue"]);
    });

    it("removes a status when already present", () => {
      const { toggleStatus } = useFilterStore.getState();

      toggleStatus("overdue");
      expect(useFilterStore.getState().statuses).toEqual(["overdue"]);

      toggleStatus("overdue");
      expect(useFilterStore.getState().statuses).toEqual([]);
    });

    it("is idempotent per status", () => {
      const { toggleStatus } = useFilterStore.getState();

      toggleStatus("overdue");
      toggleStatus("due-soon");
      toggleStatus("overdue");

      expect(useFilterStore.getState().statuses).toEqual(["due-soon"]);

      toggleStatus("overdue");
      expect(useFilterStore.getState().statuses).toEqual([
        "due-soon",
        "overdue",
      ]);
    });
  });

  describe("setSearch", () => {
    it("updates search text", () => {
      const { setSearch } = useFilterStore.getState();

      setSearch("test");

      expect(useFilterStore.getState().search).toBe("test");
    });
  });

  describe("setSort", () => {
    it("updates sort field", () => {
      const { setSort } = useFilterStore.getState();

      setSort("name");

      expect(useFilterStore.getState().sort).toBe("name");
    });
  });

  describe("toggleDirection", () => {
    it("toggles between asc and desc", () => {
      const { toggleDirection } = useFilterStore.getState();

      expect(useFilterStore.getState().direction).toBe("asc");

      toggleDirection();
      expect(useFilterStore.getState().direction).toBe("desc");

      toggleDirection();
      expect(useFilterStore.getState().direction).toBe("asc");
    });
  });

  describe("setIncludeArchived", () => {
    it("updates includeArchived flag", () => {
      const { setIncludeArchived } = useFilterStore.getState();

      setIncludeArchived(true);

      expect(useFilterStore.getState().includeArchived).toBe(true);
    });
  });

  describe("resetFilters", () => {
    it("restores all fields to defaults", () => {
      const { toggleCategory, toggleStatus, setSearch, setSort, toggleDirection, setIncludeArchived, resetFilters } =
        useFilterStore.getState();

      // Modify all fields
      toggleCategory("insurance");
      toggleStatus("overdue");
      setSearch("test");
      setSort("name");
      toggleDirection();
      setIncludeArchived(true);

      const modifiedState = useFilterStore.getState();
      expect(modifiedState.categories).toEqual(["insurance"]);
      expect(modifiedState.statuses).toEqual(["overdue"]);
      expect(modifiedState.search).toBe("test");
      expect(modifiedState.sort).toBe("name");
      expect(modifiedState.direction).toBe("desc");
      expect(modifiedState.includeArchived).toBe(true);

      // Reset
      resetFilters();

      const resetState = useFilterStore.getState();
      expect(resetState.categories).toEqual([]);
      expect(resetState.statuses).toEqual([]);
      expect(resetState.search).toBe("");
      expect(resetState.sort).toBe("dueDate");
      expect(resetState.direction).toBe("asc");
      expect(resetState.includeArchived).toBe(false);
    });
  });

  describe("selectItemListQuery", () => {
    it("derives query with no filters", () => {
      const { selectItemListQuery } = useFilterStore.getState();

      const query = selectItemListQuery();

      expect(query).toEqual({
        categories: undefined,
        statuses: undefined,
        search: undefined,
        includeArchived: false,
        sort: "dueDate",
        direction: "asc",
      });
    });

    it("derives query with all filters", () => {
      const { toggleCategory, toggleStatus, setSearch, setSort, toggleDirection, setIncludeArchived, selectItemListQuery } =
        useFilterStore.getState();

      toggleCategory("insurance");
      toggleCategory("license");
      toggleStatus("overdue");
      setSearch("renewal");
      setSort("name");
      toggleDirection();
      setIncludeArchived(true);

      const query = selectItemListQuery();

      expect(query).toEqual({
        categories: "insurance,license",
        statuses: "overdue",
        search: "renewal",
        includeArchived: true,
        sort: "name",
        direction: "desc",
      });
    });

    it("omits empty search string", () => {
      const { setSearch, selectItemListQuery } = useFilterStore.getState();

      setSearch("");

      const query = selectItemListQuery();

      expect(query.search).toBeUndefined();
    });
  });
});
