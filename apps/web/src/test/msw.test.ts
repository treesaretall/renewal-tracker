import { describe, it, expect } from "vitest";

describe("MSW configuration", () => {
  it("fails on unhandled requests", async () => {
    // This test verifies that unmocked requests fail loudly rather than
    // silently returning undefined. This is critical for catching bugs where
    // tests pass because they never actually call the API.

    await expect(
      fetch("/api/unmocked-endpoint"),
    ).rejects.toThrow();
  });
});
