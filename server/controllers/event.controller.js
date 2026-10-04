/**
 * Event Controller — HTTP request/response adapter.
 *
 * Each handler follows the same three-step pattern:
 *   1. Extract and normalise data from req (body, params, query, file).
 *   2. Delegate all business logic to the event service.
 *   3. Write the HTTP response.
 *
 * Multipart form data note:
 *   When the request is multipart/form-data (image upload), all body
 *   fields arrive as strings. parseBodyFields() normalises types before
 *   they reach the service. For pure JSON requests, this normalisation
 *   is a no-op since express.json() already typed the values.
 */

import * as eventService from "../services/event.service.js";
import ApiResponse from "../utils/ApiResponse.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Normalises multipart form-data fields into the types the service expects.
 * Called on both create and update to centralise the parsing logic.
 *
 * @param {object} body  req.body (strings when multipart, typed when JSON).
 * @returns {object}     Normalised field map.
 */
const parseBodyFields = (body) => {
  const fields = { ...body };

  // capacity: "50" → 50  |  "" or undefined → null (unlimited)
  if (fields.capacity !== undefined) {
    fields.capacity = fields.capacity === "" || fields.capacity === null
      ? null
      : parseInt(fields.capacity, 10);
  }

  for (const key of ["minTeamSize", "maxTeamSize"]) {
    if (fields[key] !== undefined) {
      fields[key] = fields[key] === "" || fields[key] === null
        ? null
        : parseInt(fields[key], 10);
    }
  }

  // tags: "music,tech" → ["music","tech"]  |  already an array → pass through
  if (fields.tags && typeof fields.tags === "string") {
    try {
      fields.tags = JSON.parse(fields.tags);
    } catch {
      fields.tags = fields.tags.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  // registrationQuestions: JSON string from multipart → array of objects
  if (fields.registrationQuestions && typeof fields.registrationQuestions === "string") {
    try {
      fields.registrationQuestions = JSON.parse(fields.registrationQuestions);
    } catch {
      fields.registrationQuestions = [];
    }
  }

  // isFeatured: "true" / "false" string → boolean
  if (typeof fields.isFeatured === "string") {
    fields.isFeatured = fields.isFeatured === "true";
  }

  // venue: JSON string from multipart → object
  if (fields.venue && typeof fields.venue === "string") {
    try {
      fields.venue = JSON.parse(fields.venue);
    } catch {
      fields.venue = undefined;
    }
  }

  // Dates: ISO strings are fine for Mongoose, no conversion needed.

  // channel: empty string → null
  if (fields.channel === "") {
    fields.channel = null;
  }

  return fields;
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/events
 * Creates a new event (admin only). Accepts optional cover image upload.
 */
export const createEvent = async (req, res, next) => {
  try {
    const data = parseBodyFields(req.body);
    const imageBuffer = req.file?.buffer ?? null;

    const event = await eventService.createEvent(data, req.user._id, imageBuffer);

    res.status(201).json(new ApiResponse(201, { event }, "Event created successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/events
 * Returns a paginated list of events.
 * Authenticated admins can filter by any status; all others see published only.
 *
 * Query params:
 *   search       string    Full-text search term.
 *   category     string    Filter by category (repeatable for OR).
 *   eventType    string    Filter by event type.
 *   status       string    Admin only — filter by status.
 *   tags         string    Comma-separated tag list.
 *   startFrom    ISO date  Events starting on or after this date.
 *   startTo      ISO date  Events starting on or before this date.
 *   channel      MongoId   Filter by channel.
 *   page         number    Page number (default 1).
 *   limit        number    Results per page (default 10, max 50).
 *   sort         string    One of: startDate:asc, startDate:desc,
 *                          createdAt:asc, createdAt:desc,
 *                          title:asc, title:desc, relevance.
 */
export const getAllEvents = async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const result = await eventService.getAllEvents(req.query, isAdmin, req.user ?? null);

    // Admin responses must never be served from browser cache because
    // admins see all statuses — a cached student (published-only) response
    // would silently hide draft/cancelled events.
    if (isAdmin) res.set("Cache-Control", "no-store");

    res.status(200).json(
      new ApiResponse(200, result, "Events fetched successfully.")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/events/:id
 * Returns a single event. Non-admins cannot view non-published events.
 */
export const getEventById = async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const event = await eventService.getEventById(req.params.id, isAdmin, req.user ?? null);

    res.status(200).json(new ApiResponse(200, { event }, "Event fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/events/:id
 * Updates an existing event (admin only). Replaces cover image if a new file is provided.
 */
export const updateEvent = async (req, res, next) => {
  try {
    const data = parseBodyFields(req.body);
    const imageBuffer = req.file?.buffer ?? null;

    const event = await eventService.updateEvent(req.params.id, data, imageBuffer);

    res.status(200).json(new ApiResponse(200, { event }, "Event updated successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/events/:id
 * Permanently deletes an event and its Cloudinary cover image (admin only).
 */
export const deleteEvent = async (req, res, next) => {
  try {
    await eventService.deleteEvent(req.params.id);

    res.status(200).json(new ApiResponse(200, null, "Event deleted successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/events/:id/publish
 * Transitions an event from 'draft' → 'published' (admin only).
 */
export const publishEvent = async (req, res, next) => {
  try {
    const event = await eventService.changeEventStatus(req.params.id, "published");

    res.status(200).json(new ApiResponse(200, { event }, "Event published successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/events/:id/unpublish
 * Moves a published event back to 'draft' so it is hidden from students
 * while the admin makes corrections. No cancellation notifications are sent.
 */
export const unpublishEvent = async (req, res, next) => {
  try {
    const event = await eventService.changeEventStatus(req.params.id, "draft");

    res.status(200).json(new ApiResponse(200, { event }, "Event moved back to draft."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/events/:id/cancel
 * Transitions an event from 'published' → 'cancelled' (admin only).
 */
export const cancelEvent = async (req, res, next) => {
  try {
    const event = await eventService.changeEventStatus(req.params.id, "cancelled");

    res.status(200).json(new ApiResponse(200, { event }, "Event cancelled successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/events/:id/complete
 * Transitions an event from 'published' → 'completed' (admin only).
 */
export const completeEvent = async (req, res, next) => {
  try {
    const event = await eventService.changeEventStatus(req.params.id, "completed");

    res.status(200).json(new ApiResponse(200, { event }, "Event marked as completed."));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/events/:id/feature
 * Toggles the featured flag for one event.
 * Only ONE event can be featured at a time — when an event is featured, every
 * other event's isFeatured flag is cleared atomically in the same write.
 * If the event is already featured, it is simply unfeatured (no spotlight).
 */
export const toggleFeatureEvent = async (req, res, next) => {
  try {
    const event = await eventService.toggleFeatureEvent(req.params.id);

    res.status(200).json(
      new ApiResponse(200, { event }, event.isFeatured ? "Event is now featured." : "Event unfeatured.")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/events/:id/questions
 * Adds a registration question to an event (admin only).
 */
export const addRegistrationQuestion = async (req, res, next) => {
  try {
    const event = await eventService.addRegistrationQuestion(req.params.id, req.body);

    res.status(201).json(
      new ApiResponse(201, { event }, "Registration question added successfully.")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/events/:id/questions/:questionId
 * Removes a single registration question from an event (admin only).
 */
export const removeRegistrationQuestion = async (req, res, next) => {
  try {
    const event = await eventService.removeRegistrationQuestion(
      req.params.id,
      req.params.questionId
    );

    res.status(200).json(
      new ApiResponse(200, { event }, "Registration question removed successfully.")
    );
  } catch (error) {
    next(error);
  }
};
