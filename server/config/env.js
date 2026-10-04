/**
 * Centralised environment variable loader and validator.
 *
 * Imported once at the very top of server.js before any other module.
 * Validates that every required variable is present so the application
 * fails fast with a clear message instead of crashing deep inside a
 * module or silently running with undefined secrets.
 */

import dotenv from "dotenv";

dotenv.config();

const REQUIRED_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_SECRET",
  "JWT_REFRESH_EXPIRES_IN",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLIENT_ORIGIN",
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[Config] Missing required environment variables: ${missing.join(", ")}\n` +
      `Copy .env.example to .env and fill in the values.`
  );
  process.exit(1);
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  JWT_COOKIE_EXPIRES_IN: parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 30,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  // Set CRON_ENABLED=false to disable hourly notification jobs in local dev.
  CRON_ENABLED: process.env.CRON_ENABLED !== "false",
  // Auto-mark published events as completed once endDate has passed.
  CRON_AUTO_COMPLETE_EVENTS: process.env.CRON_AUTO_COMPLETE_EVENTS !== "false",
  // Gmail SMTP (optional — pass emails skipped when EMAIL_ENABLED is false)
  EMAIL_ENABLED: process.env.EMAIL_ENABLED === "true",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "",
};

export default env;
