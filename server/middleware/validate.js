/**
 * Validation result middleware.
 *
 * Placed after express-validator chains in a route definition.
 * Reads the validation result collected by those chains and, if any
 * errors are present, forwards a structured 400 ApiError to the
 * centralized error handler — terminating the request before it ever
 * reaches the controller.
 *
 * Usage in a route file:
 *   router.post("/register", registerValidator, validate, register);
 */

import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

const validate = (req, _res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: true }).map((err) => ({
    field: err.path,
    message: err.msg,
  }));

  return next(ApiError.badRequest("Validation failed.", errors));
};

export default validate;
