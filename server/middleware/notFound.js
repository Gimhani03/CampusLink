/**
 * 404 Not Found middleware.
 *
 * Mounted after all application routes in app.js.
 * Catches any request that did not match a defined route and forwards
 * a structured ApiError to the centralised error handler, so the
 * 404 response follows the same JSON envelope as all other errors.
 */

import ApiError from "../utils/ApiError.js";

const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
