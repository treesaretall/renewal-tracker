import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/server";
import { resetMockDb } from "../mocks/handlers";
import { resetFixtureCounters } from "../mocks/fixtures";
import { queryClient } from "../api/queryClient";

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    // An unmocked request must fail loudly, not silently return undefined
    onUnhandledRequest: "error",
  });
});

// Reset handlers and cleanup after each test
afterEach(() => {
  // Reset MSW handlers to remove any test-specific handlers
  server.resetHandlers();

  // Reset the in-memory mock database
  resetMockDb();

  // Reset fixture ID counters for deterministic IDs
  resetFixtureCounters();

  // Cleanup React Testing Library
  cleanup();

  // Clear the TanStack Query cache
  queryClient.clear();
});

// Close MSW server after all tests
afterAll(() => {
  server.close();
});
