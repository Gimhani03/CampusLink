/**
 * Custom operational error class.
 *
 * Differentiates between two categories of errors:
 *
 *   - Operational (isOperational = true):
 *       Expected runtime failures such as 404 Not Found, 400 Bad Request,
 *       401 Unauthorized, etc. These are safe to expose to the client.
 *
 *   - Programming / Unknown (isOperational = false):
 *       Unexpected bugs, third-party library crashes, etc. The error
 *       handler will NOT expose their details to clients in production.
 *
 * Controllers and services throw ApiError instances.
 * The centralised error handler in middleware/errorHandler.js catches them.
 */

class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code (e.g. 400, 401, 404).
   * @param {string} message     Human-readable error description.
   * @param {Array}  errors      Optional array of field-level validation errors.
   * @param {string} stack       Optional stack trace (auto-captured if omitted).
   */
  constructor(statusCode, message, errors = [], stack = "") {
    super(message);

    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.isOperational = true;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ─── Convenience factory methods ────────────────────────────────────────────

  static badRequest(message = "Bad Request", errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static unprocessable(message = "Unprocessable Entity", errors = []) {
    return new ApiError(422, message, errors);
  }

  static internal(message = "Internal Server Error") {
    return new ApiError(500, message);
  }
}

export default ApiError;
