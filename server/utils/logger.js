/**
 * Application-wide logger built on Winston.
 *
 * Provides two transports:
 *   - Console  : human-readable colourised output in development;
 *                structured JSON in production for log aggregators.
 *   - File     : error-level messages written to logs/error.log so
 *                operational issues survive terminal restarts.
 *
 * Exported as a singleton so every module shares the same instance.
 * Morgan (HTTP request logger) is configured separately in app.js
 * and streams its output through this logger for unified formatting.
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import env from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "../logs");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Human-readable format used in development.
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return stack
      ? `${timestamp} [${level}]: ${message}\n${stack}`
      : `${timestamp} [${level}]: ${message}`;
  })
);

// Structured JSON format suited for production log aggregators (Datadog, CloudWatch, etc.)
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const transports = [
  new winston.transports.Console({
    format: env.IS_PRODUCTION ? prodFormat : devFormat,
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, "error.log"),
    level: "error",
    format: prodFormat,
    // Rotate logs externally with logrotate or use winston-daily-rotate-file
    // when the project grows.
    maxsize: 5 * 1024 * 1024, // 5 MB
    maxFiles: 5,
  }),
];

const logger = winston.createLogger({
  level: env.IS_PRODUCTION ? "warn" : "debug",
  transports,
  // Prevent Winston from crashing the process on uncaught exceptions here;
  // server.js registers its own handlers that log then exit gracefully.
  exitOnError: false,
});

/**
 * A writable stream adapter so Morgan can pipe its output through Winston.
 * Used in app.js: morgan(..., { stream: logger.stream }).
 */
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;
