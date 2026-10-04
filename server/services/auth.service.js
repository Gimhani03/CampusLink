/**
 * Auth Service — core authentication business logic.
 *
 * This layer is intentionally decoupled from Express (no req/res/next).
 * Every function receives plain data and returns plain data or throws
 * an ApiError. This makes the logic independently testable and keeps
 * controllers thin HTTP adapters.
 *
 * Token strategy:
 *   Access token  — short-lived (15 min), sent in the JSON body.
 *                   Client stores it in memory (NOT localStorage).
 *   Refresh token — long-lived (30 days), sent as an httpOnly cookie.
 *                   Used only to issue new access tokens.
 *                   Rotated on every use (old token invalidated).
 *                   Stored hashed in the DB to limit breach impact.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { streamToCloudinary, deleteFromCloudinary } from "../utils/upload.js";
import { isNsbmStudentEmail, NSBM_STUDENT_EMAIL_SUFFIX } from "../constants/nsbm.js";
import { NSBM_UNIVERSITY, isAllowedExternalUniversity } from "../constants/universities.js";
import { canUserRegisterForEvent, audienceScopeDeniedMessage } from "../utils/eventAudience.js";
import Event from "../models/Event.model.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Generates a fresh access + refresh token pair for a user,
 * saves the new refresh token to the database, and returns both tokens.
 * Centralising this prevents the generate-and-save logic from being
 * duplicated across register, login, and refresh flows.
 *
 * @param {mongoose.Document} user
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const generateAndSaveTokens = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Persist the refresh token so we can validate and rotate it later.
  // Using findByIdAndUpdate instead of user.save() avoids re-running the
  // bcrypt pre-save hook on the password field.
  await User.findByIdAndUpdate(user._id, { refreshToken });

  return { accessToken, refreshToken };
};

// ─── Exported service functions ───────────────────────────────────────────────

/**
 * Registers a new student account.
 * Admin accounts are NOT created through this flow.
 *
 * @param {object} data  Validated registration payload from the controller.
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
export const registerStudent = async (data) => {
  const { fullName, email, studentId, degree, batch, whatsappNumber, password, interests } = data;

  if (!isNsbmStudentEmail(email)) {
    throw ApiError.badRequest(`Registration requires an NSBM student email (${NSBM_STUDENT_EMAIL_SUFFIX}).`);
  }

  // Check for duplicate email and studentId in a single query each.
  // Two separate queries give a more specific conflict message than one $or query.
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const existingStudentId = await User.findOne({ studentId: studentId.toUpperCase() });
  if (existingStudentId) {
    throw ApiError.conflict("An account with this Student ID already exists.");
  }

  // Password is hashed by the User model's pre-save hook.
  const user = await User.create({
    fullName,
    email,
    studentId,
    degree,
    batch,
    whatsappNumber,
    password,
    interests: interests ?? [],
    studentType: "nsbm",
    university: NSBM_UNIVERSITY,
    role: "student",
  });

  const { accessToken, refreshToken } = await generateAndSaveTokens(user);

  return { user: user.toJSON(), accessToken, refreshToken };
};

/**
 * Registers a guest / external-university student for inter-university hackathons.
 *
 * @param {object} data
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
export const registerExternalStudent = async (data) => {
  const { fullName, email, university, whatsappNumber, password } = data;

  if (isNsbmStudentEmail(email)) {
    throw ApiError.badRequest(
      `NSBM students must register with their ${NSBM_STUDENT_EMAIL_SUFFIX} email on the main signup page.`
    );
  }

  if (!isAllowedExternalUniversity(university)) {
    throw ApiError.badRequest("Select your university. NSBM students must use the main signup page.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    university: university.trim(),
    whatsappNumber,
    password,
    studentType: "external",
    role: "student",
    interests: [],
  });

  const { accessToken, refreshToken } = await generateAndSaveTokens(user);

  return { user: user.toJSON(), accessToken, refreshToken };
};

/**
 * Authenticates a user (student or admin) by email and password.
 *
 * @param {string} email
 * @param {string} password  Plain-text password from the login form.
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
export const loginUser = async (email, password) => {
  // .select("+password") overrides the schema-level `select: false`
  // so the password hash is included in this query only.
  const user = await User.findOne({ email }).select("+password");

  // Use a generic error for both "not found" and "wrong password" to prevent
  // user enumeration attacks (attacker cannot tell which case failed).
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("Your account has been suspended. Please contact support.");
  }

  const { accessToken, refreshToken } = await generateAndSaveTokens(user);

  return { user: user.toJSON(), accessToken, refreshToken };
};

/**
 * Issues a new access + refresh token pair from a valid refresh token.
 * Implements token rotation: the incoming refresh token is invalidated
 * and replaced with a new one on every successful refresh.
 *
 * @param {string} incomingRefreshToken  Token read from the httpOnly cookie.
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export const refreshAccessToken = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw ApiError.unauthorized("Refresh token is missing. Please log in again.");
  }

  // Verify the token's signature and expiry using the dedicated refresh secret.
  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token. Please log in again.");
  }

  // Fetch the user and include the stored refresh token for comparison.
  const user = await User.findById(decoded._id).select("+refreshToken");

  if (!user) {
    throw ApiError.unauthorized("User belonging to this token no longer exists.");
  }

  // Detect refresh token reuse: if the incoming token doesn't match the
  // stored token, the token has already been rotated (possible theft).
  // Invalidate all sessions by clearing the stored token.
  if (user.refreshToken !== incomingRefreshToken) {
    await User.findByIdAndUpdate(user._id, { refreshToken: null });
    throw ApiError.unauthorized(
      "Refresh token reuse detected. All sessions have been invalidated. Please log in again."
    );
  }

  if (!user.isActive) {
    throw ApiError.forbidden("Your account has been suspended. Please contact support.");
  }

  const { accessToken, refreshToken: newRefreshToken } = await generateAndSaveTokens(user);

  return { accessToken, refreshToken: newRefreshToken };
};

/**
 * Logs out the current user by invalidating their refresh token server-side.
 * The access token will continue to work until it expires naturally (15 min).
 * The client is responsible for discarding the in-memory access token.
 *
 * @param {string} userId  The authenticated user's _id from req.user.
 */
export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

/**
 * Returns the authenticated user's profile.
 * Used by the GET /me endpoint to let clients rehydrate their session.
 *
 * @param {string} userId
 * @returns {object}  Sanitised user document.
 */
export const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound("User not found.");
  }

  return user.toJSON();
};

/**
 * Updates the mutable fields of a student profile.
 * Email and studentId are intentionally excluded — they are university-issued
 * identifiers and must not be changed through this endpoint.
 */
export const updateProfile = async (userId, { fullName, degree, batch, whatsappNumber, interests }) => {
  const updates = {};
  if (fullName      !== undefined) updates.fullName      = fullName;
  if (degree        !== undefined) updates.degree        = degree;
  if (batch         !== undefined) updates.batch         = batch;
  if (whatsappNumber !== undefined) updates.whatsappNumber = whatsappNumber;
  if (interests     !== undefined) updates.interests     = interests;

  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound("User not found.");
  return user.toJSON();
};

/**
 * Uploads a new profile picture to Cloudinary and updates the user document.
 * Deletes the old image from Cloudinary first (if one exists) to avoid orphaned assets.
 */
export const updateAvatar = async (userId, fileBuffer) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found.");

  // Delete old image from Cloudinary if it exists
  if (user.profilePicture?.publicId) {
    await deleteFromCloudinary(user.profilePicture.publicId).catch(() => {});
  }

  const result = await streamToCloudinary(fileBuffer, "avatars", {
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  });

  user.profilePicture = { url: result.secure_url, publicId: result.public_id };
  await user.save({ validateBeforeSave: false });
  return user.toJSON();
};

/**
 * Changes the user's password after verifying the current one.
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select("+password");
  if (!user) throw ApiError.notFound("User not found.");

  const isCorrect = await user.isPasswordCorrect(currentPassword);
  if (!isCorrect) throw ApiError.badRequest("Current password is incorrect.");

  // Assign new password — pre-save hook will hash it
  user.password = newPassword;
  await user.save();
  return user.toJSON();
};

/**
 * Returns the list of events the user has saved, populated with basic event info.
 */
export const getSavedEvents = async (userId) => {
  const user = await User.findById(userId)
    .select("savedEvents studentType role")
    .populate({
      path: "savedEvents",
      select: "title category coverImage startDate eventType venue onlineLink status registrationDeadline registrationCount capacity audienceScope",
    })
    .lean();
  if (!user) throw ApiError.notFound("User not found.");

  let events = user.savedEvents ?? [];
  if (user.role === "student" && user.studentType === "external") {
    events = events.filter((e) => e && e.audienceScope === "inter_university");
  }
  return events;
};

/**
 * Adds the event to savedEvents if not already saved, otherwise removes it.
 * Returns { saved: boolean, savedEvents: ObjectId[] }.
 */
export const toggleSavedEvent = async (userId, eventId) => {
  const user = await User.findById(userId).select("savedEvents studentType role");
  if (!user) throw ApiError.notFound("User not found.");

  const event = await Event.findById(eventId).select("audienceScope status");
  if (!event) throw ApiError.notFound("Event not found.");

  if (!canUserRegisterForEvent(event, user)) {
    throw ApiError.forbidden(audienceScopeDeniedMessage);
  }

  const alreadySaved = user.savedEvents.some((id) => String(id) === String(eventId));

  if (alreadySaved) {
    await User.findByIdAndUpdate(userId, { $pull:    { savedEvents: eventId } });
  } else {
    await User.findByIdAndUpdate(userId, { $addToSet: { savedEvents: eventId } });
  }

  const updated = await User.findById(userId).select("savedEvents").lean();
  return { saved: !alreadySaved, savedEvents: updated.savedEvents };
};
