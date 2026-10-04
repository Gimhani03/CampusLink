/**
 * Event Model
 *
 * Represents a university event. Designed to support both
 * in-person and online/hybrid formats with flexible registration
 * question configuration per event.
 *
 * Design decisions:
 *  - Sub-schemas for coverImage, venue, and registrationQuestions
 *    keep related fields grouped and independently validatable.
 *  - registrationQuestions retains _id so individual questions can
 *    be targeted by ID in future PATCH endpoints.
 *  - A compound text index on title + description + tags + organizer
 *    powers full-text search without an external search engine.
 *  - registrationCount is a stored counter (not a virtual) so the
 *    event list query doesn't need to JOIN the registrations collection
 *    on every request. The Registration service increments/decrements it.
 *  - status defaults to "draft" — admins must explicitly publish events,
 *    preventing accidental exposure of incomplete events.
 */

import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const coverImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [200, "Venue name cannot exceed 200 characters."],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters."],
    },
    mapLink: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Each registration question is its own document within the event array.
// _id is retained (default true) so individual questions can be identified.
const registrationQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, "Question text is required."],
    trim: true,
    maxlength: [500, "Question text cannot exceed 500 characters."],
  },
  // Determines how the answer is collected on the frontend.
  questionType: {
    type: String,
    required: [true, "Question type is required."],
    enum: {
      values: ["text", "multiple_choice", "checkbox", "yes_no", "dropdown"],
      message: "Question type must be one of: text, multiple_choice, checkbox, yes_no, dropdown.",
    },
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  // Options are only meaningful for multiple_choice and checkbox types.
  // Enforced at the application layer (validator), not the schema layer,
  // to provide clearer error messages.
  options: {
    type: [String],
    default: [],
  },
});

// ─── Main Event Schema ────────────────────────────────────────────────────────

const eventSchema = new mongoose.Schema(
  {
    // ── Core Content ──────────────────────────────────────────────────────────

    title: {
      type: String,
      required: [true, "Event title is required."],
      trim: true,
      minlength: [5, "Title must be at least 5 characters."],
      maxlength: [200, "Title cannot exceed 200 characters."],
    },

    description: {
      type: String,
      required: [true, "Event description is required."],
      trim: true,
      minlength: [20, "Description must be at least 20 characters."],
      maxlength: [5000, "Description cannot exceed 5000 characters."],
    },

    coverImage: {
      type: coverImageSchema,
      default: () => ({ url: "", publicId: "" }),
    },

    // ── Classification ────────────────────────────────────────────────────────

    category: {
      type: String,
      required: [true, "Event category is required."],
      enum: {
        values: [
          "academic",
          "cultural",
          "sports",
          "technology",
          "career",
          "social",
          "religious",
          "competition",
          "other",
        ],
        message:
          "Category must be one of: academic, cultural, sports, technology, career, social, religious, competition, other.",
      },
    },

    // Free-form tags for fine-grained filtering and discovery.
    // Stored lowercase for consistent comparison (enforced via set).
    tags: {
      type: [String],
      default: [],
      set: (arr) => arr.map((t) => t.toLowerCase().trim()).filter(Boolean),
      validate: {
        validator: (arr) => arr.length <= 15,
        message: "An event can have a maximum of 15 tags.",
      },
    },

    // ── Organisation ──────────────────────────────────────────────────────────

    // The department, faculty, or club organising the event.
    organizer: {
      type: String,
      required: [true, "Organizer name is required."],
      trim: true,
      maxlength: [200, "Organizer name cannot exceed 200 characters."],
    },

    // Optional link to the Channel this event belongs to.
    // Will be populated once the Channel module is built.
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null,
    },

    // ── Location ──────────────────────────────────────────────────────────────

    eventType: {
      type: String,
      required: [true, "Event type is required."],
      enum: {
        values: ["in-person", "online", "hybrid"],
        message: "Event type must be one of: in-person, online, hybrid.",
      },
    },

    // Populated for in-person and hybrid events.
    venue: {
      type: venueSchema,
      default: null,
    },

    // Populated for online and hybrid events.
    onlineLink: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Scheduling ────────────────────────────────────────────────────────────

    startDate: {
      type: Date,
      required: [true, "Start date is required."],
    },

    endDate: {
      type: Date,
      required: [true, "End date is required."],
    },

    registrationDeadline: {
      type: Date,
      default: null,
    },

    // ── Capacity & Registration ───────────────────────────────────────────────

    // null means unlimited capacity.
    capacity: {
      type: Number,
      default: null,
      min: [1, "Capacity must be at least 1."],
    },

    // Incremented by the Registration service on each successful registration.
    // Decremented on cancellation. Avoids a COUNT query on every event read.
    registrationCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // individual = one student per registration (default).
    // team       = hackathon-style; capacity counts teams, not people.
    registrationMode: {
      type: String,
      enum: {
        values: ["individual", "team"],
        message: "Registration mode must be 'individual' or 'team'.",
      },
      default: "individual",
    },

    // campus = NSBM students only (default).
    // inter_university = visible to guest / external-university students too.
    audienceScope: {
      type: String,
      enum: {
        values: ["campus", "inter_university"],
        message: "Audience scope must be 'campus' or 'inter_university'.",
      },
      default: "campus",
    },

    // Team mode only — min/max members per team (platform bounds: 2–5).
    minTeamSize: {
      type: Number,
      default: null,
      min: [2, "Minimum team size must be at least 2."],
      max: [5, "Minimum team size cannot exceed 5."],
    },

    maxTeamSize: {
      type: Number,
      default: null,
      min: [2, "Maximum team size must be at least 2."],
      max: [5, "Maximum team size cannot exceed 5."],
    },

    // Admin-configured questions shown on the event registration form.
    registrationQuestions: {
      type: [registrationQuestionSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: "An event can have a maximum of 20 registration questions.",
      },
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    status: {
      type: String,
      enum: {
        values: ["draft", "published", "cancelled", "completed"],
        message: "Status must be one of: draft, published, cancelled, completed.",
      },
      default: "draft",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    // ── Authorship ────────────────────────────────────────────────────────────

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Event creator is required."],
    },
  },
  {
    timestamps: true,
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

// Full-text search across the most descriptive fields.
eventSchema.index(
  { title: "text", description: "text", tags: "text", organizer: "text" },
  { weights: { title: 10, tags: 5, organizer: 3, description: 1 }, name: "event_text_search" }
);

// Compound index for the most common list queries:
// "Show me published technology events sorted by startDate."
eventSchema.index({ status: 1, category: 1, startDate: 1 });

// Index for tag-based filtering.
eventSchema.index({ tags: 1 });

// Index for channel-based event feeds.
eventSchema.index({ channel: 1, status: 1 });

// Index for admin "events I created" view.
eventSchema.index({ createdBy: 1, status: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

// Whether registration is still open (deadline has not passed).
eventSchema.virtual("isRegistrationOpen").get(function () {
  if (!this.registrationDeadline) return this.status === "published";
  return this.status === "published" && new Date() <= this.registrationDeadline;
});

// Whether the event is at full capacity.
eventSchema.virtual("isFull").get(function () {
  if (this.capacity === null) return false;
  return this.registrationCount >= this.capacity;
});

// Number of spots remaining (null = unlimited).
eventSchema.virtual("spotsRemaining").get(function () {
  if (this.capacity === null) return null;
  return Math.max(0, this.capacity - this.registrationCount);
});

// ─── Pre-save validation ──────────────────────────────────────────────────────

eventSchema.pre("save", function (next) {
  if (this.endDate < this.startDate) {
    return next(new Error("End date must be after start date."));
  }

  if (this.registrationDeadline && this.registrationDeadline >= this.startDate) {
    return next(new Error("Registration deadline must be before the start date."));
  }

  next();
});

// ─── Model export ─────────────────────────────────────────────────────────────

const Event = mongoose.model("Event", eventSchema);

export default Event;
