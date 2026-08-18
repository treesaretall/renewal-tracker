import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../errors.js";
import { API_ERROR_CODES, type ApiErrorDetail } from "@renewal/shared";

function isPrismaError(error: unknown): error is { code: string; meta?: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the full error server-side
  console.error("Error caught by error handler:", error);

  // ApiError - use its code and status
  if (error instanceof ApiError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  // ZodError - map to VALIDATION_FAILED with 422 status
  // Check both instanceof and name to handle zod version mismatches across workspaces
  if (
    error instanceof ZodError ||
    (error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError" &&
      "issues" in error &&
      Array.isArray(error.issues))
  ) {
    const details: ApiErrorDetail[] = (error as ZodError).issues.map(
      (issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })
    );

    res.status(422).json({
      code: API_ERROR_CODES.VALIDATION_FAILED,
      message: "Validation failed",
      details,
    });
    return;
  }

  // Prisma known request errors
  if (isPrismaError(error)) {
    // P2002 - Unique constraint violation
    if (error.code === "P2002") {
      res.status(409).json({
        code: API_ERROR_CODES.CONFLICT,
        message: "Resource already exists",
      });
      return;
    }

    // P2025 - Record not found
    if (error.code === "P2025") {
      res.status(404).json({
        code: API_ERROR_CODES.NOT_FOUND,
        message: "Resource not found",
      });
      return;
    }
  }

  // Unknown error - return generic internal error
  res.status(500).json({
    code: API_ERROR_CODES.INTERNAL,
    message: "Internal server error",
  });
}
