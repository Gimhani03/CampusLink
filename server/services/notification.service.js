/**
 * Notification Service
 *
 * Two responsibilities:
 *
 *   1. CRUD operations — create, list, mark as read, delete.
 *   2. Typed dispatchers — one function per notification type.
 *      Each dispatcher constructs the correct title/body/data and
 *      calls create() or createBatch() as appropriate.
 *
 * All dispatchers are fire-and-forget safe:
 *   The caller (registration service, event service) calls them without
 *   awaiting, attaching a .catch() to swallow errors so a notification
 *   failure never breaks the primary operation.
 *
 *   Example from registration.service.js:
 *     notifyRegistrationConfirmed(student, event, reg._id).catch(() => {});
 *
 * Real-time delivery:
 *   After every DB write, pushToUser() delivers the notification immediately
 *   to any active SSE connection for that student. Students with no active
 *   connection simply receive the notification on their next GET /notifications.
 */

import Notification, { NOTIFICATION_TYPES } from "../models/Notification.model.js";
import Registration from "../models/Registration.model.js";
import User from "../models/User.model.js";
import * as sseManager from "../utils/sseManager.js";
import ApiError from "../utils/ApiError.js";
import { parsePagination, buildPaginationMeta } from "../utils/paginate.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Creates a single notification and immediately pushes it to the
 * recipient's active SSE connection(s).
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.recipient
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.body
 * @param {object} [params.data]
 * @returns {Promise<object>}  Created notification document.
 */
const createOne = async ({ recipient, type, title, body, data = {} }) => {
  const notification = await Notification.create({
    recipient,
    type,
    title,
    body,
    data,
  });

  // Push real-time delivery — non-blocking, best-effort.
  sseManager.pushToUser(
    recipient.toString(),
    "notification",
    notification.toJSON()
  );

  return notification.toJSON();
};

/**
 * Creates multiple notifications in a single DB insert and pushes each one
 * to the respective recipient's SSE connection.
 * Used for event-wide notifications (cancelled, updated) where every
 * registered student needs the same message.
 *
 * @param {Array<object>} notificationsData  Array of notification payloads.
 * @returns {Promise<void>}
 */
const createBatch = async (notificationsData) => {
  if (notificationsData.length === 0) return;

  const created = await Notification.insertMany(notificationsData, {
    ordered: false, // Continue inserting even if one document fails.
  });

  // Push real-time events to every recipient that is currently connected.
  for (const notification of created) {
    sseManager.pushToUser(
      notification.recipient.toString(),
      "notification",
      notification.toJSON()
    );
  }
};

/**
 * Finds all students with a confirmed registration for the given event.
 *
 * @param {string|mongoose.Types.ObjectId} eventId
 * @returns {Promise<mongoose.Types.ObjectId[]>}  Array of student _ids.
 */
const getConfirmedRegistrantIds = async (eventId) => {
  const registrations = await Registration.find({
    event: eventId,
    status: "confirmed",
  })
    .select("student")
    .lean();

  return registrations.map((r) => r.student);
};

/**
 * Students who should receive a registration deadline reminder:
 * saved the event or follow its channel, but are not yet confirmed registrants.
 *
 * @param {object} event  Event document (needs _id and channel).
 * @returns {Promise<mongoose.Types.ObjectId[]>}
 */
const getDeadlineReminderRecipientIds = async (event) => {
  const registrantIds = await getConfirmedRegistrantIds(event._id);
  const exclude = new Set(registrantIds.map(String));

  const [savedUsers, channelFollowers, alreadyNotified] = await Promise.all([
    User.find({
      role: "student",
      isActive: true,
      savedEvents: event._id,
    })
      .select("_id")
      .lean(),
    event.channel
      ? User.find({
          role: "student",
          isActive: true,
          followedChannels: event.channel,
        })
          .select("_id")
          .lean()
      : Promise.resolve([]),
    Notification.find({
      type: NOTIFICATION_TYPES.DEADLINE_REMINDER,
      "data.eventId": event._id,
    })
      .select("recipient")
      .lean(),
  ]);

  for (const n of alreadyNotified) {
    exclude.add(String(n.recipient));
  }

  const recipientIds = new Set();
  for (const user of [...savedUsers, ...channelFollowers]) {
    const id = String(user._id);
    if (!exclude.has(id)) recipientIds.add(id);
  }

  return [...recipientIds];
};

// ─── Typed dispatchers ────────────────────────────────────────────────────────

/**
 * Sent to a student after their event registration is confirmed.
 *
 * @param {object} student          User document.
 * @param {object} event            Event document (at minimum: _id, title).
 * @param {mongoose.Types.ObjectId} registrationId
 */
export const notifyRegistrationConfirmed = (student, event, registrationId) =>
  createOne({
    recipient: student._id,
    type: NOTIFICATION_TYPES.REGISTRATION_CONFIRMED,
    title: "Registration Confirmed",
    body: `You are registered for "${event.title}". We look forward to seeing you there!`,
    data: {
      eventId:        event._id,
      eventTitle:     event.title,
      registrationId,
    },
  });

/**
 * Sent to a student when their registration is cancelled (by themselves or an admin).
 *
 * @param {object} student
 * @param {object} event
 * @param {mongoose.Types.ObjectId} registrationId
 * @param {"student"|"admin"} cancelledBy
 */
export const notifyRegistrationCancelled = (student, event, registrationId, cancelledBy) => {
  const body =
    cancelledBy === "admin"
      ? `Your registration for "${event.title}" has been cancelled by the organiser. Please contact support for more information.`
      : `Your registration for "${event.title}" has been successfully cancelled.`;

  return createOne({
    recipient: student._id,
    type: NOTIFICATION_TYPES.REGISTRATION_CANCELLED,
    title: "Registration Cancelled",
    body,
    data: { eventId: event._id, eventTitle: event.title, registrationId },
  });
};

/**
 * Sent to a student when their registration is rejected by an admin.
 *
 * @param {object} student
 * @param {object} event
 * @param {mongoose.Types.ObjectId} registrationId
 */
export const notifyRegistrationRejected = (student, event, registrationId) =>
  createOne({
    recipient: student._id,
    type: NOTIFICATION_TYPES.REGISTRATION_REJECTED,
    title: "Registration Not Approved",
    body: `Your registration for "${event.title}" could not be approved at this time. Please contact the organiser for details.`,
    data: { eventId: event._id, eventTitle: event.title, registrationId },
  });

/**
 * Sent to all students registered for an event when the event details are updated.
 * Uses batch insert — one DB write for all recipients.
 *
 * @param {object}   event          Event document.
 * @param {string[]} updatedFields  Field names that changed (for the message body).
 */
export const notifyEventUpdated = async (event, updatedFields = []) => {
  const recipientIds = await getConfirmedRegistrantIds(event._id);
  if (recipientIds.length === 0) return;

  const fieldSummary =
    updatedFields.length > 0
      ? ` Changes include: ${updatedFields.join(", ")}.`
      : "";

  const notifications = recipientIds.map((studentId) => ({
    recipient: studentId,
    type: NOTIFICATION_TYPES.EVENT_UPDATED,
    title: "Event Updated",
    body: `"${event.title}" has been updated.${fieldSummary} Please review the latest details.`,
    data: { eventId: event._id, eventTitle: event.title },
  }));

  return createBatch(notifications);
};

/**
 * Sent to all confirmed registrants when an event is cancelled.
 * Queries the DB for confirmed registrant IDs — only use this when
 * registrations have NOT yet been updated.
 *
 * @param {object} event  Event document (at minimum: _id, title).
 */
export const notifyEventCancelled = async (event) => {
  const recipientIds = await getConfirmedRegistrantIds(event._id);
  if (recipientIds.length === 0) return;
  return notifyEventCancelledToRecipients(event, recipientIds);
};

/**
 * Sends cancellation notifications to a pre-collected list of recipient IDs.
 * Use this when registrations have already been bulk-updated to "cancelled"
 * (so a fresh DB query would find nobody).
 *
 * @param {object}   event         Event document (at minimum: _id, title).
 * @param {Array}    recipientIds  Array of student ObjectIds to notify.
 */
export const notifyEventCancelledToRecipients = async (event, recipientIds) => {
  if (!recipientIds || recipientIds.length === 0) return;

  const notifications = recipientIds.map((studentId) => ({
    recipient: studentId,
    type: NOTIFICATION_TYPES.EVENT_CANCELLED,
    title: "Event Cancelled",
    body: `We regret to inform you that "${event.title}" has been cancelled. Your registration has been voided.`,
    data: { eventId: event._id, eventTitle: event.title },
  }));

  return createBatch(notifications);
};

/**
 * Sent to students who saved an event or follow its channel when registration
 * is about to close — excluding students who already registered.
 * Intended to be triggered by a scheduled job (cron) 24 hours before the deadline.
 * Can also be triggered manually from the admin panel.
 *
 * @param {object} event  Event document (needs _id, title, channel, registrationDeadline).
 */
export const notifyDeadlineReminder = async (event) => {
  const recipientIds = await getDeadlineReminderRecipientIds(event);
  if (recipientIds.length === 0) return { sent: 0 };

  const deadlineDateStr = event.registrationDeadline
    ? new Date(event.registrationDeadline).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "soon";

  const notifications = recipientIds.map((studentId) => ({
    recipient: studentId,
    type: NOTIFICATION_TYPES.DEADLINE_REMINDER,
    title: "Registration Closing Soon",
    body: `Registration for "${event.title}" closes ${deadlineDateStr}. Sign up before spots fill up!`,
    data: {
      eventId:  event._id,
      eventTitle: event.title,
      extra: { deadlineDate: event.registrationDeadline },
    },
  }));

  await createBatch(notifications);
  return { sent: recipientIds.length };
};

/**
 * Sent to confirmed registrants 24 hours before an event starts.
 * Intended to be triggered by a scheduled job (cron).
 *
 * @param {object} event  Event document.
 */
export const notifyEventStartsSoon = async (event) => {
  const [recipientIds, alreadyNotified] = await Promise.all([
    getConfirmedRegistrantIds(event._id),
    Notification.find({
      type: NOTIFICATION_TYPES.EVENT_STARTS_SOON,
      "data.eventId": event._id,
    })
      .select("recipient")
      .lean(),
  ]);

  const exclude = new Set(alreadyNotified.map((n) => String(n.recipient)));
  const targets = recipientIds.filter((id) => !exclude.has(String(id)));

  if (targets.length === 0) return { sent: 0 };

  const startDateStr = new Date(event.startDate).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const notifications = targets.map((studentId) => ({
    recipient: studentId,
    type: NOTIFICATION_TYPES.EVENT_STARTS_SOON,
    title: "Your Event Starts Tomorrow",
    body: `"${event.title}" starts on ${startDateStr}. Don't forget to attend!`,
    data: {
      eventId:    event._id,
      eventTitle: event.title,
      extra: { startDate: event.startDate },
    },
  }));

  await createBatch(notifications);
  return { sent: targets.length };
};

/**
 * Sent to a student when a new event is posted to a channel they follow.
 * Called by the Channel service once that module is built.
 *
 * @param {mongoose.Types.ObjectId[]} followerIds  Students who follow this channel.
 * @param {object}                    event
 * @param {object}                    channel       { _id, name }
 */
export const notifyNewChannelEvent = async (followerIds, event, channel) => {
  if (!followerIds || followerIds.length === 0) return;

  const notifications = followerIds.map((studentId) => ({
    recipient: studentId,
    type: NOTIFICATION_TYPES.NEW_CHANNEL_EVENT,
    title: `New Event: ${event.title}`,
    body: `${channel.name} just posted a new event: "${event.title}". Register before spots fill up!`,
    data: {
      eventId:     event._id,
      eventTitle:  event.title,
      channelId:   channel._id,
      channelName: channel.name,
    },
  }));

  return createBatch(notifications);
};

/**
 * Admin-initiated broadcast to a defined audience.
 *
 * @param {object} options
 * @param {string} options.title        Notification title.
 * @param {string} options.body         Notification body.
 * @param {"all"|"event_registrants"} options.targetType
 * @param {string} [options.eventId]    Required when targetType = "event_registrants".
 */
export const sendAdminAnnouncement = async ({ title, body, targetType, eventId }) => {
  let recipientIds = [];

  if (targetType === "all") {
    const students = await User.find({ role: "student", isActive: true })
      .select("_id")
      .lean();
    recipientIds = students.map((s) => s._id);
  } else if (targetType === "event_registrants") {
    if (!eventId) throw ApiError.badRequest("eventId is required for event_registrants target.");
    recipientIds = await getConfirmedRegistrantIds(eventId);
  }

  if (recipientIds.length === 0) return { sent: 0 };

  const notifications = recipientIds.map((studentId) => ({
    recipient: studentId,
    type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    title,
    body,
    data: eventId ? { eventId, eventTitle: null } : {},
  }));

  await createBatch(notifications);

  return { sent: recipientIds.length };
};

// ─── Query functions ──────────────────────────────────────────────────────────

/**
 * Returns a paginated list of notifications for a student.
 * Supports optional filtering by read status.
 *
 * @param {string} userId
 * @param {object} queryParams  { isRead, page, limit }
 * @returns {{ notifications: Array, pagination: object, unreadCount: number }}
 */
export const getNotifications = async (userId, queryParams) => {
  const { page, limit, skip } = parsePagination(queryParams.page, queryParams.limit, 50);

  const filter = { recipient: userId };

  if (queryParams.isRead !== undefined) {
    filter.isRead = queryParams.isRead === "true";
  }

  const [total, unreadCount, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, isRead: false }),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
  ]);

  return {
    notifications,
    pagination: buildPaginationMeta(total, page, limit),
    unreadCount,
  };
};

/**
 * Returns the count of unread notifications.
 * Used by the notification bell badge.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipient: userId, isRead: false });
};

/**
 * Marks a single notification as read.
 * Verifies ownership — students can only mark their own notifications.
 *
 * @param {string} notificationId
 * @param {string} userId
 * @returns {object}  Updated notification.
 */
export const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  if (notification.isRead) return notification.toJSON();

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  // Push updated unread count to the student's SSE stream.
  const newCount = await getUnreadCount(userId);
  sseManager.pushToUser(userId.toString(), "unread_count", { count: newCount });

  return notification.toJSON();
};

/**
 * Marks all of a student's unread notifications as read in a single DB write.
 *
 * @param {string} userId
 * @returns {{ modifiedCount: number }}
 */
export const markAllRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  // Push zero unread count to SSE.
  sseManager.pushToUser(userId.toString(), "unread_count", { count: 0 });

  return { modifiedCount: result.modifiedCount };
};

/**
 * Deletes a single notification.
 * Students can only delete their own.
 *
 * @param {string} notificationId
 * @param {string} userId
 */
export const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  // Refresh unread count if the deleted notification was unread.
  if (!notification.isRead) {
    const newCount = await getUnreadCount(userId);
    sseManager.pushToUser(userId.toString(), "unread_count", { count: newCount });
  }
};
