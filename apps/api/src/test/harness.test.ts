import { describe, it, expect } from "vitest";
import { buildTestClient } from "./client.js";
import { createTestUser, createTestItem, createTestSettings } from "./factories.js";
import { db } from "../db.js";

describe("Integration test harness", () => {
  it("creates test users with sensible defaults", async () => {
    const user = await createTestUser();

    expect(user.id).toBeDefined();
    expect(user.email).toMatch(/^user\d+@example\.com$/);
    expect(user.passwordHash).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("creates test users with overrides", async () => {
    const user = await createTestUser({ email: "custom@example.com" });

    expect(user.email).toBe("custom@example.com");
  });

  it("creates test items linked to a user", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, {
      name: "Netflix",
      category: "streaming",
      costCents: 1999,
    });

    expect(item.id).toBeDefined();
    expect(item.userId).toBe(user.id);
    expect(item.name).toBe("Netflix");
    expect(item.category).toBe("streaming");
    expect(item.costCents).toBe(1999);
    expect(item.dueDate).toBe("2026-12-31");
  });

  it("creates test settings linked to a user", async () => {
    const user = await createTestUser();
    const settings = await createTestSettings(user.id, {
      defaultLeadTimeDays: 14,
    });

    expect(settings.userId).toBe(user.id);
    expect(settings.defaultLeadTimeDays).toBe(14);
    expect(settings.weekStartsOn).toBe(0);
    expect(settings.dateFormat).toBe("MM/dd/yyyy");
  });

  it("truncates tables between tests", async () => {
    // This test runs after the previous ones
    const count = await db.user.count();

    // Should be 0 because beforeEach truncates
    expect(count).toBe(0);
  });

  it("buildTestClient returns a supertest client", async () => {
    const client = buildTestClient();

    const response = await client.get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("asUser helper attaches valid session to requests", async () => {
    const user = await createTestUser();
    const client = buildTestClient();

    const response = await client.asUser(user).get("/api/test/protected");

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(user.id);
  });
});
