/**
 * Email service — Gmail SMTP via Nodemailer.
 *
 * Configure in .env:
 *   EMAIL_ENABLED=true
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=your_app_password
 *   SMTP_FROM="CampusLink <your@gmail.com>"
 *
 * Gmail requires an App Password (Google Account → Security → 2-Step Verification → App passwords).
 */

import nodemailer from "nodemailer";
import env from "../config/env.js";
import logger from "../utils/logger.js";

let transporter = null;

export const isEmailEnabled = () =>
  env.EMAIL_ENABLED && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS);

const getTransporter = () => {
  if (!isEmailEnabled()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

/**
 * @param {{ to: string, subject: string, html: string, attachments?: object[] }} options
 * @returns {Promise<boolean>} true if sent, false if email disabled
 */
export const sendMail = async ({ to, subject, html, attachments = [] }) => {
  const transport = getTransporter();

  if (!transport) {
    logger.warn(`Email skipped (SMTP not configured): "${subject}" → ${to}`);
    return false;
  }

  await transport.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to,
    subject,
    html,
    attachments,
  });

  logger.info(`Email sent: "${subject}" → ${to}`);
  return true;
};
