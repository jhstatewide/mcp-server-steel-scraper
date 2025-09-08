export enum SteelErrorCode {
  // Network related errors
  NETWORK_UNAVAILABLE = "NETWORK/UNAVAILABLE",
  NETWORK_TIMEOUT = "NETWORK/TIMEOUT",
  NETWORK_DNS_FAILURE = "NETWORK/DNS_FAILURE",
  
  // Content related errors
  CONTENT_TRUNCATED = "CONTENT/TRUNCATED",
  CONTENT_EMPTY = "CONTENT/EMPTY",
  CONTENT_PARSE_FAILED = "CONTENT/PARSE_FAILED",
  
  // Authentication related errors
  AUTH_REQUIRED = "AUTH/REQUIRED",
  AUTH_INVALID = "AUTH/INVALID",
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT/EXCEEDED",
  
  // Server related errors
  SERVER_ERROR = "SERVER/ERROR",
  SERVER_UNAVAILABLE = "SERVER/UNAVAILABLE",
  
  // Client errors
  CLIENT_ERROR = "CLIENT/ERROR",
  
  // Unknown errors
  UNKNOWN_ERROR = "UNKNOWN/ERROR"
}

export interface SteelError extends Error {
  code: SteelErrorCode;
  metadata?: Record<string, any>;
  originalError?: Error;
}

export class SteelDevError extends Error implements SteelError {
  code: SteelErrorCode;
  metadata?: Record<string, any>;
  originalError?: Error;

  constructor(
    code: SteelErrorCode,
    message: string,
    metadata?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = "SteelDevError";
    this.code = code;
    this.metadata = metadata;
    this.originalError = originalError;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SteelDevError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      metadata: this.metadata,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

export function createSteelError(
  code: SteelErrorCode,
  message: string,
  metadata?: Record<string, any>,
  originalError?: Error
): SteelDevError {
  return new SteelDevError(code, message, metadata, originalError);
}