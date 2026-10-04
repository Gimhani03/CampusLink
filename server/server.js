/**
 * Application entry point.
 *
 * Responsibilities (and only these):
 *   1. Import env.js first — validates all required environment variables
 *      before any other module is loaded.
 *   2. Connect to MongoDB.
 *   3. Start the HTTP server.
 *   4. Register handlers for graceful shutdown and unhandled rejections
 *      so the process exits cleanly without leaking connections.
 *
 * Keeping this file free of Express configuration makes it trivial to
 * swap the transport layer (HTTP → HTTPS, HTTP/2, etc.) without touching
 * application logic.
 */

import "./config/env.js"; // Must be first — loads and validates .env.
import http from "http";

import app from "./app.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import env from "./config/env.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";

const PORT = env.PORT;

const startServer = async () => {
  // Establish database connection before accepting HTTP traffic.
  await connectDB();

  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    startScheduler();
  });

  // ─── Graceful shutdown ────────────────────────────────────────────────────

  /**
   * Stops the HTTP server from accepting new connections, waits for
   * in-flight requests to complete, then closes the database connection.
   * This prevents request dropping during deployments or restarts.
   */
  const shutdown = (signal) => {
    logger.warn(`${signal} received. Shutting down gracefully...`);
    stopScheduler();

    server.close(async () => {
      logger.info("HTTP server closed.");

      try {
        const mongoose = (await import("mongoose")).default;
        await mongoose.connection.close();
        logger.info("MongoDB connection closed.");
      } catch (err) {
        logger.error(`Error closing MongoDB connection: ${err.message}`);
      } finally {
        process.exit(0);
      }
    });

    // Force-kill if graceful shutdown takes longer than 10 seconds.
    setTimeout(() => {
      logger.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM")); // Docker / Kubernetes stop signal.
  process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C in development.

  // ─── Unhandled errors ─────────────────────────────────────────────────────

  // A rejected promise that was not caught anywhere in the application.
  // Log it and exit so the process manager can restart with a clean state.
  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled Promise Rejection: ${reason}`);
    shutdown("unhandledRejection");
  });

  // A synchronous exception that escaped all try/catch blocks.
  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
    shutdown("uncaughtException");
  });
};

startServer();
