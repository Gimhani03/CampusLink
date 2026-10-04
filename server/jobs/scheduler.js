/**
 * Scheduled job runner
 *
 * Starts cron tasks after the database is connected.
 * Set CRON_ENABLED=false in .env to disable (useful in local dev).
 */

import cron from "node-cron";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { runDeadlineReminderJob } from "./deadlineReminder.job.js";
import { runEventStartsSoonJob } from "./eventStartsSoon.job.js";
import { runCompletePastEventsJob } from "./completePastEvents.job.js";

/** @type {import("node-cron").ScheduledTask[]} */
const tasks = [];

const runStartupCatchUp = async () => {
  try {
    await runDeadlineReminderJob();
    await runEventStartsSoonJob();
    if (env.CRON_AUTO_COMPLETE_EVENTS) {
      await runCompletePastEventsJob();
    }
  } catch (err) {
    logger.error(`Startup cron catch-up error: ${err.message}`);
  }
};

export const startScheduler = () => {
  if (!env.CRON_ENABLED) {
    logger.info("Scheduled jobs disabled (CRON_ENABLED=false).");
    return;
  }

  // Every hour at minute 0.
  const hourlyTask = cron.schedule("0 * * * *", async () => {
    try {
      const deadlineResult = await runDeadlineReminderJob();
      if (deadlineResult.notificationsSent > 0) {
        logger.info(
          `Deadline reminder cron: ${deadlineResult.notificationsSent} notification(s) across ${deadlineResult.eventsProcessed} event(s).`
        );
      }

      const startsSoonResult = await runEventStartsSoonJob();
      if (startsSoonResult.notificationsSent > 0) {
        logger.info(
          `Event starts soon cron: ${startsSoonResult.notificationsSent} notification(s) across ${startsSoonResult.eventsProcessed} event(s).`
        );
      }

      if (env.CRON_AUTO_COMPLETE_EVENTS) {
        await runCompletePastEventsJob();
      }
    } catch (err) {
      logger.error(`Hourly cron error: ${err.message}`);
    }
  });

  tasks.push(hourlyTask);

  const jobs = [
    "deadline reminders",
    "event starts soon",
    ...(env.CRON_AUTO_COMPLETE_EVENTS ? ["auto-complete past events"] : []),
  ];
  logger.info(`Scheduled jobs started (every hour at :00): ${jobs.join(", ")}.`);

  // Catch up immediately on startup if the server was down during a trigger window.
  runStartupCatchUp();
};

export const stopScheduler = () => {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
};
