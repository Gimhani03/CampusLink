/**
 * Event Service — core event management business logic.
 *
 * All functions are decoupled from Express (no req/res).
 * The controller passes plain data; this layer returns plain data or throws ApiError.
 *
 * Query pipeline for getAllEvents:
 *   1. Build a MongoDB filter from the validated query params.
 *   2. Build a sort document (text relevance score takes priority when searching).
 *   3. Run countDocuments and find in parallel for performance.
 *   4. Return events + pagination metadata.
 *
 * Image lifecycle:
 *   Create → upload to Cloudinary, store { url, publicId } in DB.
 *   Update → if new image provided: delete old from Cloudinary, upload new.
 *            if no new image: leave existing coverImage unchanged.
 *   Delete → delete Cloudinary asset, then delete DB document.
 *   If DB save fails after a successful Cloudinary upload, the orphaned
 *   Cloudinary asset is cleaned up in the catch block.
 */

import Event        from "../models/Event.model.js";
import Registration from "../models/Registration.model.js";
import ApiError from "../utils/ApiError.js";
import { streamToCloudinary, deleteFromCloudinary } from "../utils/upload.js";
import { sanitizeTeamEventData } from "../utils/teamRegistration.js";
import { parsePagination, buildPaginationMeta } from "../utils/paginate.js";
import { applyAudienceScopeToFilter, canUserViewEvent } from "../utils/eventAudience.js";
import { notifyEventUpdated, notifyEventCancelledToRecipients } from "./notification.service.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Constructs the MongoDB filter document from validated query parameters.
 * Role-awareness: non-admins are always restricted to published events.
 *
 * @param {object}  params
 * @param {boolean} isAdmin
 * @param {object}  [user]  Authenticated user, if any (for audience filtering).
 * @returns {object}  Mongoose filter.
 */
const buildFilterQuery = (params, isAdmin, user = null) => {
  const { search, category, eventType, status, tags, startFrom, startTo, channel, isFeatured } = params;
  const filter = {};

  // ── Full-text search ─────────────────────────────────────────────────────
  if (search) {
    filter.$text = { $search: search };
  }

  // ── Categorical filters ──────────────────────────────────────────────────
  if (category) {
    filter.category = Array.isArray(category)
      ? { $in: category }
      : category;
  }

  if (eventType) {
    filter.eventType = Array.isArray(eventType)
      ? { $in: eventType }
      : eventType;
  }

  // ── Status filter ────────────────────────────────────────────────────────
  // Non-admins can only ever see published events regardless of query params.
  // Admins passing status="all" (or omitting status) see every status.
  if (!isAdmin) {
    filter.status = "published";
  } else if (status && status !== "all") {
    filter.status = Array.isArray(status) ? { $in: status } : status;
  }
  // status === "all"  → no filter, admin sees every status

  // ── Tags filter (any-of match) ───────────────────────────────────────────
  if (tags) {
    const tagArray = Array.isArray(tags)
      ? tags
      : tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tagArray.length > 0) {
      filter.tags = { $in: tagArray };
    }
  }

  // ── Date range filter ────────────────────────────────────────────────────
  if (startFrom || startTo) {
    filter.startDate = {};
    if (startFrom) filter.startDate.$gte = new Date(startFrom);
    if (startTo)   filter.startDate.$lte = new Date(startTo);
  }

  // ── Channel filter ────────────────────────────────────────────────────────
  if (channel) {
    filter.channel = channel;
  }

  // ── Featured filter ───────────────────────────────────────────────────────
  // isFeatured=true  → only featured events (used by Hero)
  // isFeatured=false → only non-featured events (rarely needed)
  if (isFeatured === "true" || isFeatured === true) {
    filter.isFeatured = true;
  } else if (isFeatured === "false" || isFeatured === false) {
    filter.isFeatured = false;
  }

  return applyAudienceScopeToFilter(filter, user, isAdmin);
};

/**
 * Converts a sort query string into a Mongoose sort document.
 * When a text search is active and no explicit sort is requested,
 * results are ranked by relevance score first, then by startDate.
 *
 * @param {string}  sortParam   e.g. "startDate:asc"
 * @param {boolean} hasSearch   Whether $text search is active.
 * @returns {object}
 */
const buildSortQuery = (sortParam, hasSearch) => {
  if (hasSearch && (!sortParam || sortParam === "relevance")) {
    return { score: { $meta: "textScore" }, startDate: 1 };
  }

  const sortMap = {
    "startDate:asc":  { startDate:  1 },
    "startDate:desc": { startDate: -1 },
    "createdAt:asc":  { createdAt:  1 },
    "createdAt:desc": { createdAt: -1 },
    "title:asc":      { title:      1 },
    "title:desc":     { title:     -1 },
  };

  return sortMap[sortParam] || { startDate: 1 };
};

/**
 * Projection used when a text search is active — includes the text score
 * so Mongoose can sort by it. Ignored on non-text queries.
 */
const textScoreProjection = { score: { $meta: "textScore" } };

// ─── Exported service functions ───────────────────────────────────────────────

/**
 * Creates a new event. Optionally uploads a cover image to Cloudinary.
 *
 * @param {object}  data         Validated request body.
 * @param {string}  createdById  Authenticated admin's _id.
 * @param {Buffer}  [imageBuffer] File buffer from Multer (optional).
 * @returns {object}  Created event document.
 */
export const createEvent = async (data, createdById, imageBuffer = null) => {
  let coverImage = { url: "", publicId: "" };

  if (imageBuffer) {
    const uploaded = await streamToCloudinary(imageBuffer, "events/covers", {
      transformation: [
        { width: 1200, height: 630, crop: "fill", gravity: "auto" },
        { quality: "auto:good", fetch_format: "auto" },
      ],
    });
    coverImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
  }

  let event;
  try {
    event = await Event.create({
      ...sanitizeTeamEventData(data),
      coverImage,
      createdBy: createdById,
    });
  } catch (dbError) {
    // Prevent Cloudinary orphan if DB create fails.
    if (coverImage.publicId) {
      await deleteFromCloudinary(coverImage.publicId).catch(() => {});
    }
    throw dbError;
  }

  return event.toJSON();
};

/**
 * Returns a paginated, filtered, searched, and sorted list of events.
 *
 * @param {object}  queryParams  Parsed query string parameters.
 * @param {boolean} isAdmin      Whether the caller is an admin.
 * @returns {{ events: object[], pagination: object }}
 */
export const getAllEvents = async (queryParams, isAdmin = false, user = null) => {
  const { page, limit, skip } = parsePagination(queryParams.page, queryParams.limit);
  const hasSearch = Boolean(queryParams.search?.trim());

  const filter   = buildFilterQuery(queryParams, isAdmin, user);
  const sortDoc  = buildSortQuery(queryParams.sort, hasSearch);
  const projection = hasSearch ? textScoreProjection : {};

  // Run count and find in parallel — halves the DB round-trip time.
  const [total, events] = await Promise.all([
    Event.countDocuments(filter),
    Event.find(filter, projection)
      .sort(sortDoc)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "fullName email profilePicture")
      .lean({ virtuals: true }),
  ]);

  return {
    events,
    pagination: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Returns a single event by ID with the creator populated.
 *
 * @param {string}  eventId
 * @param {boolean} isAdmin  Non-admins cannot view non-published events.
 * @returns {object}
 */
export const getEventById = async (eventId, isAdmin = false, user = null) => {
  const event = await Event.findById(eventId)
    .populate("createdBy", "fullName email profilePicture");

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  if (!canUserViewEvent(event, user, isAdmin)) {
    throw ApiError.notFound("Event not found.");
  }

  return event;
};

/**
 * Updates an existing event. Handles cover image replacement.
 *
 * @param {string}  eventId
 * @param {object}  data          Validated update payload.
 * @param {Buffer}  [imageBuffer] New image buffer (optional).
 * @returns {object}  Updated event document.
 */
export const updateEvent = async (eventId, data, imageBuffer = null) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  let newCoverImage = null;

  if (imageBuffer) {
    // Upload the new image before deleting the old one — keeps the event
    // from being temporarily imageless if the upload fails.
    const uploaded = await streamToCloudinary(imageBuffer, "events/covers", {
      transformation: [
        { width: 1200, height: 630, crop: "fill", gravity: "auto" },
        { quality: "auto:good", fetch_format: "auto" },
      ],
    });
    newCoverImage = { url: uploaded.secure_url, publicId: uploaded.public_id };

    // Delete the old Cloudinary asset only after the new one is secured.
    if (event.coverImage?.publicId) {
      await deleteFromCloudinary(event.coverImage.publicId).catch(() => {});
    }
  }

  // Apply all provided fields to the document.
  Object.assign(event, sanitizeTeamEventData(data));

  if (newCoverImage) {
    event.coverImage = newCoverImage;
  }

  try {
    await event.save();
  } catch (dbError) {
    // Clean up the newly uploaded image if the DB save fails.
    if (newCoverImage?.publicId) {
      await deleteFromCloudinary(newCoverImage.publicId).catch(() => {});
    }
    throw dbError;
  }

  // Notify all confirmed registrants about the update.
  // Pass human-readable changed field names (excluding internal/image fields).
  const notifiableFields = Object.keys(data).filter(
    (k) => !["createdBy", "registrationQuestions", "registrationCount"].includes(k)
  );
  notifyEventUpdated(event, notifiableFields).catch(() => {});

  return event.toJSON();
};

/**
 * Permanently deletes an event and cleans up all associated data.
 * Intended for cancelled events the admin no longer needs in the system.
 *
 *   1. Notifies registrants only if deleting a still-published event
 *      (admin UI should route published → cancel first; this is a safety net).
 *   2. Deletes all Registration documents for this event.
 *   3. Deletes the Cloudinary cover image.
 *   4. Deletes the Event document itself.
 *
 * Cancelled events: no notification — students were already notified on cancel.
 *
 * @param {string} eventId
 */
export const deleteEvent = async (eventId) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  // 1. Notify students who had active registrations before removing anything.
  //    Only relevant if the event was published (draft events have no registrants).
  if (event.status === "published") {
    const affectedRegs = await Registration.find(
      { event: eventId, status: { $in: ["confirmed", "waitlisted"] } },
      { student: 1 }
    ).lean();

    const recipientIds = affectedRegs.map((r) => r.student);
    if (recipientIds.length > 0) {
      notifyEventCancelledToRecipients(event, recipientIds).catch(() => {});
    }
  }

  // 2. Delete all registration records for this event.
  await Registration.deleteMany({ event: eventId });

  // 3. Delete Cloudinary cover image (best-effort).
  if (event.coverImage?.publicId) {
    await deleteFromCloudinary(event.coverImage.publicId).catch(() => {});
  }

  // 4. Delete the event document.
  await Event.findByIdAndDelete(eventId);
};

/**
 * Changes an event's status. Enforces valid state transitions:
 *   draft → published
 *   published → draft | cancelled | completed
 *   cancelled → (no further transitions)
 *   completed → (no further transitions)
 *
 * @param {string} eventId
 * @param {string} newStatus  One of: "draft", "published", "cancelled", "completed".
 * @returns {object}  Updated event document.
 */
export const changeEventStatus = async (eventId, newStatus) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  const VALID_TRANSITIONS = {
    draft:     ["published"],
    published: ["draft", "cancelled", "completed"],
    cancelled: [],
    completed: [],
  };

  if (!VALID_TRANSITIONS[event.status]?.includes(newStatus)) {
    throw ApiError.badRequest(
      `Cannot transition from '${event.status}' to '${newStatus}'.`
    );
  }

  // Use updateOne to change only the status field.
  // Avoids re-running pre-save date validators on already-persisted event data.
  await Event.updateOne({ _id: eventId }, { $set: { status: newStatus } });

  if (newStatus === "cancelled") {
    // Collect recipient IDs BEFORE bulk-cancelling registrations.
    // notifyEventCancelled queries for status:"confirmed" — if we update first
    // it finds nobody and sends no notifications.
    const affectedRegs = await Registration.find(
      { event: eventId, status: { $in: ["confirmed", "waitlisted"] } },
      { student: 1 }
    ).lean();

    const recipientIds = affectedRegs.map((r) => r.student);

    // Bulk-cancel all active registrations so students see "Cancelled"
    // in My Registrations immediately.
    await Registration.updateMany(
      { event: eventId, status: { $in: ["confirmed", "waitlisted"] } },
      { $set: { status: "cancelled" } }
    );

    // Send notifications to the pre-collected recipients (fire-and-forget).
    if (recipientIds.length > 0) {
      notifyEventCancelledToRecipients(event, recipientIds).catch(() => {});
    }
  }

  return { ...event.toJSON(), status: newStatus };
};

/**
 * Marks all published events whose end date has passed as completed.
 * Used by the scheduled auto-complete job.
 *
 * @returns {Promise<{ modifiedCount: number }>}
 */
export const completePastEvents = async () => {
  const result = await Event.updateMany(
    { status: "published", endDate: { $lt: new Date() } },
    { $set: { status: "completed" } }
  );

  return { modifiedCount: result.modifiedCount ?? 0 };
};

/**
 * Adds a registration question to an existing event.
 *
 * @param {string} eventId
 * @param {object} questionData  { question, questionType, isRequired, options }
 * @returns {object}  Updated event document.
 */
export const addRegistrationQuestion = async (eventId, questionData) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  if (event.registrationQuestions.length >= 20) {
    throw ApiError.badRequest("An event can have a maximum of 20 registration questions.");
  }

  event.registrationQuestions.push(questionData);
  await event.save();

  return event.toJSON();
};

/**
 * Removes a single registration question by its sub-document _id.
 *
 * @param {string} eventId
 * @param {string} questionId  The _id of the question sub-document.
 * @returns {object}  Updated event document.
 */
export const removeRegistrationQuestion = async (eventId, questionId) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw ApiError.notFound("Event not found.");
  }

  const question = event.registrationQuestions.id(questionId);

  if (!question) {
    throw ApiError.notFound("Registration question not found.");
  }

  question.deleteOne();
  await event.save();

  return event.toJSON();
};

/**
 * Toggles the featured flag for a single event, ensuring only ONE event
 * can be featured at a time.
 *
 * Algorithm:
 *   1. Load the target event.
 *   2. If it is already featured  → unfeature it (no spotlight event).
 *   3. If it is NOT featured      → clear isFeatured on ALL events first,
 *                                   then set isFeatured on this event.
 * Both writes are run via updateMany + findByIdAndUpdate, which is safe
 * without a transaction for this eventual-consistency use-case.
 *
 * @param {string} eventId
 * @returns {object}  Updated event document.
 */
export const toggleFeatureEvent = async (eventId) => {
  const event = await Event.findById(eventId);
  if (!event) throw ApiError.notFound("Event not found.");

  if (event.isFeatured) {
    // Already featured — simply turn it off.
    event.isFeatured = false;
  } else {
    // Unfeature every other event first (one-to-one invariant).
    await Event.updateMany({ isFeatured: true }, { $set: { isFeatured: false } });
    event.isFeatured = true;
  }

  await event.save();
  return event.toJSON();
};
