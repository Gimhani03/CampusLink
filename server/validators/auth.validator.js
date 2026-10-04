/**
 * Auth input validators.
 *
 * Uses express-validator chains to describe what valid input looks like.
 * Each exported array is passed directly to a route as middleware.
 * The `validate` middleware (middleware/validate.js) runs after these
 * chains and converts any failures into a structured ApiError.
 *
 * Keeping validation rules here — separate from the controller — means
 * the controller never needs to inspect req for malformed input.
 */

import { body } from "express-validator";
import { isNsbmStudentEmail, NSBM_STUDENT_EMAIL_SUFFIX } from "../constants/nsbm.js";
import { isAllowedExternalUniversity } from "../constants/universities.js";

// ─── Register (Student only) ──────────────────────────────────────────────────

export const registerValidator = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required.")
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters."),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Please provide a valid email address.")
    .normalizeEmail({ gmail_remove_dots: false })
    .custom((value) => {
      if (!isNsbmStudentEmail(value)) {
        throw new Error(`Registration requires an NSBM student email (${NSBM_STUDENT_EMAIL_SUFFIX}).`);
      }
      return true;
    }),

  body("studentId")
    .trim()
    .notEmpty().withMessage("Student ID is required.")
    .matches(/^[A-Za-z0-9\/\-]+$/)
    .withMessage("Student ID can only contain letters, numbers, hyphens, and slashes.")
    .isLength({ max: 20 }).withMessage("Student ID cannot exceed 20 characters."),

  body("degree")
    .trim()
    .notEmpty().withMessage("Degree programme is required.")
    .isLength({ max: 150 }).withMessage("Degree name cannot exceed 150 characters."),

  body("batch")
    .trim()
    .notEmpty().withMessage("Batch / intake year is required.")
    .matches(/^\d{4}(\/\d{4})?$/)
    .withMessage("Batch must be a year (e.g. 2021) or academic year (e.g. 2021/2022)."),

  body("whatsappNumber")
    .trim()
    .notEmpty().withMessage("WhatsApp number is required.")
    .matches(/^\+[1-9]\d{7,14}$/)
    .withMessage("WhatsApp number must be in international format, e.g. +94771234567."),

  body("password")
    .notEmpty().withMessage("Password is required.")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter.")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter.")
    .matches(/\d/).withMessage("Password must contain at least one number.")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage("Password must contain at least one special character."),

  body("confirmPassword")
    .notEmpty().withMessage("Please confirm your password.")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }
      return true;
    }),

  body("interests")
    .optional()
    .isArray({ max: 20 }).withMessage("Interests must be an array of up to 20 items.")
    .custom((arr) => arr.every((item) => typeof item === "string" && item.trim().length > 0))
    .withMessage("Each interest must be a non-empty string."),
];

// ─── Register (External / guest — inter-university hackathons) ───────────────

export const registerGuestValidator = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required.")
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters."),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Please provide a valid email address.")
    .normalizeEmail({ gmail_remove_dots: false })
    .custom((value) => {
      if (isNsbmStudentEmail(value)) {
        throw new Error(
          `NSBM students must use the main signup with a ${NSBM_STUDENT_EMAIL_SUFFIX} email.`
        );
      }
      return true;
    }),

  body("university")
    .trim()
    .notEmpty().withMessage("University is required.")
    .custom((value) => {
      if (!isAllowedExternalUniversity(value)) {
        throw new Error("Select your university. NSBM students must use the main signup page.");
      }
      return true;
    }),

  body("whatsappNumber")
    .trim()
    .notEmpty().withMessage("WhatsApp number is required.")
    .matches(/^\+[1-9]\d{7,14}$/)
    .withMessage("WhatsApp number must be in international format, e.g. +94771234567."),

  body("password")
    .notEmpty().withMessage("Password is required.")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter.")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter.")
    .matches(/\d/).withMessage("Password must contain at least one number.")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage("Password must contain at least one special character."),

  body("confirmPassword")
    .notEmpty().withMessage("Please confirm your password.")
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error("Passwords do not match.");
      return true;
    }),
];

// ─── Update Profile ───────────────────────────────────────────────────────────

export const updateProfileValidator = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters."),

  body("degree")
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage("Degree name cannot exceed 150 characters."),

  body("batch")
    .optional()
    .trim()
    .matches(/^\d{4}(\/\d{4})?$/)
    .withMessage("Batch must be a year (e.g. 2021) or academic year (e.g. 2021/2022)."),

  body("whatsappNumber")
    .optional()
    .trim()
    .matches(/^\+[1-9]\d{7,14}$/)
    .withMessage("WhatsApp number must be in international format, e.g. +94771234567."),

  body("interests")
    .optional()
    .isArray({ max: 20 }).withMessage("Interests must be an array of up to 20 items.")
    .custom((arr) => arr.every((item) => typeof item === "string" && item.trim().length > 0))
    .withMessage("Each interest must be a non-empty string."),
];

// ─── Change Password ──────────────────────────────────────────────────────────

export const changePasswordValidator = [
  body("currentPassword")
    .notEmpty().withMessage("Current password is required."),

  body("newPassword")
    .notEmpty().withMessage("New password is required.")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter.")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter.")
    .matches(/\d/).withMessage("Password must contain at least one number.")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage("Password must contain at least one special character."),

  body("confirmNewPassword")
    .notEmpty().withMessage("Please confirm your new password.")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) throw new Error("Passwords do not match.");
      return true;
    }),
];

// ─── Login (Student & Admin) ──────────────────────────────────────────────────

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Please provide a valid email address.")
    .normalizeEmail({ gmail_remove_dots: false }),

  body("password")
    .notEmpty().withMessage("Password is required."),
];
