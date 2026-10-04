/**
 * QR event pass — token generation, email delivery, and pass lookup.
 *
 * Each registrant (individual) or each team member gets a unique checkInToken.
 * The QR encodes a client URL; staff scan via Admin → Check-In to mark attendance.
 */

import { randomUUID } from "crypto";
import QRCode from "qrcode";
import Registration from "../models/Registration.model.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { sendMail, isEmailEnabled } from "./email.service.js";
import { PLATFORM_NAME } from "../constants/branding.js";

// ─── Token assignment ─────────────────────────────────────────────────────────

export const assignTeamMemberTokens = (processedTeam) => {
  if (!processedTeam?.members) return processedTeam;

  for (const member of processedTeam.members) {
    member.checkInToken = randomUUID();
    member.passEmailSentAt = null;
    member.checkedInAt = null;
  }

  return processedTeam;
};

export const newIndividualCheckInFields = () => ({
  checkInToken: randomUUID(),
  passEmailSentAt: null,
  checkedInAt: null,
});

export const buildPassUrl = (token) => `${env.CLIENT_ORIGIN}/pass/${token}`;

export const generateQrPngBuffer = (text) =>
  QRCode.toBuffer(text, { type: "png", width: 280, margin: 2, errorCorrectionLevel: "M" });

// ─── Pass resolution ──────────────────────────────────────────────────────────

const formatEventWhen = (event) => {
  if (!event?.startDate) return "See event details in the app";
  try {
    return new Date(event.startDate).toLocaleString("en-LK", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(event.startDate);
  }
};

const formatEventWhere = (event) => {
  if (event?.eventType === "online") return event.onlineLink || "Online event";
  return event?.venue || "Venue to be announced";
};

/** Collect pass payloads from a registration document. */
export const collectPassesFromRegistration = (registration) => {
  if (registration.team?.members?.length) {
    return registration.team.members
      .filter((m) => m.checkInToken)
      .map((m) => ({
        token: m.checkInToken,
        email: m.personalEmail,
        fullName: m.fullName,
        role: m.role,
        teamName: registration.team.name,
        isTeam: true,
      }));
  }

  if (registration.checkInToken) {
    return [{
      token: registration.checkInToken,
      email: registration.studentSnapshot?.email,
      fullName: registration.studentSnapshot?.fullName,
      isTeam: false,
    }];
  }

  return [];
};

/** Find which pass belongs to the requesting student on a registration. */
export const resolvePassForUser = (registration, user) => {
  const passes = collectPassesFromRegistration(registration);

  if (registration.team?.members?.length) {
    const member = registration.team.members.find((m) => {
      if (m.user && String(m.user) === String(user._id)) return true;
      if (user.studentId && m.studentId && m.studentId === user.studentId.trim().toUpperCase()) return true;
      if (user.email && m.personalEmail && m.personalEmail === user.email.trim().toLowerCase()) return true;
      return false;
    });

    if (!member?.checkInToken) return null;

    return {
      token: member.checkInToken,
      email: member.personalEmail,
      fullName: member.fullName,
      role: member.role,
      teamName: registration.team.name,
      isTeam: true,
      checkedInAt: member.checkedInAt ?? null,
    };
  }

  const isRegistrant = String(registration.student?._id ?? registration.student) === String(user._id);
  if (!isRegistrant || !registration.checkInToken) return null;

  return {
    token: registration.checkInToken,
    email: registration.studentSnapshot?.email,
    fullName: registration.studentSnapshot?.fullName,
    isTeam: false,
    checkedInAt: registration.checkedInAt ?? null,
  };
};

// ─── Email templates ──────────────────────────────────────────────────────────

const buildPassEmailHtml = ({ pass, event, registration, passUrl }) => {
  const when = formatEventWhen(event);
  const where = formatEventWhere(event);
  const teamLine = pass.isTeam
    ? `<p style="margin:0 0 8px;color:#475569;font-size:14px;"><strong>Team:</strong> ${pass.teamName}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0d6b4a;">${PLATFORM_NAME}</p>
      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Your event pass</h1>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5;">
        Hi ${pass.fullName}, your registration is confirmed. Show this QR code at the event entrance.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">${event.title}</p>
        ${teamLine}
        <p style="margin:0 0 4px;color:#475569;font-size:14px;"><strong>When:</strong> ${when}</p>
        <p style="margin:0;color:#475569;font-size:14px;"><strong>Where:</strong> ${where}</p>
      </div>
      <p style="margin:0 0 12px;font-size:13px;color:#64748b;text-align:center;">Scan at check-in</p>
      <img src="cid:event-pass-qr" alt="Event pass QR code" width="200" height="200"
        style="display:block;margin:0 auto 16px;border:1px solid #e2e8f0;border-radius:12px;" />
      <p style="margin:0 0 20px;font-size:12px;color:#94a3b8;text-align:center;word-break:break-all;">
        Or open: <a href="${passUrl}" style="color:#0d6b4a;">${passUrl}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
        Registration ID: ${registration._id}<br>
        This pass is personal to you — do not share it.
      </p>
    </div>
  </div>
</body>
</html>`;
};

const markPassEmailSent = async (registrationId, pass) => {
  if (pass.isTeam && pass.role) {
    await Registration.updateOne(
      { _id: registrationId, "team.members.checkInToken": pass.token },
      { $set: { "team.members.$.passEmailSentAt": new Date() } },
    );
    return;
  }

  await Registration.findByIdAndUpdate(registrationId, { passEmailSentAt: new Date() });
};

const sendOnePassEmail = async (registration, event, pass) => {
  const passUrl = buildPassUrl(pass.token);
  const qrBuffer = await generateQrPngBuffer(passUrl);
  const html = buildPassEmailHtml({ pass, event, registration, passUrl });

  const sent = await sendMail({
    to: pass.email,
    subject: `Your pass for ${event.title} — ${PLATFORM_NAME}`,
    html,
    attachments: [{
      filename: "event-pass-qr.png",
      content: qrBuffer,
      cid: "event-pass-qr",
    }],
  });

  if (sent) {
    await markPassEmailSent(registration._id, pass);
  }

  return sent;
};

/**
 * Email a unique QR pass to every participant on a confirmed registration.
 * Fire-and-forget safe — logs errors per recipient.
 */
export const sendRegistrationPasses = async (registration, event) => {
  if (registration.status !== "confirmed") return { sent: 0, skipped: 0 };

  const passes = collectPassesFromRegistration(registration);
  if (passes.length === 0) {
    logger.warn(`No check-in tokens on registration ${registration._id} — pass emails skipped.`);
    return { sent: 0, skipped: 0 };
  }

  if (!isEmailEnabled()) {
    logger.warn("Pass emails skipped — configure Gmail SMTP in .env (EMAIL_ENABLED, SMTP_*).");
    return { sent: 0, skipped: passes.length };
  }

  let sent = 0;
  for (const pass of passes) {
    try {
      const ok = await sendOnePassEmail(registration, event, pass);
      if (ok) sent += 1;
    } catch (err) {
      logger.error(`Pass email failed for ${pass.email}: ${err.message}`);
    }
  }

  return { sent, skipped: passes.length - sent };
};

/**
 * Ensure tokens exist on a registration (e.g. waitlisted → confirmed).
 * Returns updated registration document.
 */
export const ensureCheckInTokens = async (registrationDoc) => {
  let dirty = false;

  if (registrationDoc.team?.members?.length) {
    for (const member of registrationDoc.team.members) {
      if (!member.checkInToken) {
        member.checkInToken = randomUUID();
        dirty = true;
      }
    }
  } else if (!registrationDoc.checkInToken) {
    registrationDoc.checkInToken = randomUUID();
    dirty = true;
  }

  if (dirty) {
    await registrationDoc.save();
  }

  return registrationDoc;
};

/**
 * Build pass payload for the authenticated student (in-app "View pass").
 */
export const buildPassPayload = async (registration, user) => {
  const pass = resolvePassForUser(registration, user);
  if (!pass) {
    return null;
  }

  const passUrl = buildPassUrl(pass.token);
  const qrDataUrl = await QRCode.toDataURL(passUrl, { width: 280, margin: 2 });

  const event = registration.event;

  return {
    passUrl,
    qrDataUrl,
    attendeeName: pass.fullName,
    attendeeEmail: pass.email,
    teamName: pass.teamName ?? null,
    role: pass.role ?? null,
    checkedInAt: pass.checkedInAt,
    event: {
      title: event?.title,
      startDate: event?.startDate,
      endDate: event?.endDate,
      venue: event?.venue,
      onlineLink: event?.onlineLink,
      eventType: event?.eventType,
      organizer: event?.organizer,
    },
    registrationId: registration._id,
    status: registration.status,
  };
};
