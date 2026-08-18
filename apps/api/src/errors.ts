import {
  API_ERROR_CODES,
  type ApiErrorCode,
  type ApiErrorDetail,
  HTTP_STATUS_BY_ERROR_CODE,
} from "@renewal/shared";

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: ApiErrorDetail[];

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = HTTP_STATUS_BY_ERROR_CODE[code];
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace(this, this.constructor);
  }

  static validationFailed(message: string, details?: ApiErrorDetail[]): ApiError {
    return new ApiError(API_ERROR_CODES.VALIDATION_FAILED, message, details);
  }

  static unauthenticated(message = "Authentication required"): ApiError {
    return new ApiError(API_ERROR_CODES.UNAUTHENTICATED, message);
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(API_ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(resource: string): ApiError {
    return new ApiError(API_ERROR_CODES.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(API_ERROR_CODES.CONFLICT, message);
  }

  static payloadTooLarge(message = "Payload too large"): ApiError {
    return new ApiError(API_ERROR_CODES.PAYLOAD_TOO_LARGE, message);
  }

  static unsupportedMediaType(message = "Unsupported media type"): ApiError {
    return new ApiError(API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, message);
  }

  static rateLimited(message = "Too many requests"): ApiError {
    return new ApiError(API_ERROR_CODES.RATE_LIMITED, message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(API_ERROR_CODES.INTERNAL, message);
  }
}
