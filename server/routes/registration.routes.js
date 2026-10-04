/**
 * Registration routes.
 *
 * All routes require authentication — there are no public registration endpoints.
 *
 * Student routes:
 *   POST  /                      — register for an event
 *   GET   /my                    — my registrations (paginated)
 *   GET   /check/:eventId        — am I registered for this event?
 *   GET   /:id                   — single registration detail
 *   PATCH /:id/cancel            — cancel my own registration
 *
 * Admin routes:
 *   GET   /event/:eventId        — all registrations for an event (paginated)
 *   PATCH /:id/status            — manually update registration status
 *
 * Note on route ordering:
 *   Static segments (/my, /event/:eventId, /check/:eventId) are declared
 *   BEFORE the dynamic /:id route to prevent Express from matching "my"
 *   or "check" as a registration ObjectId.
 */

import { Router } from "express";
import { param } from "express-validator";

import authenticate from "../middleware/authenticate.js";
import authorize    from "../middleware/authorize.js";
import validate     from "../middleware/validate.js";

import {
  registerValidator,
  registrationIdValidator,
  eventIdParamValidator,
  updateStatusValidator,
  lookupTeamMemberValidator,
  lookupTeamMemberByEmailValidator,
} from "../validators/registration.validator.js";

import {
  registerForEvent,
  getMyRegistrations,
  getRegistrationById,
  getRegistrationPassHandler,
  cancelRegistration,
  getEventRegistrations,
  updateRegistrationStatus,
  checkRegistrationStatus,
  lookupTeamMember,
  lookupTeamMemberByEmail,
} from "../controllers/registration.controller.js";

const router = Router();

// All registration routes require a valid access token.
router.use(authenticate);

// ── Student routes ────────────────────────────────────────────────────────────

// Register for an event — students only.
router.post(
  "/",
  authorize("student"),
  registerValidator,
  validate,
  registerForEvent
);

// Retrieve the current student's registration history.
router.get("/my", authorize("student"), getMyRegistrations);

// Check whether the student is registered for a specific event.
router.get(
  "/check/:eventId",
  authorize("student"),
  eventIdParamValidator,
  validate,
  checkRegistrationStatus
);

// Look up a teammate by student ID for team registration autofill.
router.get(
  "/lookup-member/:studentId",
  authorize("student"),
  lookupTeamMemberValidator,
  validate,
  lookupTeamMember
);

router.get(
  "/lookup-member-by-email/:email",
  authorize("student"),
  lookupTeamMemberByEmailValidator,
  validate,
  lookupTeamMemberByEmail
);

// ── Admin routes ──────────────────────────────────────────────────────────────

// All registrations for a given event — admin only.
router.get(
  "/event/:eventId",
  authorize("admin"),
  eventIdParamValidator,
  validate,
  getEventRegistrations
);

// Manually update a registration's status — admin only.
router.patch(
  "/:id/status",
  authorize("admin"),
  updateStatusValidator,
  validate,
  updateRegistrationStatus
);

// ── Shared routes (student: own only | admin: any) ────────────────────────────

// Get a single registration. Access-control enforced in the service.
router.get(
  "/:id/pass",
  authorize("student"),
  registrationIdValidator,
  validate,
  getRegistrationPassHandler
);

router.get(
  "/:id",
  registrationIdValidator,
  validate,
  getRegistrationById
);

// Cancel a registration. Access-control enforced in the service.
router.patch(
  "/:id/cancel",
  registrationIdValidator,
  validate,
  cancelRegistration
);

export default router;
