/**
 * Optional authentication middleware.
 *
 * Identical to authenticate.js but never blocks the request.
 * If a valid access token is present, attaches the user to req.user.
 * If no token or an invalid token is present, calls next() silently.
 *
 * Used on public routes where behaviour differs based on identity:
 *   - Unauthenticated users / students → see only published events.
 *   - Authenticated admins             → can filter by any status.
 *
 * This avoids duplicating the public/admin route with two separate
 * route definitions while keeping the auth logic in one place.
 */

import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import env from "../config/env.js";

const authenticateOptional = async (req, _res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return next();

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Swallow all token errors — the request proceeds as anonymous.
  }

  next();
};

export default authenticateOptional;
