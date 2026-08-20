import { http, HttpResponse } from "msw";
import type {
  RenewalItem,
  ReminderSettings,
  Document,
  PublicUser,
  CreateRenewalItem,
  UpdateRenewalItem,
  MarkRenewed,
  RenewalEvent,
  UpdateReminderSettings,
} from "@renewal/shared";
import { buildItem, buildSettings, buildDocument, buildUser } from "./fixtures";

/**
 * In-memory mock database.
 * POST/PATCH/DELETE actually mutate what subsequent GETs return.
 */
interface MockDb {
  user: PublicUser | null;
  items: Map<string, RenewalItem>;
  documents: Map<string, Document>;
  events: Map<string, RenewalEvent[]>; // itemId -> events
  settings: ReminderSettings;
}

const mockDb: MockDb = {
  user: null,
  items: new Map(),
  documents: new Map(),
  events: new Map(),
  settings: buildSettings(),
};

/**
 * Reset the mock database to initial state.
 * Called in test setup afterEach.
 */
export function resetMockDb(): void {
  mockDb.user = null;
  mockDb.items.clear();
  mockDb.documents.clear();
  mockDb.events.clear();
  mockDb.settings = buildSettings();
}

/**
 * MSW HTTP handlers for all API endpoints.
 */
export const handlers = [
  // Auth endpoints
  http.get("/api/auth/me", () => {
    if (!mockDb.user) {
      return HttpResponse.json(
        { code: "UNAUTHENTICATED", message: "Not authenticated" },
        { status: 401 },
      );
    }
    return HttpResponse.json(mockDb.user);
  }),

  http.post("/api/auth/signup", async ({ request }) => {
    const body = await request.json();
    const user = buildUser({ email: (body as { email: string }).email });
    mockDb.user = user;
    return HttpResponse.json(user, { status: 201 });
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const body = await request.json();
    const user = buildUser({ email: (body as { email: string }).email });
    mockDb.user = user;
    return HttpResponse.json(user);
  }),

  http.post("/api/auth/logout", () => {
    mockDb.user = null;
    return new HttpResponse(null, { status: 204 });
  }),

  // Item endpoints
  http.get("/api/items", ({ request }) => {
    const url = new URL(request.url);
    const categories = url.searchParams.get("categories");
    const statuses = url.searchParams.get("statuses");
    const search = url.searchParams.get("search");
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    let items = Array.from(mockDb.items.values());

    // Apply filters
    if (categories) {
      const categoryList = categories.split(",");
      items = items.filter((item) => categoryList.includes(item.category));
    }

    if (!includeArchived) {
      items = items.filter((item) => !item.archivedAt);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.provider?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by dueDate asc by default
    items.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    return HttpResponse.json({ data: items, total: items.length });
  }),

  http.post("/api/items", async ({ request }) => {
    const body = (await request.json()) as CreateRenewalItem;
    const item = buildItem({
      name: body.name,
      category: body.category,
      provider: body.provider,
      dueDate: body.dueDate,
      costCents: body.costCents,
      currency: body.currency,
      recurrence: body.recurrence,
      recurrenceMonths: body.recurrenceMonths,
      leadTimeDaysOverride: body.leadTimeDaysOverride,
      notes: body.notes,
    });
    mockDb.items.set(item.id, item);
    return HttpResponse.json(item, { status: 201 });
  }),

  http.get("/api/items/:id", ({ params }) => {
    const { id } = params;
    const item = mockDb.items.get(id as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    return HttpResponse.json(item);
  }),

  http.patch("/api/items/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as UpdateRenewalItem;
    const item = mockDb.items.get(id as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    const updated = {
      ...item,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    mockDb.items.set(id as string, updated);
    return HttpResponse.json(updated);
  }),

  http.delete("/api/items/:id", ({ params }) => {
    const { id } = params;
    const item = mockDb.items.get(id as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    mockDb.items.delete(id as string);
    mockDb.documents.forEach((doc, docId) => {
      if (doc.itemId === id) {
        mockDb.documents.delete(docId);
      }
    });
    mockDb.events.delete(id as string);

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/items/:id/renew", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as MarkRenewed;
    const item = mockDb.items.get(id as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    // Create renewal event
    const event: RenewalEvent = {
      id: `event_${Date.now()}`,
      itemId: id as string,
      periodDueDate: item.dueDate,
      renewedAt: new Date(body.renewedOn).toISOString(),
      costCents: body.costCents,
      notes: body.notes,
    };

    const events = mockDb.events.get(id as string) || [];
    events.push(event);
    mockDb.events.set(id as string, events);

    // Update item's due date
    const updated = {
      ...item,
      dueDate: body.nextDueDate || item.dueDate,
      updatedAt: new Date().toISOString(),
    };
    mockDb.items.set(id as string, updated);

    return HttpResponse.json({ item: updated, event });
  }),

  http.get("/api/items/:id/history", ({ params }) => {
    const { id } = params;
    const item = mockDb.items.get(id as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    const events = mockDb.events.get(id as string) || [];
    return HttpResponse.json({ data: events, total: events.length });
  }),

  // Document endpoints
  http.get("/api/items/:itemId/documents", ({ params }) => {
    const { itemId } = params;
    const item = mockDb.items.get(itemId as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    const documents = Array.from(mockDb.documents.values()).filter(
      (doc) => doc.itemId === itemId,
    );
    return HttpResponse.json({ data: documents, total: documents.length });
  }),

  http.post("/api/items/:itemId/documents", async ({ params }) => {
    const { itemId } = params;
    const item = mockDb.items.get(itemId as string);

    if (!item) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Item not found" },
        { status: 404 },
      );
    }

    const document = buildDocument({ itemId: itemId as string });
    mockDb.documents.set(document.id, document);
    return HttpResponse.json(document, { status: 201 });
  }),

  http.delete("/api/documents/:id", ({ params }) => {
    const { id } = params;
    const document = mockDb.documents.get(id as string);

    if (!document) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Document not found" },
        { status: 404 },
      );
    }

    mockDb.documents.delete(id as string);
    return new HttpResponse(null, { status: 204 });
  }),

  // Settings endpoints
  http.get("/api/settings", () => {
    return HttpResponse.json(mockDb.settings);
  }),

  http.patch("/api/settings", async ({ request }) => {
    const body = (await request.json()) as UpdateReminderSettings;
    mockDb.settings = {
      ...mockDb.settings,
      ...body,
      categoryLeadTimes: {
        ...mockDb.settings.categoryLeadTimes,
        ...body.categoryLeadTimes,
      },
    };
    return HttpResponse.json(mockDb.settings);
  }),
];

/**
 * Named error handlers for specific test scenarios.
 * Tests can pass these to server.use() to override the default handlers.
 */
export const errorHandlers = {
  unauthenticated: http.get("/api/auth/me", () => {
    return HttpResponse.json(
      { code: "UNAUTHENTICATED", message: "Not authenticated" },
      { status: 401 },
    );
  }),

  validationError: http.post("/api/items", () => {
    return HttpResponse.json(
      {
        code: "VALIDATION_FAILED",
        message: "Validation failed",
        details: [{ path: "name", message: "Name is required" }],
      },
      { status: 400 },
    );
  }),

  serverError: http.get("/api/items", () => {
    return HttpResponse.json(
      { code: "INTERNAL", message: "Internal server error" },
      { status: 500 },
    );
  }),

  notFound: http.get("/api/items/:id", () => {
    return HttpResponse.json(
      { code: "NOT_FOUND", message: "Item not found" },
      { status: 404 },
    );
  }),
};
