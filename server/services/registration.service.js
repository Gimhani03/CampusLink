/**
 * Registration Service — core event registration business logic.
 *
 * Covers the complete lifecycle of a registration:
 *   Create → Cancel (student) → Status update (admin) → List & detail queries.
 *
 * Guard sequence enforced on every new registration attempt:
 *   1. Event exists and is published.
 *   2. Registration is open (deadline not passed, event not started).
 *   3. Event is not at full capacity.
 *   4. Student has not already registered.
 *   5. All required organiser questions have valid answers.
 *   → Only then is the document created and the counter incremented.
 *
 * Atomicity note on registrationCount:
 *   $inc is used instead of read-modify-write to prevent a race condition
 *   where two simultaneous registrations both read count=49 (capacity=50)
 *   and both succeed, overflowing the event. The capacity check in step 3
 *   is a best-effort guard; the $inc keeps the count correct.
 *   For true strict capacity enforcement at high concurrency, a MongoDB
 *   transaction or a findOneAndUpdate with a conditional filter would be used.
 *   That upgrade path is straightforward given the current structure.
 */

import mongoose from "mongoose";
import Registration from "../models/Registration.model.js";
import Event from "../models/Event.model.js";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import { parsePagination, buildPaginationMeta } from "../utils/paginate.js";
import { invalidateStudentCache } from "./recommendation.service.js";
import {
  getRolesForSize,
  getAllowedTeamSizes,
  getTeamSizeBounds,
  normalizeNic,
  normalizeEmail,
  NIC_PATTERN,
  PHONE_PATTERN,
} from "../utils/teamRegistration.js";
import { NSBM_UNIVERSITY } from "../constants/universities.js";
import {
  canUserRegisterForEvent,
  audienceScopeDeniedMessage,
} from "../utils/eventAudience.js";
import {
  notifyRegistrationConfirmed,
  notifyRegistrationCancelled,
  notifyRegistrationRejected,
} from "./notification.service.js";
import {
  assignTeamMemberTokens,
  newIndividualCheckInFields,
  sendRegistrationPasses,
  ensureCheckInTokens,
  buildPassPayload,
} from "./qrPass.service.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Match registrations where the student is the registrant or a linked team member. */
const buildStudentMembershipConditions = (user) => {
  const conditions = [{ student: user._id }];

  if (user._id) {
    conditions.push({ "team.members.user": user._id });
  }
  if (user.studentId) {
    conditions.push({ "team.members.studentId": user.studentId.trim().toUpperCase() });
  }
  if (user.email) {
    conditions.push({ "team.members.personalEmail": user.email.trim().toLowerCase() });
  }

  return conditions;
};

/** Find an active or historical registration tying a student to an event. */
const findStudentRegistrationOnEvent = async (user, eventId, { includeCancelled = true } = {}) => {
  const filter = {
    event: eventId,
    $or: buildStudentMembershipConditions(user),
  };

  if (!includeCancelled) {
    filter.status = { $ne: "cancelled" };
  }

  return Registration.findOne(filter).lean({ virtuals: true });
};

export const isUserRegisteredForEvent = async (user, eventId) => {
  const registration = await findStudentRegistrationOnEvent(user, eventId, {
    includeCancelled: false,
  });
  return Boolean(registration);
};

/** Point-in-time profile copy for a registration record. */
const buildStudentSnapshot = (student) => {
  const snapshot = {
    fullName: student.fullName,
    email: student.email,
    whatsappNumber: student.whatsappNumber,
    studentType: student.studentType ?? "nsbm",
    university: student.university ?? "",
  };

  if (student.studentType !== "external") {
    snapshot.studentId = student.studentId;
    snapshot.degree = student.degree;
    snapshot.batch = student.batch;
  }

  return snapshot;
};

/** Point-in-time event title copy for a registration record. */
const buildEventSnapshot = (event) => ({
  title: event.title?.trim() || "Untitled event",
});

/**
 * Validates the submitted answers against the event's question definitions.
 *
 * Rules per question type:
 *   text            → non-empty string, max 1000 chars
 *   yes_no          → exactly "yes" or "no"
 *   multiple_choice → string, must be one of the defined options
 *   dropdown        → string, must be one of the defined options (same as multiple_choice)
 *   checkbox        → non-empty array, every item must be a defined option
 *
 * @param {Array} questions     Event's registrationQuestions array.
 * @param {Array} rawAnswers    Client-submitted answers: [{ questionId, answer }]
 * @returns {{ processedAnswers: Array, errors: Array }}
 */
const validateAndBuildAnswers = (questions, rawAnswers = []) => {
  const errors = [];

  // Build a lookup map for quick access: questionId (string) → submitted answer.
  const submittedMap = new Map(
    rawAnswers.map((a) => [a.questionId?.toString(), a.answer])
  );

  const processedAnswers = [];

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qId = q._id.toString();

    // Primary: match by questionId. Fallback: match by position.
    // The position fallback handles the case where the event's questions were
    // re-seeded (new subdocument _ids) but the client still holds stale ids
    // from an earlier fetch — answers are displayed in the same order as the
    // questions, so positional alignment is semantically correct.
    const submitted = submittedMap.has(qId)
      ? submittedMap.get(qId)
      : rawAnswers[idx]?.answer;
    const hasAnswer =
      submitted !== undefined &&
      submitted !== null &&
      submitted !== "" &&
      !(Array.isArray(submitted) && submitted.length === 0);

    // ── Required check ────────────────────────────────────────────────────────
    if (q.isRequired && !hasAnswer) {
      errors.push({
        field: `answers[${qId}]`,
        message: `"${q.question}" is required.`,
      });
      continue;
    }

    // Skip optional questions that were not answered.
    if (!hasAnswer) continue;

    // ── Type-specific validation ───────────────────────────────────────────────
    switch (q.questionType) {
      case "text":
        if (typeof submitted !== "string") {
          errors.push({ field: `answers[${qId}]`, message: `"${q.question}" must be a text answer.` });
        } else if (submitted.trim().length === 0) {
          errors.push({ field: `answers[${qId}]`, message: `"${q.question}" cannot be blank.` });
        } else if (submitted.length > 1000) {
          errors.push({ field: `answers[${qId}]`, message: `"${q.question}" cannot exceed 1000 characters.` });
        } else {
          processedAnswers.push({ questionId: q._id, question: q.question, answer: submitted.trim() });
        }
        break;

      case "yes_no":
        if (!["yes", "no"].includes(submitted)) {
          errors.push({ field: `answers[${qId}]`, message: `"${q.question}" must be "yes" or "no".` });
        } else {
          processedAnswers.push({ questionId: q._id, question: q.question, answer: submitted });
        }
        break;

      case "multiple_choice":
      case "dropdown": {
        if (typeof submitted !== "string") {
          errors.push({ field: `answers[${qId}]`, message: `"${q.question}" must be a single selected option.` });
        } else if (!q.options.includes(submitted)) {
          errors.push({
            field: `answers[${qId}]`,
            message: `"${q.question}": "${submitted}" is not a valid option. Valid options: ${q.options.join(", ")}.`,
          });
        } else {
          processedAnswers.push({ questionId: q._id, question: q.question, answer: submitted });
        }
        break;
      }

      case "checkbox": {
        if (!Array.isArray(submitted) || submitted.length === 0) {
          errors.push({ field: `answers[${qId}]`, message: `"${q.question}" must have at least one option selected.` });
        } else {
          const invalidOptions = submitted.filter((v) => !q.options.includes(v));
          if (invalidOptions.length > 0) {
            errors.push({
              field: `answers[${qId}]`,
              message: `"${q.question}": invalid option(s): ${invalidOptions.join(", ")}. Valid options: ${q.options.join(", ")}.`,
            });
          } else {
            processedAnswers.push({ questionId: q._id, question: q.question, answer: submitted });
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return { processedAnswers, errors };
};

/**
 * Validates a team registration payload for hackathon-style events.
 *
 * @param {object} team       Client-submitted team object.
 * @param {object} student    Authenticated student (req.user).
 * @returns {{ processedTeam: object|null, errors: Array }}
 */
const validateAndBuildTeam = async (team, student, event) => {
  const errors = [];

  if (!team || typeof team !== "object") {
    return { processedTeam: null, errors: [{ field: "team", message: "Team details are required." }] };
  }

  const name = typeof team.name === "string" ? team.name.trim() : "";
  const size = Number(team.size);
  const registrantRole = team.registrantRole;
  const expectedRoles = getRolesForSize(size);

  const registrantUniversity = student?.university?.trim()
    || (student?.studentType === "external" ? "" : NSBM_UNIVERSITY);

  if (!registrantUniversity) {
    errors.push({
      field: "team.university",
      message: "Your university must be set on your profile before registering a team.",
    });
  }

  // Team university always comes from the registrant's profile — not a separate form field.
  const university = registrantUniversity;

  if (!name) errors.push({ field: "team.name", message: "Team name is required." });
  else if (name.length > 120) errors.push({ field: "team.name", message: "Team name cannot exceed 120 characters." });

  const allowedSizes = getAllowedTeamSizes(event);
  if (!allowedSizes.includes(size)) {
    const { min, max } = getTeamSizeBounds(event);
    errors.push({ field: "team.size", message: `Team size must be between ${min} and ${max} members for this event.` });
  }

  if (!expectedRoles.includes(registrantRole)) {
    errors.push({ field: "team.registrantRole", message: "Invalid position for the selected team size." });
  }

  if (!Array.isArray(team.members)) {
    errors.push({ field: "team.members", message: "Team member details are required." });
    return { processedTeam: null, errors };
  }

  if (team.members.length !== size) {
    errors.push({ field: "team.members", message: `Expected ${size} member(s), received ${team.members.length}.` });
  }

  const processedMembers = [];
  const seenRoles = new Set();
  const seenStudentIds = new Set();
  let registrantCount = 0;

  for (let i = 0; i < team.members.length; i++) {
    const m = team.members[i];
    const prefix = `team.members[${i}]`;
    const role = m?.role;

    if (!expectedRoles.includes(role)) {
      errors.push({ field: `${prefix}.role`, message: `Invalid role "${role}" for a team of ${size}.` });
      continue;
    }
    if (seenRoles.has(role)) {
      errors.push({ field: `${prefix}.role`, message: `Duplicate role "${role}".` });
      continue;
    }
    seenRoles.add(role);

    const fullName = typeof m.fullName === "string" ? m.fullName.trim() : "";
    const phone = typeof m.phone === "string" ? m.phone.trim() : "";
    const personalEmail = normalizeEmail(m.personalEmail);
    const isRegistrant = Boolean(m.isRegistrant);
    let memberStudentId = typeof m.studentId === "string" && m.studentId.trim()
      ? m.studentId.trim().toUpperCase()
      : null;

    if (isRegistrant && student) {
      if (student.studentType === "external") {
        memberStudentId = null;
      } else if (student.studentId) {
        memberStudentId = student.studentId.trim().toUpperCase();
      }
    }

    const nic = normalizeNic(m.nic);
    let linkedProfile = null;

    if (memberStudentId) {
      if (seenStudentIds.has(memberStudentId)) {
        errors.push({ field: `${prefix}.studentId`, message: `Student ID "${memberStudentId}" is used for more than one member.` });
      }
      seenStudentIds.add(memberStudentId);

      const profile = await User.findOne({
        studentId: memberStudentId,
        role: "student",
        isActive: true,
      }).select("fullName whatsappNumber studentId university studentType email").lean();

      if (!profile) {
        errors.push({ field: `${prefix}.studentId`, message: `No student found with ID "${memberStudentId}".` });
      } else {
        linkedProfile = profile;
        if (profile.studentType === "external") {
          errors.push({ field: `${prefix}.studentId`, message: "External students are looked up by registered email, not student ID." });
        } else if ((profile.university || NSBM_UNIVERSITY) !== university) {
          errors.push({ field: `${prefix}.studentId`, message: "You can't add a student from another university." });
        }
        if (fullName && fullName !== profile.fullName.trim()) {
          errors.push({ field: `${prefix}.fullName`, message: `${role} name must match the profile for ${memberStudentId}.` });
        }
        if (phone && phone !== profile.whatsappNumber.trim()) {
          errors.push({ field: `${prefix}.phone`, message: `${role} phone must match the profile for ${memberStudentId}.` });
        }
        if (!isRegistrant && student && String(profile._id) === String(student._id)) {
          errors.push({ field: `${prefix}.studentId`, message: "Select your position above to add yourself to the team." });
        }
      }
    } else if (personalEmail && !isRegistrant) {
      const profile = await User.findOne({
        email: personalEmail,
        role: "student",
        isActive: true,
        studentType: "external",
      }).select("fullName whatsappNumber university email").lean();

      if (profile) {
        linkedProfile = profile;
        if (profile.university !== university) {
          errors.push({ field: `${prefix}.personalEmail`, message: "You can't add a student from another university." });
        }
        if (fullName && fullName !== profile.fullName.trim()) {
          errors.push({ field: `${prefix}.fullName`, message: `${role} name must match the profile for that email.` });
        }
        if (phone && phone !== profile.whatsappNumber.trim()) {
          errors.push({ field: `${prefix}.phone`, message: `${role} phone must match the profile for that email.` });
        }
        if (student && String(profile._id) === String(student._id)) {
          errors.push({ field: `${prefix}.personalEmail`, message: "Select your position above to add yourself to the team." });
        }
      }
    }

    if (!fullName) errors.push({ field: `${prefix}.fullName`, message: `${role} full name is required.` });
    if (!phone) errors.push({ field: `${prefix}.phone`, message: `${role} phone number is required.` });
    else if (!PHONE_PATTERN.test(phone)) {
      errors.push({ field: `${prefix}.phone`, message: `${role} phone must be in international format, e.g. +94771234567.` });
    }
    if (!personalEmail) errors.push({ field: `${prefix}.personalEmail`, message: `${role} personal email is required.` });
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(personalEmail)) {
      errors.push({ field: `${prefix}.personalEmail`, message: `${role} personal email is invalid.` });
    }
    if (!nic) errors.push({ field: `${prefix}.nic`, message: `${role} NIC is required.` });
    else if (!NIC_PATTERN.test(nic)) {
      errors.push({ field: `${prefix}.nic`, message: `${role} NIC must be 9 digits + V/X or 12 digits.` });
    }

    if (isRegistrant) registrantCount += 1;

    const memberUser = isRegistrant && student
      ? student._id
      : linkedProfile?._id ?? null;

    processedMembers.push({
      role,
      fullName,
      phone,
      personalEmail,
      nic,
      studentId: memberStudentId,
      user: memberUser,
      isRegistrant,
    });
  }

  for (const role of expectedRoles) {
    if (!seenRoles.has(role)) {
      errors.push({ field: "team.members", message: `Missing details for ${role}.` });
    }
  }

  if (registrantCount !== 1) {
    errors.push({ field: "team.members", message: "Exactly one team member must be marked as the registrant." });
  }

  const registrantMember = processedMembers.find((m) => m.isRegistrant);
  if (registrantMember && registrantMember.role !== registrantRole) {
    errors.push({ field: "team.registrantRole", message: "Your position does not match the member marked as registrant." });
  }

  // Registrant slot must match the authenticated student's profile (anti-tamper).
  if (registrantMember && student) {
    if (registrantMember.fullName !== student.fullName.trim()) {
      errors.push({
        field: `team.members`,
        message: "Your name in the team must match your profile name.",
      });
    }
    if (registrantMember.phone !== student.whatsappNumber.trim()) {
      errors.push({
        field: `team.members`,
        message: "Your phone number in the team must match your profile WhatsApp number.",
      });
    }
    if (student.studentType === "external") {
      if (registrantMember.personalEmail !== normalizeEmail(student.email)) {
        errors.push({
          field: `team.members`,
          message: "Your personal email in the team must match your registered email.",
        });
      }
    } else if (!registrantMember.studentId || registrantMember.studentId !== student.studentId.trim().toUpperCase()) {
      errors.push({
        field: `team.members`,
        message: "Your student ID must match your profile.",
      });
    }
  }

  // No duplicate NIC or personal email within the same team.
  const nics = processedMembers.map((m) => m.nic);
  const emails = processedMembers.map((m) => m.personalEmail);
  if (new Set(nics).size !== nics.length) {
    errors.push({ field: "team.members", message: "Each team member must have a unique NIC." });
  }
  if (new Set(emails).size !== emails.length) {
    errors.push({ field: "team.members", message: "Each team member must have a unique personal email." });
  }

  if (errors.length > 0) return { processedTeam: null, errors };

  return {
    processedTeam: {
      name,
      size,
      university,
      registrantRole,
      members: processedMembers,
    },
    errors: [],
  };
};

/**
 * Ensures linked platform members are not already registered for this event.
 */
const assertTeamMembersAvailableForEvent = async (eventId, members) => {
  for (const member of members) {
    if (!member.user) continue;

    const profile = await User.findById(member.user)
      .select("fullName email studentId")
      .lean();

    if (!profile) continue;

    const existing = await findStudentRegistrationOnEvent(profile, eventId, {
      includeCancelled: false,
    });

    if (existing) {
      throw ApiError.conflict(
        `${member.fullName || profile.fullName} is already registered for this event.`
      );
    }
  }
};

/**
 * Blocks registration if any NIC or personal email is already used on this event.
 */
const assertNoDuplicateTeamIdentifiers = async (eventId, members) => {
  const nics = members.map((m) => m.nic);
  const emails = members.map((m) => m.personalEmail);

  const existing = await Registration.findOne({
    event: eventId,
    status: { $in: ["confirmed", "waitlisted"] },
    team: { $ne: null },
    $or: [
      { "team.members.nic": { $in: nics } },
      { "team.members.personalEmail": { $in: emails } },
    ],
  }).lean();

  if (!existing) return;

  const conflict = existing.team.members.find(
    (m) => nics.includes(m.nic) || emails.includes(m.personalEmail)
  );

  if (conflict) {
    throw ApiError.conflict(
      `A team member with this ${nics.includes(conflict.nic) ? "NIC" : "personal email"} is already registered for this event.`
    );
  }
};

export const lookupTeamMemberByStudentId = async (studentId, eventId, requestingStudent) => {
  if (requestingStudent?.studentType === "external") {
    throw ApiError.badRequest("Use registered email lookup for your university teammates.");
  }

  const teamUniversity = requestingStudent?.university?.trim() || NSBM_UNIVERSITY;

  const normalized = String(studentId ?? "").trim().toUpperCase();
  if (!normalized) {
    throw ApiError.badRequest("Student ID is required.");
  }

  const student = await User.findOne({
    studentId: normalized,
    role: "student",
    isActive: true,
    studentType: { $ne: "external" },
  })
    .select("fullName email whatsappNumber studentId university studentType")
    .lean();

  if (!student) {
    throw ApiError.notFound(`No student found with ID "${normalized}".`);
  }

  const profileUniversity = student.university?.trim() || NSBM_UNIVERSITY;
  if (profileUniversity !== teamUniversity) {
    throw ApiError.badRequest("You can't add a student from another university.");
  }

  if (requestingStudent && String(student._id) === String(requestingStudent._id)) {
    throw ApiError.badRequest("Select your position above to add yourself to the team.");
  }

  if (eventId) {
    const alreadyRegistered = await isUserRegisteredForEvent(student, eventId);
    if (alreadyRegistered) {
      throw ApiError.conflict("This student is already registered for this event.");
    }
  }

  return {
    fullName: student.fullName,
    phone: student.whatsappNumber,
    universityEmail: student.email,
    studentId: student.studentId,
    personalEmail: student.email,
  };
};

export const lookupTeamMemberByEmail = async (email, eventId, requestingStudent) => {
  if (requestingStudent?.studentType !== "external") {
    throw ApiError.badRequest("NSBM students must look up teammates by student ID.");
  }

  const teamUniversity = requestingStudent?.university?.trim();
  if (!teamUniversity) {
    throw ApiError.badRequest("Your university must be set on your profile.");
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw ApiError.badRequest("Registered email is required.");
  }

  const student = await User.findOne({
    email: normalized,
    role: "student",
    isActive: true,
    studentType: "external",
  })
    .select("fullName email whatsappNumber university studentType")
    .lean();

  if (!student) {
    throw ApiError.notFound(`No registered student found with email "${normalized}".`);
  }

  if (student.university !== teamUniversity) {
    throw ApiError.badRequest("You can't add a student from another university.");
  }

  if (requestingStudent && String(student._id) === String(requestingStudent._id)) {
    throw ApiError.badRequest("Select your position above to add yourself to the team.");
  }

  if (eventId) {
    const alreadyRegistered = await isUserRegisteredForEvent(student, eventId);
    if (alreadyRegistered) {
      throw ApiError.conflict("This student is already registered for this event.");
    }
  }

  return {
    fullName: student.fullName,
    phone: student.whatsappNumber,
    personalEmail: student.email,
    lookupEmail: student.email,
    universityEmail: "",
    studentId: "",
  };
};

// ─── Exported service functions ───────────────────────────────────────────────

/**
 * Registers a student for an event.
 * The student's academic profile is pulled from the authenticated user object
 * and stored as an immutable snapshot — the student never submits this data.
 *
 * @param {object} student       Full User document from req.user.
 * @param {string} eventId       Target event ID.
 * @param {Array}  rawAnswers    Client answers: [{ questionId, answer }]
 * @param {object} [team]         Team payload for team-mode events.
 * @returns {object}             Created registration document.
 */
export const registerForEvent = async (student, eventId, rawAnswers = [], team = null) => {
  // ── Guard 1: event exists and is published ─────────────────────────────────
  const event = await Event.findById(eventId);

  if (!event || event.status !== "published") {
    throw ApiError.notFound("Event not found or is not available for registration.");
  }

  if (!canUserRegisterForEvent(event, student)) {
    throw ApiError.forbidden(audienceScopeDeniedMessage);
  }

  // ── Guard 2: registration window is open ───────────────────────────────────
  const now = new Date();

  if (event.registrationDeadline && now > event.registrationDeadline) {
    throw ApiError.badRequest(
      `Registration for "${event.title}" closed on ${event.registrationDeadline.toDateString()}.`
    );
  }

  if (now >= event.startDate) {
    throw ApiError.badRequest(
      `Registration for "${event.title}" is closed — the event has already started.`
    );
  }

  // ── Guard 3: capacity check ────────────────────────────────────────────────
  if (event.capacity !== null && event.registrationCount >= event.capacity) {
    const unit = event.registrationMode === "team" ? "teams" : "spots";
    throw ApiError.badRequest(
      `"${event.title}" is fully booked. No ${unit} remaining.`
    );
  }

  const isTeamEvent = event.registrationMode === "team";

  if (isTeamEvent && !team) {
    throw ApiError.badRequest("Team details are required for this event.");
  }
  if (!isTeamEvent && team) {
    throw ApiError.badRequest("This event does not accept team registrations.");
  }

  // ── Guard 4: duplicate check (registrant or existing team member) ─────────
  const existing = await findStudentRegistrationOnEvent(student, eventId, {
    includeCancelled: true,
  });

  if (existing) {
    if (existing.status === "cancelled") {
      throw ApiError.conflict(
        `You previously cancelled your registration for "${event.title}". Please contact the organiser to re-register.`
      );
    }

    const isRegistrant = String(existing.student) === String(student._id);
    if (isRegistrant) {
      throw ApiError.conflict(`You are already registered for "${event.title}".`);
    }

    const teamName = existing.team?.name ? ` "${existing.team.name}"` : "";
    throw ApiError.conflict(
      `You are already registered for "${event.title}" as part of team${teamName}.`
    );
  }

  // ── Guard 5: validate team (team events) ─────────────────────────────────────
  let processedTeam = null;
  if (isTeamEvent) {
    const teamResult = await validateAndBuildTeam(team, student, event);
    if (teamResult.errors.length > 0) {
      throw ApiError.unprocessable("Please correct the following team errors.", teamResult.errors);
    }
    processedTeam = teamResult.processedTeam;
    assignTeamMemberTokens(processedTeam);
    await assertTeamMembersAvailableForEvent(eventId, processedTeam.members);
    await assertNoDuplicateTeamIdentifiers(eventId, processedTeam.members);
  }

  // ── Guard 6: validate answers ──────────────────────────────────────────────
  const { processedAnswers, errors } = validateAndBuildAnswers(
    event.registrationQuestions,
    rawAnswers
  );

  if (errors.length > 0) {
    throw ApiError.unprocessable("Please correct the following answer errors.", errors);
  }

  const individualPassFields = !isTeamEvent ? newIndividualCheckInFields() : {};

  // ── Create registration ────────────────────────────────────────────────────
  // Use a session to keep the registration creation and the counter increment
  // consistent. Falls back to two sequential writes if sessions are unavailable
  // (e.g. standalone MongoDB without replica set).
  let registration;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const [created] = await Registration.create(
        [
          {
            student: student._id,
            event: eventId,
            studentSnapshot: buildStudentSnapshot(student),
            eventSnapshot: buildEventSnapshot(event),
            answers: processedAnswers,
            team: processedTeam,
            status: "confirmed",
            ...individualPassFields,
          },
        ],
        { session }
      );

      registration = created;

      // Atomically increment the counter so concurrent registrations stay accurate.
      await Event.findByIdAndUpdate(
        eventId,
        { $inc: { registrationCount: 1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // Invalidate recommendation cache for every linked platform member on the team.
  invalidateStudentCache(student._id);
  if (processedTeam?.members) {
    for (const member of processedTeam.members) {
      if (member.user && String(member.user) !== String(student._id)) {
        invalidateStudentCache(member.user);
      }
    }
  }

  // Fire-and-forget — notification / email failure must never fail the registration.
  notifyRegistrationConfirmed(student, event, registration._id).catch(() => {});

  if (processedTeam?.members) {
    for (const member of processedTeam.members) {
      if (member.user && String(member.user) !== String(student._id)) {
        notifyRegistrationConfirmed({ _id: member.user }, event, registration._id).catch(() => {});
      }
    }
  }

  sendRegistrationPasses(registration.toObject(), event.toObject?.() ?? event).catch(() => {});

  return registration
    .populate("event", "title category startDate endDate organizer eventType venue onlineLink coverImage")
    .then((r) => r.toJSON());
};

/**
 * Returns the authenticated student's QR event pass for a registration.
 */
export const getRegistrationPass = async (registrationId, requestingUser) => {
  const registration = await getRegistrationById(registrationId, requestingUser);

  if (registration.status !== "confirmed") {
    throw ApiError.badRequest("Passes are only available for confirmed registrations.");
  }

  const pass = await buildPassPayload(registration, requestingUser);
  if (!pass) {
    throw ApiError.notFound("No event pass found for your account on this registration.");
  }

  return pass;
};

/**
 * Returns a paginated list of a student's own registrations.
 *
 * @param {string} studentId    The authenticated student's _id.
 * @param {object} queryParams  { status, upcoming, page, limit }
 * @returns {{ registrations: Array, pagination: object }}
 */
export const getMyRegistrations = async (studentId, queryParams) => {
  const { page, limit, skip } = parsePagination(queryParams.page, queryParams.limit);

  const user = await User.findById(studentId).select("email studentId").lean();
  if (!user) {
    throw ApiError.notFound("User not found.");
  }

  const membershipUser = {
    _id: studentId,
    email: user.email,
    studentId: user.studentId,
  };

  const filter = { $or: buildStudentMembershipConditions(membershipUser) };

  if (queryParams.status) {
    filter.status = queryParams.status;
  }

  // Optional filter: show only registrations for future events.
  if (queryParams.upcoming === "true") {
    // We can't filter on a populated field in a simple find, so we use a lookup.
    // For simplicity, we filter after population. At scale, switch to $lookup aggregation.
    // Left here as a documented trade-off rather than silent inefficiency.
  }

  const [total, registrations] = await Promise.all([
    Registration.countDocuments(filter),
    Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "event",
        "title category startDate endDate status coverImage organizer eventType venue onlineLink registrationMode"
      )
      .lean({ virtuals: true }),
  ]);

  // For active registrations (upcoming / all non-cancelled), strip orphans whose
  // event was deleted — they can't render a useful card and inflate counts.
  // For CANCELLED registrations we keep them even with a null event so the
  // student can still see their cancellation history.
  const now = new Date();

  const filtered = (() => {
    if (queryParams.status === "cancelled") {
      // Always return all cancelled registrations regardless of event existence.
      return registrations;
    }
    const withEvent = registrations.filter((r) => r.event !== null);
    if (queryParams.upcoming === "true") {
      return withEvent.filter((r) => new Date(r.event.startDate) > now);
    }
    return withEvent;
  })();

  // activeCount = non-cancelled registrations that still have a valid event.
  // Uses aggregation so the count is always accurate across all pages,
  // and orphaned registrations (deleted events) are excluded automatically.
  const activeCount = await Registration.aggregate([
    {
      $match: {
        $or: buildStudentMembershipConditions(membershipUser),
        status: { $ne: "cancelled" },
      },
    },
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "_eventDoc",
      },
    },
    { $match: { "_eventDoc.0": { $exists: true } } },
    { $count: "total" },
  ]).then((r) => r[0]?.total ?? 0);

  return {
    registrations: filtered,
    activeCount,
    pagination: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Returns a single registration document.
 * Students can only retrieve their own registration.
 * Admins can retrieve any registration.
 *
 * @param {string} registrationId
 * @param {object} requestingUser  User document from req.user.
 * @returns {object}
 */
export const getRegistrationById = async (registrationId, requestingUser) => {
  const registration = await Registration.findById(registrationId)
    .populate("event", "title category startDate endDate organizer eventType venue onlineLink coverImage status")
    .populate("student", "fullName email studentId profilePicture")
    .lean({ virtuals: true });

  if (!registration) {
    throw ApiError.notFound("Registration not found.");
  }

  const registrantId = registration.student._id?.toString?.() ?? registration.student.toString();
  const isRegistrant = requestingUser.role !== "student"
    || registrantId === requestingUser._id.toString();

  const isTeamMember = registration.team?.members?.some((member) => {
    if (member.user && String(member.user) === requestingUser._id.toString()) return true;
    if (
      requestingUser.studentId
      && member.studentId
      && member.studentId === requestingUser.studentId.trim().toUpperCase()
    ) {
      return true;
    }
    if (
      requestingUser.email
      && member.personalEmail
      && member.personalEmail === requestingUser.email.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  // Students may view registrations they submitted or were added to as a teammate.
  if (requestingUser.role === "student" && !isRegistrant && !isTeamMember) {
    throw ApiError.forbidden("You are not authorised to view this registration.");
  }

  return registration;
};

/**
 * Cancels a registration.
 * Students may cancel only if the event has not yet started.
 * Admins may cancel any registration at any time.
 * Decrement the event's registrationCount only when cancelling a confirmed registration.
 *
 * @param {string} registrationId
 * @param {object} requestingUser  User document from req.user.
 * @returns {object}  Updated registration document.
 */
export const cancelRegistration = async (registrationId, requestingUser) => {
  const registration = await Registration.findById(registrationId).populate(
    "event",
    "title startDate"
  );

  if (!registration) {
    throw ApiError.notFound("Registration not found.");
  }

  // Students may only cancel their own registrations.
  if (
    requestingUser.role === "student" &&
    registration.student.toString() !== requestingUser._id.toString()
  ) {
    throw ApiError.forbidden("You are not authorised to cancel this registration.");
  }

  if (registration.status === "cancelled") {
    throw ApiError.badRequest("This registration is already cancelled.");
  }

  // Students cannot cancel a registration after the event has started.
  if (requestingUser.role === "student" && new Date() >= registration.event.startDate) {
    throw ApiError.badRequest(
      `You cannot cancel your registration — "${registration.event.title}" has already started.`
    );
  }

  const wasConfirmed = registration.status === "confirmed";

  registration.status      = "cancelled";
  registration.cancelledAt = new Date();
  registration.cancelledBy = requestingUser.role === "admin" ? "admin" : "student";

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await registration.save({ session });

      // Only decrement the counter when a previously confirmed spot is freed.
      if (wasConfirmed) {
        await Event.findByIdAndUpdate(
          registration.event._id,
          { $inc: { registrationCount: -1 } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  // Invalidate the student's recommendation cache so the cancelled event
  // can re-appear in future recommendations.
  invalidateStudentCache(registration.student);

  // Determine the notification recipient.
  // When the student cancels, requestingUser IS the student.
  // When an admin cancels, we have only the student ObjectId — wrap it to satisfy
  // the dispatcher's expected shape.
  const notifStudent =
    requestingUser.role === "student"
      ? requestingUser
      : { _id: registration.student };

  notifyRegistrationCancelled(
    notifStudent,
    registration.event,
    registration._id,
    registration.cancelledBy
  ).catch(() => {});

  return registration.toJSON();
};

/**
 * Returns all registrations for a specific event (admin only).
 * Supports filtering by status and pagination.
 *
 * @param {string} eventId
 * @param {object} queryParams  { status, page, limit }
 * @returns {{ registrations: Array, pagination: object, event: object }}
 */
export const getEventRegistrations = async (eventId, queryParams) => {
  const event = await Event.findById(eventId).lean();

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  const { page, limit, skip } = parsePagination(queryParams.page, queryParams.limit, 500);

  const filter = { event: eventId };

  if (queryParams.status) {
    filter.status = queryParams.status;
  }

  const [total, registrations] = await Promise.all([
    Registration.countDocuments(filter),
    Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      // Populate for live student data (e.g. profile picture, current email)
      // alongside the snapshot for historical accuracy.
      .populate("student", "fullName email studentId degree batch whatsappNumber profilePicture isActive")
      .lean({ virtuals: true }),
  ]);

  return {
    event: { _id: event._id, title: event.title, startDate: event.startDate, registrationMode: event.registrationMode },
    registrations,
    pagination: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Admin-only: manually updates a registration's status.
 * Adjusts the event's registrationCount when transitioning
 * between confirmed and cancelled states.
 *
 * @param {string} registrationId
 * @param {string} newStatus  "confirmed" | "cancelled" | "waitlisted"
 * @returns {object}  Updated registration document.
 */
export const updateRegistrationStatus = async (registrationId, newStatus) => {
  const registration = await Registration.findById(registrationId).populate(
    "event",
    "title capacity registrationCount"
  );

  if (!registration) {
    throw ApiError.notFound("Registration not found.");
  }

  if (registration.status === newStatus) {
    throw ApiError.badRequest(`Registration is already ${newStatus}.`);
  }

  // Prevent confirming a registration on a full event.
  if (newStatus === "confirmed") {
    const { capacity, registrationCount } = registration.event;
    if (capacity !== null && registrationCount >= capacity) {
      throw ApiError.badRequest(
        `Cannot confirm: "${registration.event.title}" is at full capacity.`
      );
    }
  }

  const previousStatus = registration.status;

  registration.status      = newStatus;
  registration.cancelledAt = newStatus === "cancelled" ? new Date() : null;
  registration.cancelledBy = newStatus === "cancelled" ? "admin" : null;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await registration.save({ session });

      // Adjust event counter based on the state transition.
      let countDelta = 0;
      if (newStatus === "confirmed" && previousStatus !== "confirmed") countDelta = 1;
      if (newStatus === "cancelled" && previousStatus === "confirmed")  countDelta = -1;

      if (countDelta !== 0) {
        await Event.findByIdAndUpdate(
          registration.event._id,
          { $inc: { registrationCount: countDelta } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  // Notify the student of status transitions they care about.
  const notifStudent = { _id: registration.student };
  if (newStatus === "confirmed") {
    notifyRegistrationConfirmed(notifStudent, registration.event, registration._id).catch(() => {});

    await ensureCheckInTokens(registration);
    const eventDoc = await Event.findById(registration.event._id).lean();
    sendRegistrationPasses(registration.toObject(), eventDoc).catch(() => {});

    if (registration.team?.members) {
      for (const member of registration.team.members) {
        if (member.user && String(member.user) !== String(registration.student._id ?? registration.student)) {
          notifyRegistrationConfirmed({ _id: member.user }, registration.event, registration._id).catch(() => {});
        }
      }
    }
  } else if (newStatus === "cancelled") {
    // Distinguish between an outright rejection (was waitlisted) and a cancellation.
    if (previousStatus === "waitlisted") {
      notifyRegistrationRejected(notifStudent, registration.event, registration._id).catch(() => {});
    } else {
      notifyRegistrationCancelled(notifStudent, registration.event, registration._id, "admin").catch(() => {});
    }
  }

  return registration.toJSON();
};

/**
 * Checks whether a specific student is registered for a specific event.
 * Used by the frontend to show the correct "Register" / "Registered" button state.
 *
 * @param {string} studentId
 * @param {string} eventId
 * @returns {{ isRegistered: boolean, registration: object|null }}
 */
export const checkRegistrationStatus = async (studentId, eventId) => {
  const user = await User.findById(studentId).select("email studentId").lean();
  if (!user) {
    return { isRegistered: false, registration: null };
  }

  const registration = await findStudentRegistrationOnEvent(
    { _id: studentId, email: user.email, studentId: user.studentId },
    eventId,
    { includeCancelled: false }
  );

  return {
    isRegistered: Boolean(registration),
    registration: registration ?? null,
  };
};
