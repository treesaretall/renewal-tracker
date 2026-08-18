import { describe, it, expect } from "vitest";
import express, { type Response } from "express";
import request from "supertest";
import { z } from "zod";
import { validate, type ValidatedRequest } from "./validate.js";
import { errorHandler } from "./errorHandler.js";
import { API_ERROR_CODES } from "@renewal/shared";

function createTestApp() {
  const app = express();
  app.use(express.json());

  const bodySchema = z.object({
    email: z.string().email(),
    age: z.coerce.number().min(18),
  });

  const querySchema = z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10),
  });

  const paramsSchema = z.object({
    id: z.string().uuid(),
  });

  // Handlers are typed with ValidatedRequest to get proper type inference
  // without any casts inside the handler logic. The `as any` when passing to
  // Express is unavoidable due to Express's loose typing, but handler code
  // remains honestly typed.
  const bodyHandler = (
    req: ValidatedRequest<z.infer<typeof bodySchema>>,
    res: Response
  ) => {
    res.json({
      email: req.body.email,
      age: req.body.age,
      ageType: typeof req.body.age,
    });
  };

  const queryHandler = (
    req: ValidatedRequest<unknown, z.infer<typeof querySchema>>,
    res: Response
  ) => {
    res.json({
      page: req.query.page,
      limit: req.query.limit,
      pageType: typeof req.query.page,
    });
  };

  const paramsHandler = (
    req: ValidatedRequest<unknown, unknown, z.infer<typeof paramsSchema>>,
    res: Response
  ) => {
    res.json({ id: req.params.id });
  };

  app.post("/body-validation", validate({ body: bodySchema }), bodyHandler as any);
  app.get("/query-defaults", validate({ query: querySchema }), queryHandler as any);
  app.get("/params/:id", validate({ params: paramsSchema }), paramsHandler as any);

  app.use(errorHandler);

  return app;
}

describe("validate", () => {
  it("returns 422 with details array naming the failing path on body validation failure", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/body-validation")
      .send({ email: "not-an-email", age: 15 });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);

    const emailError = response.body.details.find((d: { path: string }) => d.path === "email");
    expect(emailError).toBeDefined();
    expect(emailError.message).toContain("email");

    const ageError = response.body.details.find((d: { path: string }) => d.path === "age");
    expect(ageError).toBeDefined();
    expect(ageError.message).toContain("18");
  });

  it("applies query schema defaults to req.query", async () => {
    const app = createTestApp();

    const response = await request(app).get("/query-defaults");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      page: 1,
      limit: 10,
      pageType: "number",
    });
  });

  it("coerces query string values to correct types", async () => {
    const app = createTestApp();

    const response = await request(app).get("/query-defaults?page=3&limit=25");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      page: 3,
      limit: 25,
      pageType: "number",
    });
  });

  it("passes valid body to handler with coerced types", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/body-validation")
      .send({ email: "user@example.com", age: "25" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      email: "user@example.com",
      age: 25,
      ageType: "number",
    });
  });

  it("validates params and returns 422 on invalid UUID", async () => {
    const app = createTestApp();

    const response = await request(app).get("/params/not-a-uuid");

    expect(response.status).toBe(422);
    expect(response.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(response.body.details).toBeDefined();

    const idError = response.body.details.find((d: { path: string }) => d.path === "id");
    expect(idError).toBeDefined();
    expect(idError.message).toContain("uuid");
  });

  it("passes valid params to handler", async () => {
    const app = createTestApp();

    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const response = await request(app).get(`/params/${validUuid}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: validUuid });
  });
});
