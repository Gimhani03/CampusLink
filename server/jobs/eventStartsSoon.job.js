/**
 * Event Starts Soon Job
 *
 * Finds published events whose start date falls within the 23–25 hour window
 * and notifies confirmed registrants.
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
export const runEventStartsSoonJob = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MIN_HOURS * HOUR_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_HOURS * HOUR_MS);

  const events = await Event.find({
    status: "published",
    startDate: { $gte: windowStart, $lte: windowEnd },
  }).lean();

  if (events.length === 0) {
    return { eventsProcessed: 0, notificationsSent: 0 };
  }

  let notificationsSent = 0;

  for (const event of events) {
    try {
      const result = await notificationService.notifyEventStartsSoon(event);
      const sent = result?.sent ?? 0;
      notificationsSent += sent;

      if (sent > 0) {
        logger.info(
          `Event starts soon: ${sent} notification(s) sent for "${event.title}"`
        );
      }
    } catch (err) {
      logger.error(
        `Event starts soon failed for event ${event._id}: ${err.message}`
      );
    }
  }

  return { eventsProcessed: events.length, notificationsSent };
};
