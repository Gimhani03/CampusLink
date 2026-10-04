/**
 * Auth Controller — HTTP request/response adapter.
 *
 * Responsibilities:
 *   - Read validated data from req.body / req.cookies / req.user.
 *   - Call the appropriate auth service function.
 *   - Write the HTTP response (status, cookie, JSON body).
 *   - Forward any thrown errors to the centralised error handler.
 *
 * No business logic lives here. If you find yourself writing an `if`
 * that is not about shaping the HTTP response, it belongs in the service.
 */

import * as authService from "../services/auth.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError    from "../utils/ApiError.js";
import env from "../config/env.js";

// ─── Cookie configuration ─────────────────────────────────────────────────────

/**
 * Options applied to the refresh token cookie.
 *
 * httpOnly  — JavaScript (and therefore XSS) cannot read this cookie.
 * secure    — Cookie is only sent over HTTPS in production.
 * sameSite  — "strict" prevents the cookie from being sent on
 *             cross-site requests, mitigating CSRF.
 * maxAge    — Matches the refresh token's 30-day lifetime.
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: "strict",
  maxAge: env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
};

/** Clears the refresh token cookie on logout / token rotation failure. */
const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: "strict",
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new student account and issues tokens.
 */
export const register = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.registerStudent(req.body);

    res
      .status(201)
      .cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS)
      .json(
        new ApiResponse(201, { user, accessToken }, "Account created successfully.")
      );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/register/guest
 * Creates an external-university student account for inter-university hackathons.
 */
export const registerGuest = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.registerExternalStudent(req.body);

    res
      .status(201)
      .cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS)
      .json(
        new ApiResponse(201, { user, accessToken }, "Guest account created successfully.")
      );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 * Authenticates a student or admin and issues tokens.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

    res
      .status(200)
      .cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS)
      .json(
        new ApiResponse(200, { user, accessToken }, "Logged in successfully.")
      );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh-token
 * Issues a new access token using the refresh token from the cookie.
 * Also rotates the refresh token (new cookie is set).
 */
export const refreshToken = async (req, res, next) => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken;

    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(incomingRefreshToken);

    res
      .status(200)
      .cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS)
      .json(
        new ApiResponse(200, { accessToken }, "Access token refreshed successfully.")
      );
  } catch (error) {
    // If the refresh failed (reuse detected, expired, etc.) clear the cookie
    // so the client is forced back to the login page.
    res.clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS);
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 * Invalidates the server-side refresh token and clears the cookie.
 * Requires authentication — uses req.user set by the authenticate middleware.
 */
export const logout = async (req, res, next) => {
  try {
    await authService.logoutUser(req.user._id);

    res
      .status(200)
      .clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS)
      .json(
        new ApiResponse(200, null, "Logged out successfully.")
      );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
 * Used by the frontend to rehydrate the auth context on page load.
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    res.status(200).json(new ApiResponse(200, { user }, "User profile fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/auth/me
 * Updates mutable profile fields (name, degree, batch, whatsapp, interests).
 */
export const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user._id, req.body);
    res.status(200).json(new ApiResponse(200, { user }, "Profile updated successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/auth/me/avatar
 * Uploads a new profile picture (multipart/form-data, field: "avatar").
 */
export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest("Profile picture file is required.");
    const user = await authService.updateAvatar(req.user._id, req.file.buffer);
    res.status(200).json(new ApiResponse(200, { user }, "Profile picture updated successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/auth/me/password
 * Changes the authenticated user's password.
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user._id, currentPassword, newPassword);
    res.status(200).json(new ApiResponse(200, null, "Password changed successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me/saved
 * Returns all events saved by the current user.
 */
export const getSavedEvents = async (req, res, next) => {
  try {
    const events = await authService.getSavedEvents(req.user._id);
    res.status(200).json(new ApiResponse(200, { savedEvents: events }, "Saved events fetched."));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/me/saved/:eventId
 * Toggles the save state for an event. Returns { saved, savedCount }.
 */
export const toggleSavedEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const result = await authService.toggleSavedEvent(req.user._id, eventId);
    res.status(200).json(
      new ApiResponse(200, { saved: result.saved, savedCount: result.savedEvents.length },
        result.saved ? "Event saved." : "Event unsaved.")
    );
  } catch (error) {
    next(error);
  }
};
