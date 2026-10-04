/**
 * Registration Model
 *
 * Records a student's registration for a specific event.
 *
 * Design decisions:
 *
 *  1. Student profile snapshot (studentSnapshot)
 *     The student's academic details are copied at the moment of registration.
 *     This makes each registration record self-contained and ensures that
 *     reports and exports remain accurate even if the student later updates
 *     their profile (e.g. changes their degree programme).
 *     The frontend never asks the student to re-enter this data — the server
 *     populates it automatically from req.user.
 *
 *  2. Event snapshot (eventSnapshot)
 *     The event title is copied at registration time so each record stays readable
 *     in MongoDB and exports even if the event is renamed or removed later.
 *
 *  3. Answer snapshots
 *     Each answer stores a copy of the question text alongside the answer value.
 *     This ensures the question is still readable in reports even if the admin
 *     later modifies or removes the question from the event.
 *
 *  4. Unique compound index on { student, event }
 *     Prevents duplicate registrations at the database level as a safety net.
 *     The service layer performs an explicit check before the insert to give
 *     a clearer error message than the generic duplicate-key 409.
 *
 *  5. registrationCount on Event is managed by the service layer using $inc
 *     for atomicity, not in this model's hooks.
 */

import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * Point-in-time snapshot of the student's academic profile.
 * Populated automatically by the service from req.user — never from client input.
 */
const studentSnapshotSchema = new mongoose.Schema(
  {
    fullName:       { type: String, required: true },
    email:          { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    studentType: {
      type: String,
      enum: ["nsbm", "external"],
      default: "nsbm",
    },
    university: { type: String, trim: true, default: "" },
    // NSBM students only — omitted for guest / external students.
    studentId: { type: String, trim: true, uppercase: true },
    degree:    { type: String, trim: true },
    batch:     { type: String, trim: true },
  },
  { _id: false }
);

/** Event details frozen at registration time (title for reports and MongoDB queries). */
const eventSnapshotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Event title snapshot cannot exceed 200 characters."],
    },
  },
  { _id: false }
);

/**
 * A single answer to one organiser-defined question.
 * questionId links back to the registrationQuestion sub-document on the Event.
 * The question text is snapshotted here for report stability.
 * answer is Mixed to accommodate all question types:
 *   text            → String
 *   yes_no          → "yes" | "no"
 *   multiple_choice → String (one option)
 *   checkbox        → [String] (one or more options)
 */
const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const teamMemberSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["leader", "member_1", "member_2", "member_3", "member_4"],
      required: true,
    },
    fullName:       { type: String, required: true, trim: true },
    phone:          { type: String, required: true, trim: true },
    personalEmail:  { type: String, required: true, trim: true, lowercase: true },
    nic:            { type: String, required: true, trim: true, uppercase: true },
    /** Set when member was linked via student ID lookup. */
    studentId:      { type: String, trim: true, uppercase: true, default: null },
    /** Set when member has a platform account (lookup or registrant). */
    user:           { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isRegistrant:   { type: Boolean, default: false },
    /** Unique check-in token for this member's QR pass. Omitted until assigned. */
    checkInToken:   { type: String },
    passEmailSentAt:{ type: Date, default: null },
    checkedInAt:    { type: Date, default: null },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, "Team name cannot exceed 120 characters."],
    },
    size: {
      type: Number,
      required: true,
      min: [2, "Team size must be at least 2."],
      max: [5, "Team size cannot exceed 5."],
    },
    university: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "University name cannot exceed 200 characters."],
    },
    registrantRole: {
      type: String,
      enum: ["leader", "member_1", "member_2", "member_3", "member_4"],
      required: true,
    },
    members: {
      type: [teamMemberSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 5,
        message: "A team must have between 2 and 5 members.",
      },
    },
  },
  { _id: false }
);

// ─── Main Registration Schema ─────────────────────────────────────────────────

const registrationSchema = new mongoose.Schema(
  {
    // ── Participants ──────────────────────────────────────────────────────────

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required."],
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event reference is required."],
    },

    // ── Profile Snapshot ──────────────────────────────────────────────────────

    // Immutable copy of the student's academic profile at registration time.
    // Never updated after creation.
    studentSnapshot: {
      type: studentSnapshotSchema,
      required: true,
    },

    eventSnapshot: {
      type: eventSnapshotSchema,
      required: true,
    },

    // ── Answers ───────────────────────────────────────────────────────────────

    // Responses to organiser-defined questions. Only the answers the student
    // provided are stored here. Required questions are enforced in the service.
    answers: {
      type: [answerSchema],
      default: [],
    },

    // Populated for team/hackathon registrations (registrationMode = "team" on the event).
    team: {
      type: teamSchema,
      default: null,
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    status: {
      type: String,
      enum: {
        values: ["confirmed", "cancelled", "waitlisted"],
        message: "Status must be one of: confirmed, cancelled, waitlisted.",
      },
      default: "confirmed",
    },

    // ── Cancellation metadata ─────────────────────────────────────────────────

    cancelledAt: {
      type: Date,
      default: null,
    },

    // Tracks whether a student or an admin performed the cancellation.
    cancelledBy: {
      type: String,
      enum: ["student", "admin"],
      default: null,
    },

    /** Individual registration check-in token (omit for team registrations). */
    checkInToken: {
      type: String,
    },
    passEmailSentAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt serves as the official registration timestamp.
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary uniqueness guarantee: one registration per student per event.
registrationSchema.index({ student: 1, event: 1 }, { unique: true });

// Admin query: "Show me all registrations for event X sorted by date."
registrationSchema.index({ event: 1, status: 1, createdAt: -1 });

// Student query: "Show me all my registrations."
registrationSchema.index({ student: 1, createdAt: -1 });

// Duplicate NIC / personal email checks per event (team registrations).
registrationSchema.index({ event: 1, "team.members.nic": 1 });
registrationSchema.index({ event: 1, "team.members.personalEmail": 1 });
registrationSchema.index({ event: 1, "team.members.user": 1 });
registrationSchema.index({ "team.members.user": 1, status: 1 });
// Partial unique indexes — only real token strings (never index null / missing).
registrationSchema.index(
  { checkInToken: 1 },
  {
    unique: true,
    partialFilterExpression: { checkInToken: { $type: "string" } },
  }
);
registrationSchema.index(
  { "team.members.checkInToken": 1 },
  {
    unique: true,
    partialFilterExpression: { "team.members.checkInToken": { $type: "string" } },
  }
);

// ─── Virtual fields ───────────────────────────────────────────────────────────

// Alias so the response says "registeredAt" which is more meaningful to consumers
// than the internal "createdAt" field name.
registrationSchema.virtual("registeredAt").get(function () {
  return this.createdAt;
});

// ─── Model export ─────────────────────────────────────────────────────────────

const Registration = mongoose.model("Registration", registrationSchema);

export default Registration;
