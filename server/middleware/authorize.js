/**
 * Role-based authorization middleware factory.
 *
 * Returns a middleware that checks whether the authenticated user's role
 * is included in the list of permitted roles for that route.
 *
 * Must always be used AFTER `authenticate` because it reads req.user,
 * which authenticate attaches.
 *
 * Usage:
 *   // Admin only
 *   router.get("/analytics", authenticate, authorize("admin"), getAnalytics);
 *
 *   // Both roles allowed
 *   router.get("/events", authenticate, authorize("student", "admin"), getEvents);
 *
 * @param  {...string} roles  One or more permitted role strings.
 * @returns {Function}        Express middleware.
 */

import ApiError from "../utils/ApiError.js";

const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      // Defensive guard — should never happen if route is wired correctly.
      return next(ApiError.unauthorized("Not authenticated."));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not authorised to access this resource.`
        )
      );
    }

    next();
  };
};

export default authorize;
