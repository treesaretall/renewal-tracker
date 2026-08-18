import { beforeAll, beforeEach, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { db } from "../db.js";

beforeAll(() => {
  // Run migrations against test database
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
});

beforeEach(async () => {
  // Truncate all tables in FK-safe order (children first, then parents)
  await db.$executeRawUnsafe("DELETE FROM RenewalEvent");
  await db.$executeRawUnsafe("DELETE FROM Document");
  await db.$executeRawUnsafe("DELETE FROM RenewalItem");
  await db.$executeRawUnsafe("DELETE FROM CategoryLeadTime");
  await db.$executeRawUnsafe("DELETE FROM ReminderSettings");
  await db.$executeRawUnsafe("DELETE FROM Session");
  await db.$executeRawUnsafe("DELETE FROM User");
});

afterAll(async () => {
  await db.$disconnect();
});
