/**
 * MongoDB connection module.
 *
 * Encapsulates the Mongoose connection lifecycle.
 * Called once from server.js before the HTTP server starts,
 * ensuring the database is ready before accepting requests.
 *
 * Uses Mongoose's built-in connection events for observability
 * and handles unrecoverable connection failures by exiting the
 * process so the container / process manager can restart cleanly.
 */

import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";
import User from "../models/User.model.js";
import Registration from "../models/Registration.model.js";
import Event from "../models/Event.model.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      // Restrict the number of sockets in the connection pool.
      // Tune based on expected concurrent load.
      maxPoolSize: 10,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    // Replace legacy sparse studentId index with NSBM-only partial unique index.
    await User.syncIndexes();
    await Registration.syncIndexes();

    const { modifiedCount: teamTokenUnset } = await Registration.updateMany(
      { team: { $ne: null }, checkInToken: null },
      { $unset: { checkInToken: "" } }
    );
    if (teamTokenUnset > 0) {
      logger.info(`Unset redundant checkInToken on ${teamTokenUnset} team registration(s).`);
    }

    const missingEventSnapshot = await Registration.find({
      $or: [
        { eventSnapshot: { $exists: false } },
        { "eventSnapshot.title": { $in: [null, ""] } },
      ],
    })
      .select("event")
      .limit(500)
      .lean();

    if (missingEventSnapshot.length > 0) {
      const eventIds = [...new Set(missingEventSnapshot.map((r) => String(r.event)))];
      const events = await Event.find({ _id: { $in: eventIds } }).select("title").lean();
      const titleById = Object.fromEntries(events.map((e) => [String(e._id), e.title]));

      let backfilled = 0;
      for (const reg of missingEventSnapshot) {
        const title = titleById[String(reg.event)];
        if (!title) continue;
        await Registration.updateOne(
          { _id: reg._id },
          { $set: { eventSnapshot: { title } } }
        );
        backfilled += 1;
      }
      if (backfilled > 0) {
        logger.info(`Backfilled eventSnapshot.title on ${backfilled} registration(s).`);
      }
    }

    const { modifiedCount } = await User.updateMany(
      { studentType: "external", studentId: { $exists: true } },
      { $unset: { studentId: "" } }
    );
    if (modifiedCount > 0) {
      logger.info(`Removed studentId from ${modifiedCount} guest account(s).`);
    }
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    // Exit with failure code so process managers (PM2, Docker) restart the app.
    process.exit(1);
  }
};

// Emitted when the connection is lost after initial success.
mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected. Attempting to reconnect...");
});

// Emitted after a successful reconnect.
mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected.");
});

export default connectDB;
