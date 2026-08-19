import { describe, expect, it, beforeEach } from "vitest";
import { API_ERROR_CODES, todayIso, addDaysIso } from "@renewal/shared";
import { db } from "../../db.js";
import { buildTestClient } from "../../test/client.js";
import { createTestUser, createTestItem, createTestSettings } from "../../test/factories.js";
import type { User } from "../../../generated/prisma/client.js";

describe("GET /api/items", () => {
  it("returns 401 for unauthenticated request", async () => {
    const client = buildTestClient();
    const res = await client.get("/api/items");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  describe("when authenticated", () => {
    let user1: User;
    let user2: User;
    const today = todayIso(new Date());

    beforeEach(async () => {
      user1 = await createTestUser({ email: "user1@example.com" });
      user2 = await createTestUser({ email: "user2@example.com" });

      // Create settings for both users
      await createTestSettings(user1.id);
      await createTestSettings(user2.id);

      // Seed items for user1
      await createTestItem(user1.id, {
        name: "User1 Insurance",
        category: "insurance",
        dueDate: addDaysIso(today, 10),
      });

      // Seed items for user2
      await createTestItem(user2.id, {
        name: "User2 Subscription",
        category: "subscription",
        dueDate: addDaysIso(today, 5),
      });
    });

    it("returns only the requesting user's items", async () => {
      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("User1 Insurance");
      expect(res.body.total).toBe(1);

      // Verify user2's item is absent
      const user2ItemNames = res.body.data.map((item: any) => item.name);
      expect(user2ItemNames).not.toContain("User2 Subscription");
    });

    it("default sort is dueDate ascending", async () => {
      await createTestItem(user1.id, {
        name: "Item C",
        dueDate: addDaysIso(today, 30),
      });

      await createTestItem(user1.id, {
        name: "Item A",
        dueDate: addDaysIso(today, 5),
      });

      await createTestItem(user1.id, {
        name: "Item B",
        dueDate: addDaysIso(today, 15),
      });

      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4); // 3 new + 1 from beforeEach

      // First three should be in dueDate order
      const dueDates = res.body.data.map((item: any) => item.dueDate);
      const sortedDueDates = [...dueDates].sort();
      expect(dueDates).toEqual(sortedDueDates);
    });

    it("filters by categories", async () => {
      await createTestItem(user1.id, {
        name: "License Item",
        category: "license",
        dueDate: addDaysIso(today, 10),
      });

      await createTestItem(user1.id, {
        name: "Registration Item",
        category: "registration",
        dueDate: addDaysIso(today, 10),
      });

      const client = buildTestClient();
      const res = await client
        .asUser(user1)
        .get("/api/items?categories=insurance,license");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);

      const categories = res.body.data.map((item: any) => item.category);
      expect(categories).toContain("insurance");
      expect(categories).toContain("license");
      expect(categories).not.toContain("registration");
    });

    it("search matches on provider as well as name, case-insensitively", async () => {
      await createTestItem(user1.id, {
        name: "Car Insurance",
        provider: "Geico",
        category: "insurance",
        dueDate: addDaysIso(today, 10),
      });

      await createTestItem(user1.id, {
        name: "Health Plan",
        provider: "Blue Cross",
        category: "insurance",
        dueDate: addDaysIso(today, 10),
      });

      await createTestItem(user1.id, {
        name: "Netflix",
        provider: "Netflix Inc",
        category: "subscription",
        dueDate: addDaysIso(today, 10),
      });

      const client = buildTestClient();

      // Search by provider, case-insensitive
      const res1 = await client.asUser(user1).get("/api/items?search=GEICO");
      expect(res1.status).toBe(200);
      expect(res1.body.data).toHaveLength(1);
      expect(res1.body.data[0].name).toBe("Car Insurance");

      // Search by name, case-insensitive
      const res2 = await client.asUser(user1).get("/api/items?search=netflix");
      expect(res2.status).toBe(200);
      expect(res2.body.data).toHaveLength(1);
      expect(res2.body.data[0].name).toBe("Netflix");

      // Search matches multiple
      const res3 = await client.asUser(user1).get("/api/items?search=insurance");
      expect(res3.status).toBe(200);
      expect(res3.body.total).toBe(2);
    });

    it("search matches on notes", async () => {
      await createTestItem(user1.id, {
        name: "Important Renewal",
        notes: "Family plan with premium coverage",
        category: "insurance",
        dueDate: addDaysIso(today, 10),
      });

      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items?search=premium");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Important Renewal");
    });

    it("excludes archived items by default", async () => {
      await createTestItem(user1.id, {
        name: "Active Item",
        category: "subscription",
        dueDate: addDaysIso(today, 10),
        archivedAt: null,
      });

      await createTestItem(user1.id, {
        name: "Archived Item",
        category: "subscription",
        dueDate: addDaysIso(today, 10),
        archivedAt: new Date(),
      });

      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items");

      expect(res.status).toBe(200);
      const names = res.body.data.map((item: any) => item.name);
      expect(names).toContain("Active Item");
      expect(names).not.toContain("Archived Item");
    });

    it("includes archived items with includeArchived=true", async () => {
      await createTestItem(user1.id, {
        name: "Active Item",
        category: "subscription",
        dueDate: addDaysIso(today, 10),
        archivedAt: null,
      });

      await createTestItem(user1.id, {
        name: "Archived Item",
        category: "subscription",
        dueDate: addDaysIso(today, 10),
        archivedAt: new Date(),
      });

      const client = buildTestClient();
      const res = await client
        .asUser(user1)
        .get("/api/items?includeArchived=true");

      expect(res.status).toBe(200);
      const names = res.body.data.map((item: any) => item.name);
      expect(names).toContain("Active Item");
      expect(names).toContain("Archived Item");
    });

    it("from and to date bounds are inclusive at both ends", async () => {
      const jan1 = "2027-01-01";
      const jan15 = "2027-01-15";
      const jan31 = "2027-01-31";
      const feb1 = "2027-02-01";

      await createTestItem(user1.id, {
        name: "Before Range",
        category: "subscription",
        dueDate: "2026-12-31",
      });

      await createTestItem(user1.id, {
        name: "Start Boundary",
        category: "subscription",
        dueDate: jan1,
      });

      await createTestItem(user1.id, {
        name: "In Range",
        category: "subscription",
        dueDate: jan15,
      });

      await createTestItem(user1.id, {
        name: "End Boundary",
        category: "subscription",
        dueDate: jan31,
      });

      await createTestItem(user1.id, {
        name: "After Range",
        category: "subscription",
        dueDate: feb1,
      });

      const client = buildTestClient();
      const res = await client
        .asUser(user1)
        .get(`/api/items?from=${jan1}&to=${jan31}`);

      expect(res.status).toBe(200);
      const names = res.body.data.map((item: any) => item.name);

      // Both boundaries should be included
      expect(names).toContain("Start Boundary");
      expect(names).toContain("End Boundary");
      expect(names).toContain("In Range");

      // Outside boundaries should be excluded
      expect(names).not.toContain("Before Range");
      expect(names).not.toContain("After Range");
    });

    it("filters by status=overdue using computed status", async () => {
      // Create items with different statuses relative to today
      // Overdue: due date is in the past
      await createTestItem(user1.id, {
        name: "Overdue Item",
        category: "subscription",
        dueDate: addDaysIso(today, -5), // 5 days ago
      });

      // Due soon: within lead time (default 30 days)
      await createTestItem(user1.id, {
        name: "Due Soon Item",
        category: "subscription",
        dueDate: addDaysIso(today, 10), // 10 days from now
      });

      // Upcoming: beyond lead time
      await createTestItem(user1.id, {
        name: "Upcoming Item",
        category: "subscription",
        dueDate: addDaysIso(today, 60), // 60 days from now
      });

      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items?statuses=overdue");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Overdue Item");
      expect(res.body.total).toBe(4); // Total is pre-filter count (3 in test + 1 from beforeEach)
    });

    it("filters by multiple statuses", async () => {
      // Overdue
      await createTestItem(user1.id, {
        name: "Overdue Item",
        category: "subscription",
        dueDate: addDaysIso(today, -5),
      });

      // Due soon
      await createTestItem(user1.id, {
        name: "Due Soon Item",
        category: "subscription",
        dueDate: addDaysIso(today, 10),
      });

      // Upcoming
      await createTestItem(user1.id, {
        name: "Upcoming Item",
        category: "subscription",
        dueDate: addDaysIso(today, 60),
      });

      const client = buildTestClient();
      const res = await client
        .asUser(user1)
        .get("/api/items?statuses=overdue,due-soon");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3); // 1 overdue + 2 due-soon (including beforeEach item)
      const names = res.body.data.map((item: any) => item.name);
      expect(names).toContain("Overdue Item");
      expect(names).toContain("Due Soon Item");
      expect(names).toContain("User1 Insurance"); // from beforeEach
      expect(names).not.toContain("Upcoming Item");
    });

    it("total reflects the filtered count before status filter", async () => {
      // Create 5 items in insurance category
      for (let i = 0; i < 5; i++) {
        await createTestItem(user1.id, {
          name: `Insurance ${i}`,
          category: "insurance",
          dueDate: addDaysIso(today, 10 + i),
        });
      }

      // Create 3 items in subscription category
      for (let i = 0; i < 3; i++) {
        await createTestItem(user1.id, {
          name: `Subscription ${i}`,
          category: "subscription",
          dueDate: addDaysIso(today, 10 + i),
        });
      }

      const client = buildTestClient();

      // Filter by category only
      const res = await client
        .asUser(user1)
        .get("/api/items?categories=insurance");

      expect(res.status).toBe(200);
      // 5 insurance items + 1 from beforeEach = 6
      expect(res.body.total).toBe(6);
      expect(res.body.data).toHaveLength(6);
    });

    it("returns paginated schema with data and total", async () => {
      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe("number");
    });

    it("items in response do not include userId", async () => {
      const client = buildTestClient();
      const res = await client.asUser(user1).get("/api/items");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Check that no item has userId
      for (const item of res.body.data) {
        expect(item).not.toHaveProperty("userId");
      }
    });
  });
});
