import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "@node-rs/argon2";
import { todayIso, addDaysIso, addMonthsIso } from "@renewal/shared";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const db = new PrismaClient({ adapter });

const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "dev123";

async function main() {
  const today = todayIso(new Date());

  console.log("🌱 Seeding database...\n");

  // Make idempotent: delete existing dev user (cascade will handle related data)
  const existing = await db.user.findUnique({ where: { email: DEV_EMAIL } });
  if (existing) {
    console.log("   Removing existing dev user and data...");
    await db.user.delete({ where: { email: DEV_EMAIL } });
  }

  // Create dev user
  const passwordHash = await hash(DEV_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await db.user.create({
    data: {
      email: DEV_EMAIL,
      passwordHash,
    },
  });

  console.log(`✓ Created user: ${user.email}`);

  // Create settings with insurance category override
  await db.reminderSettings.create({
    data: {
      userId: user.id,
      defaultLeadTimeDays: 30,
      weekStartsOn: 0,
      dateFormat: "MM/dd/yyyy",
    },
  });

  await db.categoryLeadTime.create({
    data: {
      userId: user.id,
      category: "insurance",
      leadTimeDays: 45,
    },
  });

  console.log("✓ Created settings (insurance lead time: 45 days)");

  // Create renewal items spread across states
  const items = [
    // OVERDUE (2 items)
    {
      name: "Home Insurance Renewal",
      category: "insurance",
      provider: "SafeHome Insurance Co.",
      dueDate: addDaysIso(today, -15),
      costCents: 125000,
      currency: "USD",
      recurrence: "annual",
      notes: "Policy #HOM-2024-5678. Contact agent for renewal.",
    },
    {
      name: "Professional License",
      category: "license",
      provider: "State Licensing Board",
      dueDate: addDaysIso(today, -5),
      costCents: 25000,
      currency: "USD",
      recurrence: "annual",
      notes: "Requires continuing education certificate upload.",
    },

    // DUE SOON (3 items - within 30-day default lead time, or 45 for insurance)
    {
      name: "Car Insurance",
      category: "insurance",
      provider: "AutoSafe Insurance",
      dueDate: addDaysIso(today, 35), // 35 days out, within 45-day insurance lead time
      costCents: 89500,
      currency: "USD",
      recurrence: "semiannual",
    },
    {
      name: "Netflix Subscription",
      category: "subscription",
      dueDate: addDaysIso(today, 10),
      costCents: 1599,
      currency: "USD",
      recurrence: "monthly",
    },
    {
      name: "Vehicle Registration",
      category: "registration",
      provider: "DMV",
      dueDate: addDaysIso(today, 25),
      costCents: 15000,
      currency: "USD",
      recurrence: "annual",
      notes: "Bring smog certificate if required.",
    },

    // UPCOMING (further out)
    {
      name: "Business License",
      category: "license",
      provider: "City Hall",
      dueDate: addDaysIso(today, 60),
      costCents: 45000,
      currency: "USD",
      recurrence: "annual",
    },
    {
      name: "Laptop Warranty Extension",
      category: "warranty",
      provider: "TechCare",
      dueDate: addDaysIso(today, 90),
      costCents: 29900,
      currency: "USD",
      recurrence: "none", // Non-recurring
      notes: "Decision needed: extend for 2 more years or let expire?",
    },
    {
      name: "Domain Registration (custom.com)",
      category: "other",
      provider: "NameCheap",
      dueDate: addMonthsIso(today, 18), // Custom 18-month recurrence
      costCents: 1299,
      currency: "USD",
      recurrence: "custom",
      recurrenceMonths: 18,
    },
    {
      name: "Adobe Creative Cloud",
      category: "subscription",
      dueDate: addDaysIso(today, 120),
      costCents: 5999,
      currency: "USD",
      recurrence: "monthly",
    },
    {
      name: "Cloud Storage Pro",
      category: "subscription",
      provider: "CloudStore",
      dueDate: addDaysIso(today, 180),
      costCents: 9999,
      currency: "USD",
      recurrence: "annual",
    },

    // ARCHIVED (1 item)
    {
      name: "Old Phone Warranty",
      category: "warranty",
      provider: "PhoneShield",
      dueDate: addDaysIso(today, -90),
      costCents: 9900,
      currency: "USD",
      recurrence: "none",
      archivedAt: new Date(),
    },

    // Additional item to reach 12 total
    {
      name: "Boat Registration",
      category: "registration",
      provider: "Harbor Master",
      dueDate: addDaysIso(today, 40),
      costCents: 35000,
      currency: "USD",
      recurrence: "annual",
      notes: "Expires annually on registration date.",
    },
  ];

  const createdItems = await Promise.all(
    items.map((data) =>
      db.renewalItem.create({
        data: {
          userId: user.id,
          ...data,
        },
      })
    )
  );

  console.log(`✓ Created ${createdItems.length} renewal items`);

  // Add renewal history to the Home Insurance item (first item, which is overdue)
  const homeInsuranceItem = createdItems[0];

  await db.renewalEvent.createMany({
    data: [
      {
        itemId: homeInsuranceItem.id,
        periodDueDate: addDaysIso(today, -380), // ~13 months ago
        renewedAt: new Date(Date.now() - 380 * 24 * 60 * 60 * 1000),
        costCents: 120000,
        notes: "Renewed on time, small price increase from previous year.",
      },
      {
        itemId: homeInsuranceItem.id,
        periodDueDate: addDaysIso(today, -15), // The current overdue period
        renewedAt: new Date(Date.now() - 745 * 24 * 60 * 60 * 1000),
        costCents: 115000,
        notes: "Initial policy purchase.",
      },
    ],
  });

  console.log("✓ Added 2 renewal events to Home Insurance item");

  // Count items by state (approximate, since we'd need to compute with settings)
  const overdueCount = createdItems.filter(
    (item) =>
      !item.archivedAt && item.dueDate < today
  ).length;
  const activeCount = createdItems.filter((item) => !item.archivedAt).length;
  const archivedCount = createdItems.filter((item) => item.archivedAt).length;

  // Print summary
  console.log("\n📊 Seed Summary");
  console.log("═".repeat(60));
  console.log(`User:                ${user.email}`);
  console.log(`Password:            ${DEV_PASSWORD}`);
  console.log("─".repeat(60));
  console.log(`Total items:         ${createdItems.length}`);
  console.log(`Active items:        ${activeCount}`);
  console.log(`Archived items:      ${archivedCount}`);
  console.log(`Overdue items:       ${overdueCount}`);
  console.log(`Items with history:  1 (Home Insurance)`);
  console.log("─".repeat(60));
  console.log(`Settings:            Default (30 days) + Insurance (45 days)`);
  console.log("═".repeat(60));
  console.log("\n✅ Seed completed successfully!\n");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
