/**
 * Registration Controller — HTTP adapter.
 *
 * Reads from req, calls the registration service, writes the response.
 * No business logic lives here.
 *
 * Notice that no controller handler reads student profile fields from req.body.
 * Academic information (fullName, email, studentId, degree, batch, whatsappNumber)
 * is sourced exclusively from req.user, which was populated by the authenticate
 * middleware from the database. The client cannot inject or override it.
 */

import * as registrationService from "../services/registration.service.js";
import ApiResponse from "../utils/ApiResponse.js";

/**
 * POST /api/v1/registrations
 * Student registers for an event.
 * Only eventId and optional answers are accepted from the request body.
 */
export const registerForEvent = async (req, res, next) => {
  try {
    const { eventId, answers = [] } = req.body;

    // req.user is the full student document — academic profile is sourced from here.
    const registration = await registrationService.registerForEvent(
      req.user,
      eventId,
      answers,
      req.body.team ?? null
    );

    res
      .status(201)
      .json(new ApiResponse(201, { registration }, "Successfully registered for the event."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/my
 * Returns the authenticated student's own registrations (paginated).
 *
 * Query params:
 *   status   "confirmed" | "cancelled" | "waitlisted"
 *   upcoming "true" — show only registrations for future events
 *   page     number  (default 1)
 *   limit    number  (default 10, max 50)
 */
export const getMyRegistrations = async (req, res, next) => {
  try {
    const result = await registrationService.getMyRegistrations(
      req.user._id,
      req.query
    );

    res
      .status(200)
      .json(new ApiResponse(200, result, "Registrations fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/:id
 * Returns a single registration.
 * Students see only their own; admins see any.
 */
export const getRegistrationById = async (req, res, next) => {
  try {
    const registration = await registrationService.getRegistrationById(
      req.params.id,
      req.user
    );

    res
      .status(200)
      .json(new ApiResponse(200, { registration }, "Registration fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/:id/pass
 * Returns the authenticated student's QR event pass.
 */
export const getRegistrationPassHandler = async (req, res, next) => {
  try {
    const pass = await registrationService.getRegistrationPass(
      req.params.id,
      req.user
    );

    res
      .status(200)
      .json(new ApiResponse(200, { pass }, "Event pass fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/registrations/:id/cancel
 * Cancels a registration.
 * Students can cancel their own before the event starts.
 * Admins can cancel any at any time.
 */
export const cancelRegistration = async (req, res, next) => {
  try {
    const registration = await registrationService.cancelRegistration(
      req.params.id,
      req.user
    );

    res
      .status(200)
      .json(new ApiResponse(200, { registration }, "Registration cancelled successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/event/:eventId
 * Admin only: returns all registrations for a specific event (paginated).
 *
 * Query params:
 *   status  "confirmed" | "cancelled" | "waitlisted"
 *   page    number  (default 1)
 *   limit   number  (default 20, max 100)
 */
export const getEventRegistrations = async (req, res, next) => {
  try {
    const result = await registrationService.getEventRegistrations(
      req.params.eventId,
      req.query
    );

    res
      .status(200)
      .json(new ApiResponse(200, result, "Event registrations fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/registrations/:id/status
 * Admin only: manually sets a registration's status.
 */
export const updateRegistrationStatus = async (req, res, next) => {
  try {
    const registration = await registrationService.updateRegistrationStatus(
      req.params.id,
      req.body.status
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { registration },
          `Registration status updated to '${req.body.status}'.`
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/check/:eventId
 * Returns whether the authenticated student is already registered for an event.
 * Used by the frontend to render the correct button state without fetching the
 * full registration list.
 */
export const checkRegistrationStatus = async (req, res, next) => {
  try {
    const result = await registrationService.checkRegistrationStatus(
      req.user._id,
      req.params.eventId
    );

    res
      .status(200)
      .json(new ApiResponse(200, result, "Registration status fetched."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/lookup-member/:studentId
 * Looks up a registered student by ID for team registration autofill.
 */
export const lookupTeamMember = async (req, res, next) => {
  try {
    const member = await registrationService.lookupTeamMemberByStudentId(
      req.params.studentId,
      req.query.eventId ?? null,
      req.user
    );

    res
      .status(200)
      .json(new ApiResponse(200, { member }, "Student found."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/registrations/lookup-member-by-email/:email
 * Looks up an external-university student by registered email for team autofill.
 */
export const lookupTeamMemberByEmail = async (req, res, next) => {
  try {
    const member = await registrationService.lookupTeamMemberByEmail(
      req.params.email,
      req.query.eventId ?? null,
      req.user
    );

    res
      .status(200)
      .json(new ApiResponse(200, { member }, "Student found."));
  } catch (error) {
    next(error);
  }
};
