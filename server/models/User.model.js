/**
 * User Model
 *
 * Central identity document for the platform. Supports two roles:
 * "student" (self-registered) and "admin" (manually provisioned).
 *
 * Design principles applied here:
 *  - Passwords are never stored in plain text; bcrypt hashing is
 *    triggered automatically via a pre-save hook.
 *  - Sensitive fields (password, refreshToken) are excluded from
 *    all query results by default using `select: false`.
 *  - Instance methods encapsulate password comparison and token
 *    generation so that business logic never leaks into controllers.
 *  - Indexes are declared at the schema level so Mongoose synchronises
 *    them with MongoDB on startup (compound indexes use index() calls
 *    at the bottom for readability).
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { NSBM_UNIVERSITY } from "../constants/universities.js";

// ─── Sub-schema: Profile Picture ─────────────────────────────────────────────
// Stored as a sub-document so both the URL and the Cloudinary public_id
// travel together. The public_id is required to delete the old image from
// Cloudinary when the user uploads a new one.

const profilePictureSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      default: "",
    },
    publicId: {
      type: String,
      default: "",
    },
  },
  { _id: false } // No separate _id for embedded sub-documents.
);

// ─── Main User Schema ─────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────

    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters."],
      maxlength: [100, "Full name cannot exceed 100 characters."],
    },

    // University-issued email (NSBM) or personal email (guest / external students).
    email: {
      type: String,
      required: [true, "University email is required."],
      unique: true,
      lowercase: true, // Normalise to lowercase before saving.
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address.",
      ],
      maxlength: [254, "Email address cannot exceed 254 characters."], // RFC 5321 limit.
    },

    // NSBM students have a university student ID; external students do not.
    studentId: {
      type: String,
      required: function () {
        return this.studentType !== "external";
      },
      trim: true,
      uppercase: true,
      match: [
        /^[A-Za-z0-9\/\-]+$/,
        "Student ID can only contain letters, numbers, hyphens, and slashes.",
      ],
      maxlength: [20, "Student ID cannot exceed 20 characters."],
    },

    studentType: {
      type: String,
      enum: {
        values: ["nsbm", "external"],
        message: "studentType must be 'nsbm' or 'external'.",
      },
      default: "nsbm",
    },

    university: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "University name cannot exceed 200 characters."],
    },

    // ── Academic Details ──────────────────────────────────────────────────────

    degree: {
      type: String,
      required: function () {
        return this.studentType !== "external";
      },
      trim: true,
      maxlength: [150, "Degree name cannot exceed 150 characters."],
      default: "",
    },

    batch: {
      type: String,
      required: function () {
        return this.studentType !== "external";
      },
      trim: true,
      match: [
        /^\d{4}(\/\d{4})?$|^$/,
        "Batch must be a year (e.g. 2021) or academic year (e.g. 2021/2022).",
      ],
      default: "",
    },

    // ── Contact ───────────────────────────────────────────────────────────────

    // WhatsApp number stored in E.164 international format (+94771234567).
    // Storing as a string preserves leading zeros and the + prefix.
    whatsappNumber: {
      type: String,
      required: [true, "WhatsApp number is required."],
      trim: true,
      match: [
        /^\+[1-9]\d{7,14}$/,
        "WhatsApp number must be in international format, e.g. +94771234567.",
      ],
    },

    // ── Personalisation ───────────────────────────────────────────────────────

    // User-selected interest tags that drive the event recommendation engine.
    // Stored as lowercase, trimmed strings for consistent comparison.
    // The application layer (validator + service) controls the allowed values.
    interests: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: "You can select a maximum of 20 interests.",
      },
      set: (arr) => arr.map((tag) => tag.toLowerCase().trim()),
    },

    // Channels the student is following. Stored here for O(1) membership checks
    // without a join. The Channel's followerCount is kept in sync by the service.
    followedChannels: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }],
      default: [],
    },

    // Events the student has bookmarked / saved for later.
    // Toggle via POST /api/v1/auth/me/saved/:eventId.
    savedEvents: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
      default: [],
    },

    // ── Authentication ────────────────────────────────────────────────────────

    // bcrypt hash of the user's password. `select: false` ensures this field
    // is NEVER returned in any query result unless explicitly requested with
    // .select("+password"). The pre-save hook handles hashing.
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: ["student", "admin"],
        message: "Role must be either 'student' or 'admin'.",
      },
      default: "student",
    },

    // ── Email Verification ────────────────────────────────────────────────────

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Short-lived token sent in the verification email.
    // Cleared once the user clicks the link and is verified.
    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationTokenExpiresAt: {
      type: Date,
      select: false,
    },

    // ── Password Reset ────────────────────────────────────────────────────────

    // Hashed token stored so raw token is never persisted.
    // Generated by the auth service, sent to the user's email.
    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetTokenExpiresAt: {
      type: Date,
      select: false,
    },

    // ── Refresh Token ─────────────────────────────────────────────────────────

    // Stores the CURRENT active refresh token for this session.
    // On token rotation (each silent refresh), the old value is replaced.
    // On logout, this is set to null to invalidate the session server-side.
    // `select: false` prevents it from leaking into API responses.
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    // ── Profile Picture ───────────────────────────────────────────────────────

    profilePicture: {
      type: profilePictureSchema,
      default: () => ({ url: "", publicId: "" }),
    },

    // ── Account State ─────────────────────────────────────────────────────────

    // Admins can suspend an account without deleting it.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Automatically manages createdAt and updatedAt fields.
    timestamps: true,

    // When converting to JSON (e.g. res.json()), run the transform below.
    toJSON: {
      transform(_doc, ret) {
        // Remove all internal / sensitive fields from serialised output.
        delete ret.__v;
        delete ret.password;
        delete ret.refreshToken;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationTokenExpiresAt;
        delete ret.passwordResetToken;
        delete ret.passwordResetTokenExpiresAt;
        return ret;
      },
    },

    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Compound index to speed up event discovery filtered by degree and batch —
// used when recommending events relevant to a student's cohort.
userSchema.index({ degree: 1, batch: 1 });

// Index for interest-based event recommendations.
userSchema.index({ interests: 1 });

// Unique student IDs for NSBM students only — guest accounts omit this field entirely.
userSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      studentType: "nsbm",
      studentId: { $exists: true, $type: "string", $gt: "" },
    },
  }
);

// ─── Virtual fields ───────────────────────────────────────────────────────────

// Convenience accessor used in profile display and email templates.
userSchema.virtual("hasProfilePicture").get(function () {
  return Boolean(this.profilePicture?.url);
});

// Guest accounts never store university-issued fields.
userSchema.pre("validate", function (next) {
  if (this.studentType === "external") {
    this.studentId = undefined;
    this.degree = undefined;
    this.batch = undefined;
  }
  next();
});

// ─── Pre-save hook: password hashing ─────────────────────────────────────────

// Only re-hash if the password field was modified.
// This prevents double-hashing when unrelated fields (e.g. degree) are updated.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Cost factor of 12 provides strong security while keeping login latency
  // acceptable (~300 ms on modern hardware). Increase to 13-14 in the future
  // as hardware improves.
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance methods ─────────────────────────────────────────────────────────

/**
 * Compares a plain-text candidate password against the stored bcrypt hash.
 * Must be called on a document fetched with .select("+password").
 *
 * @param {string} candidatePassword  The plain-text password from the login form.
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generates a short-lived JWT access token.
 * Payload is intentionally minimal — only what the server needs to
 * identify the user and authorise the request without a DB lookup.
 *
 * @returns {string}  Signed JWT access token.
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      role: this.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

/**
 * Generates a long-lived JWT refresh token.
 * Contains only the user's _id — the minimum needed to issue a new
 * access token. The full user document is fetched from the DB during
 * the refresh flow to catch account suspension or role changes.
 *
 * @returns {string}  Signed JWT refresh token.
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
};

// ─── Model export ─────────────────────────────────────────────────────────────

const User = mongoose.model("User", userSchema);

export default User;
