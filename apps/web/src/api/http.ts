import { z } from "zod";
import { apiErrorSchema, type ApiError } from "@renewal/shared";

/**
 * API client error thrown when a request fails.
 * Carries the HTTP status, parsed error code, message, and validation details.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiError["code"],
    message: string,
    public readonly details?: ApiError["details"],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions<T extends z.ZodTypeAny> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  schema: T;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper that sends JSON, parses the response through a Zod schema,
 * and throws ApiClientError on failure.
 */
export async function request<T extends z.ZodTypeAny>(
  path: string,
  options: RequestOptions<T>,
): Promise<z.infer<T>> {
  const { method = "GET", body, schema, signal } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  // Don't pass signal in test environment to avoid jsdom compatibility issues
  if (signal && typeof process === "undefined") {
    fetchOptions.signal = signal;
  }

  const response = await fetch(path, fetchOptions);

  if (!response.ok) {
    // Parse error response with apiErrorSchema
    let apiError: ApiError;
    try {
      const errorJson = await response.json();
      apiError = apiErrorSchema.parse(errorJson);
    } catch {
      // If error response doesn't match schema, create a generic error
      throw new ApiClientError(
        response.status,
        "INTERNAL",
        `Request failed with status ${response.status}`,
      );
    }

    throw new ApiClientError(
      response.status,
      apiError.code,
      apiError.message,
      apiError.details,
    );
  }

  const json = await response.json();
  return schema.parse(json);
}

interface RequestVoidOptions {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper for requests that return 204 No Content.
 */
export async function requestVoid(
  path: string,
  options: RequestVoidOptions = {},
): Promise<void> {
  const { method = "DELETE", body, signal } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  // Don't pass signal in test environment to avoid jsdom compatibility issues
  if (signal && typeof process === "undefined") {
    fetchOptions.signal = signal;
  }

  const response = await fetch(path, fetchOptions);

  if (!response.ok) {
    // Parse error response with apiErrorSchema
    let apiError: ApiError;
    try {
      const errorJson = await response.json();
      apiError = apiErrorSchema.parse(errorJson);
    } catch {
      throw new ApiClientError(
        response.status,
        "INTERNAL",
        `Request failed with status ${response.status}`,
      );
    }

    throw new ApiClientError(
      response.status,
      apiError.code,
      apiError.message,
      apiError.details,
    );
  }

  // For 204 No Content, don't try to parse response body
  if (response.status !== 204) {
    throw new Error(`Expected 204 No Content, got ${response.status}`);
  }
}

interface RequestFormDataOptions<T extends z.ZodTypeAny> {
  method?: "POST" | "PUT" | "PATCH";
  body: FormData;
  schema: T;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper for multipart/form-data uploads.
 * Omits JSON Content-Type header to let the browser set the boundary.
 */
export async function requestFormData<T extends z.ZodTypeAny>(
  path: string,
  options: RequestFormDataOptions<T>,
): Promise<z.infer<T>> {
  const { method = "POST", body, schema, signal } = options;

  const fetchOptions: RequestInit = {
    method,
    credentials: "include",
    body,
  };

  // Don't pass signal in test environment to avoid jsdom compatibility issues
  if (signal && typeof process === "undefined") {
    fetchOptions.signal = signal;
  }

  const response = await fetch(path, fetchOptions);

  if (!response.ok) {
    // Parse error response with apiErrorSchema
    let apiError: ApiError;
    try {
      const errorJson = await response.json();
      apiError = apiErrorSchema.parse(errorJson);
    } catch {
      throw new ApiClientError(
        response.status,
        "INTERNAL",
        `Request failed with status ${response.status}`,
      );
    }

    throw new ApiClientError(
      response.status,
      apiError.code,
      apiError.message,
      apiError.details,
    );
  }

  const json = await response.json();
  return schema.parse(json);
}
