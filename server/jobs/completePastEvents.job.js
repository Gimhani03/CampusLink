/**
 * Complete Past Events Job
 *
 * Marks published events as completed once their end date has passed.
 */

import * as eventService from "../services/event.service.js";
import logger from "../utils/logger.js";

/**
 * @returns {Promise<{ eventsCompleted: number }>}
 */
export const runCompletePastEventsJob = async () => {
  const { modifiedCount } = await eventService.completePastEvents();

  if (modifiedCount > 0) {
    logger.info(`Auto-completed ${modifiedCount} past event(s).`);
  }

  return { eventsCompleted: modifiedCount };
};
