/**
 * Event routes.
 *
 * Public routes (read-only, visible events only):
 *   GET  /               — paginated event list with search/filter/sort
 *   GET  /:id            — single event detail
 *
 * Admin-only routes (require authenticate + authorize("admin")):
 *   POST /               — create event (multipart/form-data with optional image)
 *   PUT  /:id            — full update (multipart/form-data with optional image)
 *   DELETE /:id          — delete event
 *   PATCH /:id/publish   — draft → published
 *   PATCH /:id/cancel    — published → cancelled
 *   PATCH /:id/complete  — published → completed
 *   POST /:id/questions  — add a registration question
 *   DELETE /:id/questions/:questionId — remove a registration question
 *
 * Middleware pipeline for multipart routes:
 *   [auth] → uploadSingle → normaliseMultipartBody → [validator chains] → validate → controller
 *
 * normaliseMultipartBody runs after Multer so that JSON-serialised fields
 * (venue, tags, registrationQuestions) are parsed into proper types before
 * express-validator inspects them.  The controller's parseBodyFields is
 * kept as a safety net for pure-JSON requests.
 */

import { Router } from "express";
import { param } from "express-validator";

import authenticate from "../middleware/authenticate.js";
import authenticateOptional from "../middleware/authenticateOptional.js";
import authorize from "../middleware/authorize.js";
import validate from "../middleware/validate.js";
import { uploadSingle } from "../utils/upload.js";

import {
  createEventValidator,
  updateEventValidator,
  eventIdValidator,
} from "../validators/event.validator.js";

import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  publishEvent,
  unpublishEvent,
  cancelEvent,
  completeEvent,
  toggleFeatureEvent,
  addRegistrationQuestion,
  removeRegistrationQuestion,
} from "../controllers/event.controller.js";

const router = Router();

// ─── Multipart body normaliser ────────────────────────────────────────────────
// Runs after Multer (uploadSingle) so JSON-serialised fields are converted to
// their proper types before express-validator chains inspect them.

const normaliseMultipartBody = (req, _res, next) => {
  const b = req.body;

  // tags: '["music","tech"]' or "music,tech" → array
  if (typeof b.tags === "string") {
    try { b.tags = JSON.parse(b.tags); }
    catch { b.tags = b.tags.split(",").map((t) => t.trim()).filter(Boolean); }
  }

  // registrationQuestions: JSON string → array of objects
  if (typeof b.registrationQuestions === "string") {
    try { b.registrationQuestions = JSON.parse(b.registrationQuestions); }
    catch { b.registrationQuestions = []; }
  }

  // venue: JSON string → { name, address, mapLink }
  if (typeof b.venue === "string") {
    try { b.venue = JSON.parse(b.venue); }
    catch { b.venue = undefined; }
  }

  // isFeatured: "true"/"false" string → boolean
  if (typeof b.isFeatured === "string") {
    b.isFeatured = b.isFeatured === "true";
  }

  // capacity: "50" → 50 | "" → null
  if (b.capacity !== undefined) {
    b.capacity = (b.capacity === "" || b.capacity === null)
      ? null
      : parseInt(b.capacity, 10) || null;
  }

  // channel: empty string → null
  if (b.channel === "") b.channel = null;

  next();
};

// ── Public routes ─────────────────────────────────────────────────────────────

router.get("/", authenticateOptional, getAllEvents);

router.get("/:id", authenticateOptional, eventIdValidator, validate, getEventById);

// ── Admin-only routes ─────────────────────────────────────────────────────────

router.post(
  "/",
  authenticate,
  authorize("admin"),
  uploadSingle("coverImage"),
  normaliseMultipartBody,
  createEventValidator,
  validate,
  createEvent
);

router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  uploadSingle("coverImage"),
  normaliseMultipartBody,
  eventIdValidator,
  updateEventValidator,
  validate,
  updateEvent
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  deleteEvent
);

// ── Status transitions ────────────────────────────────────────────────────────

router.patch(
  "/:id/publish",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  publishEvent
);

router.patch(
  "/:id/unpublish",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  unpublishEvent
);

router.patch(
  "/:id/cancel",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  cancelEvent
);

router.patch(
  "/:id/complete",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  completeEvent
);

// Toggle featured (enforces single-featured-event invariant server-side).
router.patch(
  "/:id/feature",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  toggleFeatureEvent
);

// ── Registration questions ────────────────────────────────────────────────────

router.post(
  "/:id/questions",
  authenticate,
  authorize("admin"),
  eventIdValidator,
  validate,
  addRegistrationQuestion
);

router.delete(
  "/:id/questions/:questionId",
  authenticate,
  authorize("admin"),
  [
    ...eventIdValidator,
    param("questionId").isMongoId().withMessage("Invalid question ID."),
  ],
  validate,
  removeRegistrationQuestion
);

export default router;
