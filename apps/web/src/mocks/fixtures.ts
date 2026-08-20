import {
  renewalItemSchema,
  reminderSettingsSchema,
  documentSchema,
  publicUserSchema,
  DEFAULT_REMINDER_SETTINGS,
  type RenewalItem,
  type ReminderSettings,
  type Document,
  type PublicUser,
  type IsoDate,
} from "@renewal/shared";

let itemIdCounter = 1;
let documentIdCounter = 1;
let userIdCounter = 1;

/**
 * Typed fixture builders.
 * Each returns schema-valid objects parsed through the shared schema
 * so a fixture can never drift from the contract.
 */

export function buildItem(
  overrides?: Partial<RenewalItem>,
): RenewalItem {
  const id = `item_${itemIdCounter++}`;
  const now = new Date().toISOString();

  const item = {
    id,
    name: "Test Item",
    category: "insurance" as const,
    provider: "Test Provider",
    dueDate: "2026-12-31" as IsoDate,
    costCents: 10000,
    currency: "USD",
    recurrence: "annual" as const,
    recurrenceMonths: undefined,
    leadTimeDaysOverride: undefined,
    notes: undefined,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  // Parse through schema to ensure validity
  return renewalItemSchema.parse(item);
}

export function buildSettings(
  overrides?: Partial<ReminderSettings>,
): ReminderSettings {
  const settings = {
    ...DEFAULT_REMINDER_SETTINGS,
    ...overrides,
  };

  // Parse through schema to ensure validity
  return reminderSettingsSchema.parse(settings);
}

export function buildDocument(
  overrides?: Partial<Document>,
): Document {
  const id = `doc_${documentIdCounter++}`;
  const now = new Date().toISOString();

  const document = {
    id,
    itemId: "item_1",
    originalName: "test-document.pdf",
    mimeType: "application/pdf" as const,
    sizeBytes: 1024,
    createdAt: now,
    ...overrides,
  };

  // Parse through schema to ensure validity
  return documentSchema.parse(document);
}

export function buildUser(
  overrides?: Partial<PublicUser>,
): PublicUser {
  const id = `user_${userIdCounter++}`;
  const now = new Date().toISOString();

  const user = {
    id,
    email: `test${userIdCounter}@example.com`,
    createdAt: now,
    ...overrides,
  };

  // Parse through schema to ensure validity
  return publicUserSchema.parse(user);
}

/**
 * Reset counters between tests to ensure deterministic IDs.
 */
export function resetFixtureCounters(): void {
  itemIdCounter = 1;
  documentIdCounter = 1;
  userIdCounter = 1;
}
