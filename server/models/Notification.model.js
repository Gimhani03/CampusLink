/**
 * Notification Model
 *
 * Stores in-app notifications delivered to students.
 *
 * Design decisions:
 *
 *  1. Type constants are exported from this file so every service that
 *     creates notifications imports the same strings — no magic literals.
 *
 *  2. data sub-document stores the context needed to render action links
 *     (View Event, View Registration) without extra DB lookups.
 *     eventTitle is snapshotted so the notification remains readable even
 *     if the event is later deleted.
 *     extra is a Mixed field for type-specific metadata
 *     (e.g. deadlineDate, updatedFields list).
 *
 *  3. TTL index on createdAt with expireAfterSeconds = 90 days.
 *     MongoDB automatically removes old notifications without a cron job.
 *
 *  4. Compound index on { recipient, isRead, createdAt } covers both
 *     the paginated notification list and the unread-count query.
 */

import mongoose from "mongoose";

// ─── Notification type constants ──────────────────────────────────────────────
// Exported so all services import the constant, never a raw string.

export const NOTIFICATION_TYPES = Object.freeze({
  REGISTRATION_CONFIRMED: "registration_confirmed",
  REGISTRATION_REJECTED:  "registration_rejected",
  REGISTRATION_CANCELLED: "registration_cancelled",
  DEADLINE_REMINDER:      "deadline_reminder",
  EVENT_UPDATED:          "event_updated",
  EVENT_CANCELLED:        "event_cancelled",
  NEW_CHANNEL_EVENT:      "new_channel_event",
  EVENT_STARTS_SOON:      "event_starts_soon",
  ADMIN_ANNOUNCEMENT:     "admin_announcement",
});

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

// ─── Data sub-schema ──────────────────────────────────────────────────────────

const notificationDataSchema = new mongoose.Schema(
  {
    // Primary entity refs — used to build "View Event" / "View Registration" links.
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },
    // Snapshot of the event title — survives event deletion.
    eventTitle: {
      type: String,
      default: null,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      default: null,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null,
    },
    channelName: {
      type: String,
      default: null,
    },
    // Type-specific metadata: deadline date, updated field names, etc.
    // Kept as Mixed to avoid rigidly coupling the schema to each notification type.
    extra: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

// ─── Main Notification Schema ─────────────────────────────────────────────────

const notificationSchema = new mongoose.Schema(
  {
    // The student who should see this notification.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification recipient is required."],
    },

    type: {
      type: String,
      required: [true, "Notification type is required."],
      enum: {
        values: NOTIFICATION_TYPE_VALUES,
        message: `Notification type must be one of: ${NOTIFICATION_TYPE_VALUES.join(", ")}.`,
      },
    },

    // Short title rendered in the notification bell dropdown.
    title: {
      type: String,
      required: [true, "Notification title is required."],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters."],
    },

    // Full message body rendered in the notification detail view.
    body: {
      type: String,
      required: [true, "Notification body is required."],
      trim: true,
      maxlength: [500, "Body cannot exceed 500 characters."],
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // Context payload for rendering action links on the frontend.
    data: {
      type: notificationDataSchema,
      default: () => ({}),
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

// Primary query: "Show all notifications for this student, newest first."
// Also covers the unread count query ({ recipient, isRead: false }).
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// TTL: MongoDB auto-deletes documents 90 days after creation.
// No cron job needed.
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// ─── Model export ─────────────────────────────────────────────────────────────

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
