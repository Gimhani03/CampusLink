/**
 * Notification Routes
 *
 * Route ordering rules:
 *   Static paths (/stream, /unread-count, /read-all, /admin/*) MUST be
 *   declared before dynamic paths (/:id) so Express does not interpret
 *   them as ObjectId parameters.
 *
 * Endpoint map:
 *
 *   Student endpoints (authenticate + authorize("student")):
 *     GET    /                       — paginated notification list
 *     GET    /unread-count           — unread badge count
 *     GET    /stream                 — SSE stream
 *     PATCH  /read-all               — mark all as read
 *     PATCH  /:id/read               — mark single as read
 *     DELETE /:id                    — delete single notification
 *
 *   Admin endpoints (authenticate + authorize("admin")):
 *     POST   /admin/announce         — broadcast announcement
 *     POST   /admin/trigger/:type/:eventId — manually trigger cron notifications
 *     GET    /admin/sse-stats        — live connection statistics
 */

import { Router } from "express";
import { body, param } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import {
  getNotifications,
  getUnreadCount,
  streamNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  sendAnnouncement,
  triggerEventNotification,
  getSseStats,
} from "../controllers/notification.controller.js";

const router = Router();

// ─── Apply authentication to ALL notification routes ──────────────────────────
router.use(authenticate);

// ─── Student routes ───────────────────────────────────────────────────────────

router.get(
  "/",
  authorize("student"),
  getNotifications
);

router.get(
  "/unread-count",
  authorize("student"),
  getUnreadCount
);

// SSE stream — must come before /:id to avoid Express treating "stream" as an ObjectId.
router.get(
  "/stream",
  authorize("student"),
  streamNotifications
);

router.patch(
  "/read-all",
  authorize("student"),
  markAllRead
);

router.patch(
  "/:id/read",
  authorize("student"),
  [
    param("id")
      .isMongoId()
      .withMessage("Notification ID must be a valid MongoDB ObjectId."),
  ],
  validate,
  markAsRead
);

router.delete(
  "/:id",
  authorize("student"),
  [
    param("id")
      .isMongoId()
      .withMessage("Notification ID must be a valid MongoDB ObjectId."),
  ],
  validate,
  deleteNotification
);

// ─── Admin routes ─────────────────────────────────────────────────────────────

router.post(
  "/admin/announce",
  authorize("admin"),
  [
    body("title")
      .trim()
      .notEmpty().withMessage("Announcement title is required.")
      .isLength({ max: 150 }).withMessage("Title cannot exceed 150 characters."),

    body("body")
      .trim()
      .notEmpty().withMessage("Announcement body is required.")
      .isLength({ max: 500 }).withMessage("Body cannot exceed 500 characters."),

    body("targetType")
      .isIn(["all", "event_registrants"])
      .withMessage("targetType must be 'all' or 'event_registrants'."),

    body("eventId")
      .if(body("targetType").equals("event_registrants"))
      .notEmpty().withMessage("eventId is required when targetType is 'event_registrants'.")
      .isMongoId().withMessage("eventId must be a valid MongoDB ObjectId."),
  ],
  validate,
  sendAnnouncement
);

router.post(
  "/admin/trigger/:type/:eventId",
  authorize("admin"),
  [
    param("type")
      .isIn(["deadline_reminder", "event_starts_soon"])
      .withMessage("type must be 'deadline_reminder' or 'event_starts_soon'."),

    param("eventId")
      .isMongoId()
      .withMessage("eventId must be a valid MongoDB ObjectId."),
  ],
  validate,
  triggerEventNotification
);

router.get(
  "/admin/sse-stats",
  authorize("admin"),
  getSseStats
);

export default router;
