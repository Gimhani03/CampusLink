/**
 * Event input validators.
 *
 * Three rule sets:
 *   createEventValidator — all required fields enforced.
 *   updateEventValidator — all fields optional (PATCH semantics).
 *   eventIdValidator     — validates :id param on single-resource routes.
 *
 * Cross-field business rules (dates, venue vs. onlineLink) are expressed
 * as .custom() validators so the error messages are specific and actionable.
 */

import { body, param } from "express-validator";

// ─── Shared field definitions ─────────────────────────────────────────────────

const CATEGORIES = [
  "academic", "cultural", "sports", "technology",
  "career", "social", "religious", "competition", "other",
];
const EVENT_TYPES = ["in-person", "online", "hybrid"];
const QUESTION_TYPES = ["text", "multiple_choice", "checkbox", "yes_no", "dropdown"];
const STATUSES = ["draft", "published", "cancelled", "completed"];

// ─── Reusable field chains ────────────────────────────────────────────────────

const titleChain = (required = true) => {
  const chain = body("title").trim();
  return required
    ? chain.notEmpty().withMessage("Event title is required.")
        .isLength({ min: 5, max: 200 })
        .withMessage("Title must be between 5 and 200 characters.")
    : chain.optional()
        .isLength({ min: 5, max: 200 })
        .withMessage("Title must be between 5 and 200 characters.");
};

const descriptionChain = (required = true) => {
  const chain = body("description").trim();
  return required
    ? chain.notEmpty().withMessage("Description is required.")
        .isLength({ min: 20, max: 5000 })
        .withMessage("Description must be between 20 and 5000 characters.")
    : chain.optional()
        .isLength({ min: 20, max: 5000 })
        .withMessage("Description must be between 20 and 5000 characters.");
};

const categoryChain = (required = true) => {
  const chain = body("category");
  return required
    ? chain.notEmpty().withMessage("Category is required.")
        .isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(", ")}.`)
    : chain.optional()
        .isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(", ")}.`);
};

const eventTypeChain = (required = true) => {
  const chain = body("eventType");
  return required
    ? chain.notEmpty().withMessage("Event type is required.")
        .isIn(EVENT_TYPES).withMessage(`Event type must be one of: ${EVENT_TYPES.join(", ")}.`)
    : chain.optional()
        .isIn(EVENT_TYPES).withMessage(`Event type must be one of: ${EVENT_TYPES.join(", ")}.`);
};

const organizerChain = (required = true) => {
  const chain = body("organizer").trim();
  return required
    ? chain.notEmpty().withMessage("Organizer name is required.")
        .isLength({ max: 200 }).withMessage("Organizer name cannot exceed 200 characters.")
    : chain.optional()
        .isLength({ max: 200 }).withMessage("Organizer name cannot exceed 200 characters.");
};

const startDateChain = (required = true) => {
  const chain = body("startDate");
  return required
    ? chain.notEmpty().withMessage("Start date is required.")
        .isISO8601().withMessage("Start date must be a valid ISO 8601 date.")
        .toDate()
    : chain.optional()
        .isISO8601().withMessage("Start date must be a valid ISO 8601 date.")
        .toDate();
};

const endDateChain = (required = true) => {
  const chain = body("endDate");
  return required
    ? chain.notEmpty().withMessage("End date is required.")
        .isISO8601().withMessage("End date must be a valid ISO 8601 date.")
        .toDate()
    : chain.optional()
        .isISO8601().withMessage("End date must be a valid ISO 8601 date.")
        .toDate();
};

// ─── Shared cross-field rules (applied to both create and update) ─────────────

const crossFieldRules = [
  // End date must be after start date.
  body("endDate").optional().custom((endDate, { req }) => {
    const startDate = req.body.startDate;
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new Error("End date must be after start date.");
    }
    return true;
  }),

  // Registration deadline must be before start date.
  body("registrationDeadline")
    .optional({ nullable: true })
    .isISO8601().withMessage("Registration deadline must be a valid ISO 8601 date.")
    .toDate()
    .custom((deadline, { req }) => {
      const startDate = req.body.startDate;
      if (startDate && deadline && new Date(deadline) >= new Date(startDate)) {
        throw new Error("Registration deadline must be before the start date.");
      }
      return true;
    }),

  // Online link required for online and hybrid events.
  body("onlineLink").optional({ nullable: true }).trim()
    .custom((link, { req }) => {
      const type = req.body.eventType;
      if ((type === "online" || type === "hybrid") && !link) {
        throw new Error("Online link is required for online and hybrid events.");
      }
      if (link && !/^https?:\/\/.+/.test(link)) {
        throw new Error("Online link must be a valid URL starting with http:// or https://.");
      }
      return true;
    }),

  // Venue name required for in-person and hybrid events.
  body("venue.name").optional({ nullable: true }).trim()
    .custom((name, { req }) => {
      const type = req.body.eventType;
      if ((type === "in-person" || type === "hybrid") && !name) {
        throw new Error("Venue name is required for in-person and hybrid events.");
      }
      return true;
    }),

  body("venue.address")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage("Venue address cannot exceed 500 characters."),

  body("venue.mapLink")
    .optional({ nullable: true })
    .trim()
    .custom((link) => {
      if (link && !/^https?:\/\/.+/.test(link)) {
        throw new Error("Map link must be a valid URL starting with http:// or https://.");
      }
      return true;
    }),

  body("capacity")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("Capacity must be a positive integer.")
    .toInt(),

  body("registrationMode")
    .optional()
    .isIn(["individual", "team"])
    .withMessage("registrationMode must be 'individual' or 'team'."),

  body("audienceScope")
    .optional()
    .isIn(["campus", "inter_university"])
    .withMessage("audienceScope must be 'campus' or 'inter_university'."),

  body("minTeamSize")
    .optional({ nullable: true })
    .isInt({ min: 2, max: 5 }).withMessage("minTeamSize must be between 2 and 5.")
    .toInt(),

  body("maxTeamSize")
    .optional({ nullable: true })
    .isInt({ min: 2, max: 5 }).withMessage("maxTeamSize must be between 2 and 5.")
    .toInt(),

  body().custom((_, { req }) => {
    if (req.body.registrationMode !== "team") return true;
    const min = req.body.minTeamSize != null ? Number(req.body.minTeamSize) : 2;
    const max = req.body.maxTeamSize != null ? Number(req.body.maxTeamSize) : 4;
    if (min > max) {
      throw new Error("Minimum team size cannot exceed the member limit per team.");
    }
    return true;
  }),

  body("tags")
    .optional()
    .isArray({ max: 15 }).withMessage("Tags must be an array of up to 15 items.")
    .custom((arr) =>
      arr.every((t) => typeof t === "string" && t.trim().length > 0 && t.trim().length <= 50)
    )
    .withMessage("Each tag must be a non-empty string of up to 50 characters."),

  body("isFeatured")
    .optional()
    .isBoolean().withMessage("isFeatured must be a boolean.")
    .toBoolean(),

  // Validate the registrationQuestions array if provided.
  body("registrationQuestions")
    .optional()
    .isArray({ max: 20 }).withMessage("A maximum of 20 registration questions are allowed."),

  body("registrationQuestions.*.question")
    .notEmpty().withMessage("Each question must have a non-empty question text.")
    .isLength({ max: 500 }).withMessage("Question text cannot exceed 500 characters."),

  body("registrationQuestions.*.questionType")
    .notEmpty().withMessage("Each question must have a question type.")
    .isIn(QUESTION_TYPES)
    .withMessage(`Question type must be one of: ${QUESTION_TYPES.join(", ")}.`),

  body("registrationQuestions.*.isRequired")
    .optional()
    .isBoolean().withMessage("isRequired must be a boolean.")
    .toBoolean(),

  body("registrationQuestions.*.options")
    .optional()
    .isArray().withMessage("Options must be an array.")
    .custom((options, { req, path }) => {
      // Extract the question index from the path, e.g. "registrationQuestions[0].options"
      const match = path.match(/\[(\d+)\]/);
      if (!match) return true;
      const idx = parseInt(match[1], 10);
      const questionType = req.body.registrationQuestions?.[idx]?.questionType;
      if (
        (questionType === "multiple_choice" || questionType === "checkbox" || questionType === "dropdown") &&
        (!options || options.length < 2)
      ) {
        throw new Error(
          `Question ${idx + 1}: multiple_choice, checkbox, and dropdown types require at least 2 options.`
        );
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(STATUSES)
    .withMessage(`Status must be one of: ${STATUSES.join(", ")}.`),

  body("channel")
    .optional({ nullable: true })
    .isMongoId().withMessage("Channel must be a valid ID."),
];

// ─── Exported validators ──────────────────────────────────────────────────────

export const createEventValidator = [
  titleChain(true),
  descriptionChain(true),
  categoryChain(true),
  eventTypeChain(true),
  organizerChain(true),
  startDateChain(true),
  endDateChain(true),
  ...crossFieldRules,
];

export const updateEventValidator = [
  titleChain(false),
  descriptionChain(false),
  categoryChain(false),
  eventTypeChain(false),
  organizerChain(false),
  startDateChain(false),
  endDateChain(false),
  ...crossFieldRules,
];

export const eventIdValidator = [
  param("id").isMongoId().withMessage("Invalid event ID."),
];
