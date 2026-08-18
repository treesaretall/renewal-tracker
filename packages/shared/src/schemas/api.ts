import { z } from "zod";

// API Response Convention:
// - Success responses return the bare resource JSON (e.g., RenewalItem, PublicUser)
//   with NO wrapper object, EXCEPT list endpoints which use paginatedSchema.
// - Error responses ALWAYS use apiErrorSchema shape.
// This asymmetry is intentional: it keeps successful responses minimal while
// providing consistent error structure. Document it here to prevent drift.

// API error codes
export const API_ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export const apiErrorCodeSchema = z.enum([
  API_ERROR_CODES.VALIDATION_FAILED,
  API_ERROR_CODES.UNAUTHENTICATED,
  API_ERROR_CODES.FORBIDDEN,
  API_ERROR_CODES.NOT_FOUND,
  API_ERROR_CODES.CONFLICT,
  API_ERROR_CODES.PAYLOAD_TOO_LARGE,
  API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
  API_ERROR_CODES.RATE_LIMITED,
  API_ERROR_CODES.INTERNAL,
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

// API error detail
const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

// API error schema
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.array(apiErrorDetailSchema).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// HTTP status codes for each error code
// Single source of truth for status code mapping
export const HTTP_STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  [API_ERROR_CODES.VALIDATION_FAILED]: 400,
  [API_ERROR_CODES.UNAUTHENTICATED]: 401,
  [API_ERROR_CODES.FORBIDDEN]: 403,
  [API_ERROR_CODES.NOT_FOUND]: 404,
  [API_ERROR_CODES.CONFLICT]: 409,
  [API_ERROR_CODES.PAYLOAD_TOO_LARGE]: 413,
  [API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 415,
  [API_ERROR_CODES.RATE_LIMITED]: 429,
  [API_ERROR_CODES.INTERNAL]: 500,
};

// Generic paginated response helper
export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int().min(0),
  });
}

export type Paginated<T> = {
  data: T[];
  total: number;
};
