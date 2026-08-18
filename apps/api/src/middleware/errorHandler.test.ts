import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { errorHandler } from "./errorHandler.js";
import { API_ERROR_CODES } from "@renewal/shared";

function createTestApp() {
  const app = express();

  app.get("/api-error", () => {
    throw ApiError.notFound("Renewal item");
  });

  app.get("/zod-error", () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    schema.parse({ email: "not-an-email", age: 15 });
  });

  app.get("/plain-error", () => {
    throw new Error("This is a secret internal error message");
  });

  app.use(errorHandler);

  return app;
}

describe("errorHandler", () => {
  it("handles ApiError with correct status and body shape", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api-error");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: API_ERROR_CODES.NOT_FOUND,
      message: "Renewal item not found",
    });
  });

  it("handles ZodError with 422 status and mapped details", async () => {
    const app = createTestApp();

    const response = await request(app).get("/zod-error");

    expect(response.status).toBe(422);
    expect(response.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);

    const detail = response.body.details[0];
    expect(detail).toHaveProperty("path");
    expect(detail).toHaveProperty("message");
    expect(typeof detail.path).toBe("string");
    expect(typeof detail.message).toBe("string");
  });

  it("handles plain Error with 500 status and does NOT leak original message", async () => {
    const app = createTestApp();

    const response = await request(app).get("/plain-error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: API_ERROR_CODES.INTERNAL,
      message: "Internal server error",
    });
    expect(response.body.message).not.toContain("secret");
    expect(response.body.message).not.toContain("internal error message");
  });
});
