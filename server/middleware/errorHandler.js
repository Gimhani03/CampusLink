/**
 * Centralised Express error-handling middleware.
 *
 * Must be the LAST middleware registered in app.js (after all routes
 * and the notFound middleware) because Express identifies error handlers
 * by their four-parameter signature: (err, req, res, next).
 *
 * Responsibilities:
 *   1. Normalise known Mongoose and JWT errors into ApiError instances.
 *   2. Log non-operational (unexpected) errors at the error level.
 *   3. Send a consistent JSON error envelope to the client.
 *   4. Never leak stack traces or internal details in production.
 */

import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";

/**
 * Maps known third-party error types to ApiError instances so that
 * controllers do not need to handle them individually.
 *
 * @param {Error} err
 * @returns {ApiError}
 */
const normaliseError = (err) => {
  // Already an operational ApiError — pass through unchanged.
  if (err instanceof ApiError) return err;

  // CORS rejection — return a clean 403 instead of a generic 500.
  if (err.message?.startsWith("CORS:") || err.statusCode === 403) {
    return ApiError.forbidden(err.message || "Forbidden");
  }

  // Mongoose: invalid ObjectId (e.g. /events/not-an-id)
  if (err.name === "CastError") {
    return ApiError.badRequest(`Invalid value for field: ${err.path}`);
  }

  // Mongoose: unique index violation (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] ?? "field";
    return ApiError.conflict(`${field} already exists.`);
  }

  // Mongoose: schema validation failure
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.unprocessable("Validation failed", errors);
  }

  // JWT: token has expired
  if (err.name === "TokenExpiredError") {
    return ApiError.unauthorized("Your session has expired. Please log in again.");
  }

  // JWT: token is malformed or signature is invalid
  if (err.name === "JsonWebTokenError") {
    return ApiError.unauthorized("Invalid token. Please log in again.");
  }

  // Unknown / programming error — do not expose internal details.
  // Mark as non-operational so the handler logs the real stack trace.
  const apiErr = new ApiError(500, "Something went wrong. Please try again later.");
  apiErr.isOperational = false;
  return apiErr;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const apiError = normaliseError(err);

  // For unknown / programming errors, always log the ORIGINAL error with its
  // full stack so the root cause is visible in the terminal. The generic
  // "Something went wrong" message is only sent to the client.
  if (!apiError.isOperational) {
    logger.error(`[Unhandled Error] ${err.message}`, { stack: err.stack });
  } else if (apiError.statusCode >= 500) {
    // Operational 500 — log the original message too for debugging.
    logger.error(`[Server Error] ${apiError.message}${err !== apiError ? ` | Origin: ${err.message}` : ""}`);
  } else {
    logger.warn(`[Client Error ${apiError.statusCode}] ${apiError.message}`);
  }

  res.status(apiError.statusCode).json({
    success: false,
    statusCode: apiError.statusCode,
    message: apiError.message,
    // Field-level errors are useful for form validation feedback on the client.
    ...(apiError.errors.length > 0 && { errors: apiError.errors }),
    // Only expose stack traces to developers in non-production environments.
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
