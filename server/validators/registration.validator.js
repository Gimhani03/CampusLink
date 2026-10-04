/**
 * Registration input validators.
 *
 * express-validator handles the structural shape of the request
 * (is eventId a valid MongoId? is answers an array?).
 *
 * Content validation of individual answers — type correctness, required
 * fields, option membership — is too tightly coupled to the event's
 * question definitions to express as static chains. That validation
 * lives in the service layer where the event document is available.
 */

import { body, param, query } from "express-validator";

// ─── Register for an event ────────────────────────────────────────────────────

export const registerValidator = [
  body("eventId")
    .notEmpty().withMessage("eventId is required.")
    .isMongoId().withMessage("eventId must be a valid ID."),

  body("answers")
    .optional()
    .isArray().withMessage("answers must be an array."),

  body("answers.*.questionId")
    .notEmpty().withMessage("Each answer must reference a questionId.")
    .isMongoId().withMessage("questionId must be a valid ID."),

  body("answers.*.answer")
    .exists({ checkNull: true })
    .withMessage("Each answer entry must include an answer value."),

  body("team")
    .optional()
    .isObject().withMessage("team must be an object."),

  body("team.name")
    .optional()
    .isString().withMessage("team.name must be a string.")
    .isLength({ max: 120 }),

  body("team.size")
    .optional()
    .isInt({ min: 2, max: 5 }).withMessage("team.size must be between 2 and 5."),

  body("team.university")
    .optional()
    .isString().withMessage("team.university must be a string."),

  body("team.registrantRole")
    .optional()
    .isIn(["leader", "member_1", "member_2", "member_3", "member_4"])
    .withMessage("team.registrantRole is invalid."),

  body("team.members")
    .optional()
    .isArray({ min: 2, max: 5 }).withMessage("team.members must contain 2–5 entries."),

  body("team.members.*.studentId")
    .optional()
    .isString().withMessage("team.members[].studentId must be a string.")
    .isLength({ max: 20 }),
];

export const lookupTeamMemberValidator = [
  param("studentId")
    .trim()
    .notEmpty().withMessage("Student ID is required.")
    .matches(/^[A-Za-z0-9\/\-]+$/)
    .withMessage("Student ID can only contain letters, numbers, hyphens, and slashes.")
    .isLength({ max: 20 }).withMessage("Student ID cannot exceed 20 characters."),

  query("eventId")
    .optional()
    .isMongoId().withMessage("eventId must be a valid ID."),
];

export const lookupTeamMemberByEmailValidator = [
  param("email")
    .trim()
    .notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Please provide a valid email address.")
    .normalizeEmail({ gmail_remove_dots: false }),

  query("eventId")
    .optional()
    .isMongoId().withMessage("eventId must be a valid ID."),
];

// ─── Route param validators ───────────────────────────────────────────────────

export const registrationIdValidator = [
  param("id").isMongoId().withMessage("Invalid registration ID."),
];

export const eventIdParamValidator = [
  param("eventId").isMongoId().withMessage("Invalid event ID."),
];

// ─── Admin status update ──────────────────────────────────────────────────────

export const updateStatusValidator = [
  param("id").isMongoId().withMessage("Invalid registration ID."),

  body("status")
    .notEmpty().withMessage("status is required.")
    .isIn(["confirmed", "cancelled", "waitlisted"])
    .withMessage("status must be one of: confirmed, cancelled, waitlisted."),
];
