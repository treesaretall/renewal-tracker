import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  apiErrorCodeSchema,
  apiErrorSchema,
  HTTP_STATUS_BY_ERROR_CODE,
  paginatedSchema,
} from "./api.js";
import { z } from "zod";

describe("API_ERROR_CODES", () => {
  it("exports all error codes", () => {
    expect(API_ERROR_CODES.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
    expect(API_ERROR_CODES.UNAUTHENTICATED).toBe("UNAUTHENTICATED");
    expect(API_ERROR_CODES.FORBIDDEN).toBe("FORBIDDEN");
    expect(API_ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(API_ERROR_CODES.CONFLICT).toBe("CONFLICT");
    expect(API_ERROR_CODES.PAYLOAD_TOO_LARGE).toBe("PAYLOAD_TOO_LARGE");
    expect(API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE).toBe(
      "UNSUPPORTED_MEDIA_TYPE",
    );
    expect(API_ERROR_CODES.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(API_ERROR_CODES.INTERNAL).toBe("INTERNAL");
  });
});

describe("apiErrorCodeSchema", () => {
  it("accepts valid error codes", () => {
    expect(apiErrorCodeSchema.parse("VALIDATION_FAILED")).toBe(
      "VALIDATION_FAILED",
    );
    expect(apiErrorCodeSchema.parse("NOT_FOUND")).toBe("NOT_FOUND");
    expect(apiErrorCodeSchema.parse("INTERNAL")).toBe("INTERNAL");
  });

  it("rejects invalid error codes", () => {
    expect(() => apiErrorCodeSchema.parse("UNKNOWN_ERROR")).toThrow();
    expect(() => apiErrorCodeSchema.parse("")).toThrow();
  });
});

describe("apiErrorSchema", () => {
  it("accepts valid error without details", () => {
    const error = {
      code: "NOT_FOUND" as const,
      message: "Resource not found",
    };
    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it("accepts valid error with details", () => {
    const error = {
      code: "VALIDATION_FAILED" as const,
      message: "Validation failed",
      details: [
        { path: "email", message: "Invalid email format" },
        { path: "password", message: "Password too short" },
      ],
    };
    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it("accepts error with empty details array", () => {
    const error = {
      code: "INTERNAL" as const,
      message: "Internal server error",
      details: [],
    };
    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it("rejects error with invalid code", () => {
    const error = {
      code: "INVALID_CODE",
      message: "Some message",
    };
    expect(() => apiErrorSchema.parse(error)).toThrow();
  });

  it("rejects error missing message", () => {
    const error = {
      code: "NOT_FOUND",
    };
    expect(() => apiErrorSchema.parse(error)).toThrow();
  });

  it("rejects details with missing path", () => {
    const error = {
      code: "VALIDATION_FAILED" as const,
      message: "Validation failed",
      details: [{ message: "Invalid field" }],
    };
    expect(() => apiErrorSchema.parse(error)).toThrow();
  });
});

describe("HTTP_STATUS_BY_ERROR_CODE", () => {
  it("maps all error codes to HTTP status codes", () => {
    expect(HTTP_STATUS_BY_ERROR_CODE.VALIDATION_FAILED).toBe(400);
    expect(HTTP_STATUS_BY_ERROR_CODE.UNAUTHENTICATED).toBe(401);
    expect(HTTP_STATUS_BY_ERROR_CODE.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS_BY_ERROR_CODE.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS_BY_ERROR_CODE.CONFLICT).toBe(409);
    expect(HTTP_STATUS_BY_ERROR_CODE.PAYLOAD_TOO_LARGE).toBe(413);
    expect(HTTP_STATUS_BY_ERROR_CODE.UNSUPPORTED_MEDIA_TYPE).toBe(415);
    expect(HTTP_STATUS_BY_ERROR_CODE.RATE_LIMITED).toBe(429);
    expect(HTTP_STATUS_BY_ERROR_CODE.INTERNAL).toBe(500);
  });

  it("has exactly one mapping per error code", () => {
    const errorCodes = Object.keys(API_ERROR_CODES);
    const statusMappings = Object.keys(HTTP_STATUS_BY_ERROR_CODE);
    expect(statusMappings.length).toBe(errorCodes.length);
  });
});

describe("paginatedSchema", () => {
  it("creates paginated schema for string items", () => {
    const schema = paginatedSchema(z.string());
    const data = {
      data: ["item1", "item2", "item3"],
      total: 10,
    };
    expect(schema.parse(data)).toEqual(data);
  });

  it("creates paginated schema for object items", () => {
    const itemSchema = z.object({
      id: z.string(),
      name: z.string(),
    });
    const schema = paginatedSchema(itemSchema);
    const data = {
      data: [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ],
      total: 2,
    };
    expect(schema.parse(data)).toEqual(data);
  });

  it("accepts empty data array", () => {
    const schema = paginatedSchema(z.string());
    const data = {
      data: [],
      total: 0,
    };
    expect(schema.parse(data)).toEqual(data);
  });

  it("rejects negative total", () => {
    const schema = paginatedSchema(z.string());
    const data = {
      data: ["item1"],
      total: -1,
    };
    expect(() => schema.parse(data)).toThrow();
  });

  it("rejects non-integer total", () => {
    const schema = paginatedSchema(z.string());
    const data = {
      data: ["item1"],
      total: 1.5,
    };
    expect(() => schema.parse(data)).toThrow();
  });

  it("rejects missing data field", () => {
    const schema = paginatedSchema(z.string());
    const data = {
      total: 0,
    };
    expect(() => schema.parse(data)).toThrow();
  });

  it("rejects missing total field", () => {
    const schema = paginatedSchema(z.string());
    const data = {
      data: [],
    };
    expect(() => schema.parse(data)).toThrow();
  });
});
