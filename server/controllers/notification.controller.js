/**
 * Notification Controller
 *
 * Thin HTTP adapter. Responsibilities:
 *   - Extract validated inputs from req.
 *   - Delegate to the notification service.
 *   - Serialise the service response into the standard API envelope.
 *
 * SSE handler (streamNotifications) lives here because it needs direct
 * control over the response lifecycle (headers, heartbeat, cleanup).
 */

import * as notificationService from "../services/notification.service.js";
import * as sseManager from "../utils/sseManager.js";
import catchAsync    from "../utils/catchAsync.js";
import ApiResponse   from "../utils/ApiResponse.js";

// ─── REST handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/notifications
 *
 * Returns a paginated list of the authenticated student's notifications.
 * Query params: page, limit, isRead (optional, "true"/"false")
 */
export const getNotifications = catchAsync(async (req, res) => {
  const result = await notificationService.getNotifications(
    req.user._id.toString(),
    req.query
  );
  res.status(200).json(new ApiResponse(200, result, "Notifications fetched."));
});

/**
 * GET /api/v1/notifications/unread-count
 *
 * Returns just the unread notification count.
 * Polled on app load; SSE keeps it fresh during the session.
 */
export const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(
    req.user._id.toString()
  );
  res.status(200).json(new ApiResponse(200, { count }, "Unread count fetched."));
});

/**
 * PATCH /api/v1/notifications/:id/read
 *
 * Marks a single notification as read.
 */
export const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.params.id,
    req.user._id.toString()
  );
  res.status(200).json(new ApiResponse(200, { notification }, "Notification marked as read."));
});

/**
 * PATCH /api/v1/notifications/read-all
 *
 * Marks all of the authenticated student's unread notifications as read.
 */
export const markAllRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllRead(
    req.user._id.toString()
  );
  res.status(200).json(
    new ApiResponse(200, { modifiedCount: result.modifiedCount },
      `${result.modifiedCount} notification(s) marked as read.`)
  );
});

/**
 * DELETE /api/v1/notifications/:id
 *
 * Deletes a single notification (student can only delete their own).
 */
export const deleteNotification = catchAsync(async (req, res) => {
  await notificationService.deleteNotification(
    req.params.id,
    req.user._id.toString()
  );
  res.status(200).json(new ApiResponse(200, null, "Notification deleted."));
});

// ─── Admin handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/notifications/admin/announce
 *
 * Sends an admin announcement to a target audience.
 *
 * Body: { title, body, targetType: "all"|"event_registrants", eventId? }
 */
export const sendAnnouncement = catchAsync(async (req, res) => {
  const { title, body, targetType, eventId } = req.body;

  const result = await notificationService.sendAdminAnnouncement({
    title,
    body,
    targetType,
    eventId,
  });

  res.status(201).json(
    new ApiResponse(201, { sent: result.sent }, `Announcement sent to ${result.sent} recipient(s).`)
  );
});

/**
 * POST /api/v1/notifications/admin/trigger/:type/:eventId
 *
 * Admin-initiated trigger for cron-based notification types
 * (deadline_reminder, event_starts_soon).
 *
 * These are normally triggered automatically by a scheduled job;
 * this endpoint allows manual dispatch from the admin panel.
 */
export const triggerEventNotification = catchAsync(async (req, res) => {
  const { type, eventId } = req.params;

  const Event = (await import("../models/Event.model.js")).default;
  const event = await Event.findById(eventId).lean();

  if (!event) {
    return res.status(404).json({ success: false, message: "Event not found." });
  }

  if (type === "deadline_reminder") {
    const result = await notificationService.notifyDeadlineReminder(event);
    return res.status(200).json(
      new ApiResponse(200, { sent: result.sent }, `"${type}" notification sent to ${result.sent} student(s) for "${event.title}".`)
    );
  } else if (type === "event_starts_soon") {
    const result = await notificationService.notifyEventStartsSoon(event);
    return res.status(200).json(
      new ApiResponse(200, { sent: result.sent }, `"${type}" notification sent to ${result.sent} student(s) for "${event.title}".`)
    );
  } else {
    return res.status(400).json({ success: false, message: `Unknown trigger type: ${type}.` });
  }

  res.status(200).json(
    new ApiResponse(200, null, `"${type}" notification triggered for event "${event.title}".`)
  );
});

/**
 * GET /api/v1/notifications/admin/sse-stats
 *
 * Returns live SSE connection statistics.
 * Useful for debugging real-time delivery in production.
 */
export const getSseStats = catchAsync(async (_req, res) => {
  res.status(200).json(
    new ApiResponse(200, {
      totalConnections: sseManager.totalConnections(),
      connectedUsers:   sseManager.connectedUsers(),
    }, "SSE stats fetched.")
  );
});

// ─── SSE handler ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/notifications/stream
 *
 * Opens an SSE (Server-Sent Events) stream for the authenticated student.
 * The client uses the native EventSource API to establish this connection.
 *
 * Events emitted by the server:
 *   connected       — sent once on connection with initial unread count.
 *   notification    — sent when a new notification is created for this user.
 *   unread_count    — sent after mark-as-read or mark-all-read operations.
 *   heartbeat       — sent every 25 seconds to prevent proxy/LB from closing idle connections.
 *
 * Client-side usage:
 *   const es = new EventSource('/api/v1/notifications/stream', { withCredentials: true });
 *   es.addEventListener('notification', (e) => { const n = JSON.parse(e.data); ... });
 *   es.addEventListener('unread_count', (e) => { const { count } = JSON.parse(e.data); ... });
 */
export const streamNotifications = catchAsync(async (req, res) => {
  // ── SSE headers ────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Tell nginx / reverse proxies not to buffer the stream.
  res.setHeader("X-Accel-Buffering", "no");
  // Explicitly allow the client to read this header cross-origin.
  res.setHeader("Access-Control-Expose-Headers", "Content-Type");
  res.flushHeaders();

  const userId = req.user._id.toString();

  // Register this connection in the SSE manager.
  sseManager.addClient(userId, res);

  // ── Initial payload ────────────────────────────────────────────────────────
  // Send connection confirmation + current unread count immediately so the
  // client's notification badge is accurate from the first frame.
  const unreadCount = await notificationService.getUnreadCount(userId);

  res.write(
    `event: connected\ndata: ${JSON.stringify({
      message: "Connected to notification stream.",
      unreadCount,
    })}\n\n`
  );

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  // Prevents idle connection timeout on proxies (nginx default = 60s).
  // The client-side EventSource auto-reconnects on close, but a heartbeat is
  // cheaper than a reconnect handshake.
  const heartbeatInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeatInterval);
      return;
    }
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 25_000);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  req.on("close", () => {
    clearInterval(heartbeatInterval);
    sseManager.removeClient(userId, res);
  });
});
