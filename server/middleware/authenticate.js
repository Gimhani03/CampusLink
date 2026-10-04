/**
 * Authentication middleware.
 *
 * Verifies the JWT access token on every protected route.
 * Attaches the full user document (minus sensitive fields) to req.user
 * so downstream middleware and controllers never need to query the DB
 * for the current user's identity.
 *
 * Token extraction priority:
 *   1. Authorization header: "Bearer <token>"
 *   2. Signed cookie:        req.cookies.accessToken
 *
 * Supporting both allows:
 *   - Browser clients  → cookie-based (XSS-safe, automatic)
 *   - Mobile / API clients → header-based (explicit, flexible)
 *
 * Why fetch the user from DB on every request?
 *   A JWT alone cannot detect account suspension (isActive = false) or
 *   a role change that happened after the token was issued. Fetching the
 *   user document gives us those guarantees at the cost of one indexed
 *   DB read per request — acceptable for this scale.
 */

import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";

const authenticate = async (req, _res, next) => {
  try {
    // ── 1. Extract token ────────────────────────────────────────────────────

    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.query?.token) {
      // Fallback for SSE connections where EventSource cannot set headers.
      token = req.query.token;
    }

    if (!token) {
      return next(ApiError.unauthorized("Access token is missing. Please log in."));
    }

    // ── 2. Verify signature and expiry ──────────────────────────────────────

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (jwtError) {
      // Let the centralised error handler convert TokenExpiredError /
      // JsonWebTokenError into the correct 401 response.
      return next(jwtError);
    }

    // ── 3. Confirm user still exists and is active ──────────────────────────

    const user = await User.findById(decoded._id);

    if (!user) {
      return next(ApiError.unauthorized("User belonging to this token no longer exists."));
    }

    if (!user.isActive) {
      return next(ApiError.forbidden("Your account has been suspended. Please contact support."));
    }

    // ── 4. Attach to request ────────────────────────────────────────────────

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
