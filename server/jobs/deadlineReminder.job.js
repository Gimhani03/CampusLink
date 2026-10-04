/**
 * Deadline Reminder Job
 *
 * Finds published events whose registration deadline falls within the
 * 23–25 hour window and sends reminders to eligible students (saved event
 * or channel follower, not yet registered).
 *
 * Designed to run hourly via the scheduler — the 2-hour window ensures
 * at least one run fires ~24 hours before each deadline.
 */

import Event from "../models/Event.model.js";
import * as notificationService from "../services/notification.service.js";
import logger from "../utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MIN_HOURS = 23;
const WINDOW_MAX_HOURS = 25;

/**
 * @returns {Promise<{ eventsProcessed: number, notificationsSent: number }>}
 */
export const runDeadlineReminderJob = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MIN_HOURS * HOUR_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_HOURS * HOUR_MS);

  const events = await Event.find({
    status: "published",
    registrationDeadline: { $ne: null, $gte: windowStart, $lte: windowEnd },
  }).lean();

  if (events.length === 0) {
    return { eventsProcessed: 0, notificationsSent: 0 };
  }

  let notificationsSent = 0;

  for (const event of events) {
    try {
      const result = await notificationService.notifyDeadlineReminder(event);
      const sent = result?.sent ?? 0;
      notificationsSent += sent;

      if (sent > 0) {
        logger.info(
          `Deadline reminder: ${sent} notification(s) sent for "${event.title}"`
        );
      }
    } catch (err) {
      logger.error(
        `Deadline reminder failed for event ${event._id}: ${err.message}`
      );
    }
  }

  return { eventsProcessed: events.length, notificationsSent };
};
