/**
 * Auth routes.
 *
 * Each route follows the pipeline:
 *   validator chains → validate middleware → [authenticate] → controller
 *
 * The validate middleware short-circuits the pipeline with a 400 if any
 * validator chain fails, so the controller always receives clean data.
 *
 * Public routes (no token required):
 *   POST /register       — student self-registration
 *   POST /login          — student & admin login
 *   POST /refresh-token  — silent token refresh via cookie
 *
 * Protected routes (valid access token required):
 *   POST /logout         — invalidate session
 *   GET  /me             — fetch current user profile
 */

import { Router } from "express";

import {
  registerValidator, registerGuestValidator, loginValidator,
  updateProfileValidator, changePasswordValidator,
} from "../validators/auth.validator.js";
import validate     from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import { uploadSingle } from "../utils/upload.js";
import {
  register, registerGuest, login, refreshToken, logout, getMe,
  updateProfile, updateAvatar, changePassword,
  getSavedEvents, toggleSavedEvent,
} from "../controllers/auth.controller.js";

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────

router.post("/register", registerValidator, validate, register);

router.post("/register/guest", registerGuestValidator, validate, registerGuest);

router.post("/login", loginValidator, validate, login);

router.post("/refresh-token", refreshToken);

// ── Protected routes ──────────────────────────────────────────────────────────

router.post("/logout", authenticate, logout);

router.get("/me",    authenticate, getMe);
router.put("/me",    authenticate, updateProfileValidator, validate, updateProfile);
router.patch("/me/avatar",   authenticate, uploadSingle("avatar"), updateAvatar);
router.patch("/me/password", authenticate, changePasswordValidator, validate, changePassword);

router.get("/me/saved",            authenticate, getSavedEvents);
router.post("/me/saved/:eventId",  authenticate, toggleSavedEvent);

export default router;
