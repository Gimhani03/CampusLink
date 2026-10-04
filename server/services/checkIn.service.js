/**
 * Check-in service — QR token lookup and attendance marking.
 *
 * Each checkInToken maps to one attendee (individual registrant or one team member).
 * Admin scans the student's QR → token lookup → mark checkedInAt.
 */

import QRCode from "qrcode";
import Registration from "../models/Registration.model.js";
import ApiError from "../utils/ApiError.js";
import { buildPassUrl } from "./qrPass.service.js";

const EVENT_FIELDS = "title startDate endDate venue onlineLink eventType organizer status registrationMode";

/** Extract a UUID token from a raw scan (full URL or bare token). */
export const parseCheckInToken = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.trim().match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return match ? match[0].toLowerCase() : null;
};

const buildAttendeePayload = (registration, pass) => ({
  registrationId: registration._id,
  registrationStatus: registration.status,
  attendeeName: pass.fullName,
  attendeeEmail: pass.email,
  teamName: pass.teamName ?? null,
  role: pass.role ?? null,
  isTeam: pass.isTeam,
  checkedInAt: pass.checkedInAt ?? null,
  event: {
    _id: registration.event?._id,
    title: registration.event?.title,
    startDate: registration.event?.startDate,
    endDate: registration.event?.endDate,
    venue: registration.event?.venue,
    onlineLink: registration.event?.onlineLink,
    eventType: registration.event?.eventType,
    organizer: registration.event?.organizer,
  },
});

/** Resolve a check-in token to registration + attendee. */
export const findByCheckInToken = async (rawToken) => {
  const token = parseCheckInToken(rawToken);
  if (!token) {
    throw ApiError.badRequest("Invalid QR code — no check-in token found.");
  }

  let registration = await Registration.findOne({ checkInToken: token })
    .populate("event", EVENT_FIELDS)
    .populate("student", "fullName email studentId");

  if (registration) {
    const pass = {
      token,
      fullName: registration.studentSnapshot?.fullName ?? registration.student?.fullName,
      email: registration.studentSnapshot?.email ?? registration.student?.email,
      isTeam: false,
      checkedInAt: registration.checkedInAt ?? null,
      updatePath: "individual",
    };
    return { registration, pass };
  }

  registration = await Registration.findOne({
    "team.members.checkInToken": { $regex: new RegExp(`^${token}$`, "i") },
  })
    .populate("event", EVENT_FIELDS)
    .populate("student", "fullName email studentId");

  if (!registration) {
    throw ApiError.notFound("Invalid pass — no registration found for this QR code.");
  }

  const member = registration.team.members.find(
    (m) => m.checkInToken?.toLowerCase() === token,
  );
  if (!member) {
    throw ApiError.notFound("Invalid pass — team member not found.");
  }

  const pass = {
    token,
    fullName: member.fullName,
    email: member.personalEmail,
    role: member.role,
    teamName: registration.team.name,
    isTeam: true,
    checkedInAt: member.checkedInAt ?? null,
    updatePath: "team",
  };

  return { registration, pass };
};

/** Preview pass details without marking attendance (admin). */
export const lookupCheckIn = async (rawToken) => {
  const { registration, pass } = await findByCheckInToken(rawToken);
  return buildAttendeePayload(registration, pass);
};

/** Mark attendance for a scanned token (admin). Idempotent if already checked in. */
export const markCheckIn = async (rawToken) => {
  const { registration, pass } = await findByCheckInToken(rawToken);

  if (registration.status !== "confirmed") {
    throw ApiError.badRequest(
      `Cannot check in — registration is "${registration.status}". Only confirmed registrations are eligible.`,
    );
  }

  if (pass.checkedInAt) {
    return {
      ...buildAttendeePayload(registration, pass),
      alreadyCheckedIn: true,
      message: `${pass.fullName} was already checked in.`,
    };
  }

  const now = new Date();

  if (pass.updatePath === "individual") {
    const updated = await Registration.findByIdAndUpdate(
      registration._id,
      { checkedInAt: now },
      { timestamps: false },
    );
    if (!updated) {
      throw ApiError.internal("Failed to save check-in. Please try again.");
    }
    pass.checkedInAt = now;
  } else {
    const memberIndex = registration.team.members.findIndex(
      (m) => m.checkInToken?.toLowerCase() === pass.token,
    );
    if (memberIndex < 0) {
      throw ApiError.notFound("Invalid pass — team member not found.");
    }
    const { modifiedCount } = await Registration.updateOne(
      { _id: registration._id },
      { $set: { [`team.members.${memberIndex}.checkedInAt`]: now } },
    );
    if (modifiedCount === 0) {
      throw ApiError.internal("Failed to save check-in. Please try again.");
    }
    pass.checkedInAt = now;
  }

  return {
    ...buildAttendeePayload(registration, pass),
    alreadyCheckedIn: false,
    message: `${pass.fullName} checked in successfully.`,
  };
};

/** Public pass view — token is the secret; returns QR for the student pass page. */
export const getPublicPass = async (rawToken) => {
  const { registration, pass } = await findByCheckInToken(rawToken);

  if (registration.status === "cancelled") {
    throw ApiError.badRequest("This registration has been cancelled.");
  }

  const passUrl = buildPassUrl(pass.token);
  const qrDataUrl = await QRCode.toDataURL(passUrl, { width: 280, margin: 2 });

  return {
    passUrl,
    qrDataUrl,
    attendeeName: pass.fullName,
    teamName: pass.teamName ?? null,
    role: pass.role ?? null,
    checkedInAt: pass.checkedInAt ?? null,
    registrationStatus: registration.status,
    event: {
      title: registration.event?.title,
      startDate: registration.event?.startDate,
      endDate: registration.event?.endDate,
      venue: registration.event?.venue,
      onlineLink: registration.event?.onlineLink,
      eventType: registration.event?.eventType,
      organizer: registration.event?.organizer,
    },
  };
};

/** Count checked-in attendees for an event (admin stats). */
export const countEventCheckIns = (registrations) => {
  let checkedIn = 0;
  let totalPasses = 0;

  for (const reg of registrations) {
    if (reg.status !== "confirmed") continue;

    if (reg.team?.members?.length) {
      for (const m of reg.team.members) {
        totalPasses += 1;
        if (m.checkedInAt) checkedIn += 1;
      }
    } else {
      totalPasses += 1;
      if (reg.checkedInAt) checkedIn += 1;
    }
  }

  return { checkedIn, totalPasses };
};
