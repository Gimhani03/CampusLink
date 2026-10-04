/**
 * Channel Model
 *
 * A Channel represents a department, faculty, club, or student society
 * that organises and publishes events. Students can follow channels to
 * receive notifications whenever a new event is published.
 *
 * Key design decisions:
 *   - followerCount is stored as a denormalised field and kept in sync via
 *     atomic $inc/$dec in the service layer, avoiding expensive COUNT queries.
 *   - followedChannels on the User model stores the set of followed channel IDs
 *     so membership checks are O(1) and do not require a join.
 *   - avatar / coverImage are optional; the frontend falls back to a DiceBear
 *     avatar generated from the channel slug.
 */

import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────

    name: {
      type: String,
      required: [true, "Channel name is required."],
      trim: true,
      unique: true,
      maxlength: [100, "Channel name cannot exceed 100 characters."],
    },

    // URL-friendly identifier derived from name on creation.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters."],
      default: "",
    },

    // ── Branding ───────────────────────────────────────────────────────────────

    avatar: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    coverImage: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // ── Classification ─────────────────────────────────────────────────────────

    category: {
      type: String,
      enum: {
        values: ["academic", "cultural", "sports", "technology", "career", "social", "religious", "competition", "other"],
        message: "Invalid channel category.",
      },
      required: [true, "Channel category is required."],
    },

    // Short label for the organising body (e.g. "Faculty of Engineering").
    organizer: {
      type: String,
      trim: true,
      maxlength: [200, "Organizer cannot exceed 200 characters."],
      default: "",
    },

    // ── Stats (denormalised) ───────────────────────────────────────────────────

    // Kept in sync via atomic $inc. Never read-modify-write.
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    eventCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Metadata ───────────────────────────────────────────────────────────────

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Channel creator is required."],
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
// Note: slug already has a unique index from `unique: true` in the schema field
// definition, so no separate channelSchema.index({ slug: 1 }) is needed here.

channelSchema.index({ category: 1, isActive: 1 });
channelSchema.index({ followerCount: -1 });
channelSchema.index({ name: "text", description: "text", organizer: "text" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-generate a URL-safe slug from the name if not already set.
 */
channelSchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

const Channel = mongoose.model("Channel", channelSchema);
export default Channel;
