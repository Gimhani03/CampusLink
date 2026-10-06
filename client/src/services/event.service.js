import api from "./api";

/**
 * GET /events
 * Supports: page, limit, search, category, eventType, status, sort, order
 */
export const getEvents = async (params = {}) => {
  const res = await api.get("/events", { params });
  return res.data.data; // { events, pagination }
};

/**
 * GET /events/:id
 */
export const getEvent = async (id) => {
  const res = await api.get(`/events/${id}`);
  return res.data.data.event;
};

/**
 * POST /events  (multipart/form-data for cover image)
 */
export const createEvent = async (formData) => {
  const res = await api.post("/events", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data.event;
};

/**
 * PUT /events/:id  (multipart/form-data for cover image)
 */
export const updateEvent = async (id, formData) => {
  const res = await api.put(`/events/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data.event;
};

/**
 * DELETE /events/:id
 */
export const deleteEvent = async (id) => {
  await api.delete(`/events/${id}`);
};

/**
 * PATCH /events/:id/publish
 */
export const publishEvent = async (id) => {
  const res = await api.patch(`/events/${id}/publish`);
  return res.data.data.event;
};

/**
 * PATCH /events/:id/unpublish
 * Moves a published event back to draft — hidden from students, data intact.
 */
export const unpublishEvent = async (id) => {
  const res = await api.patch(`/events/${id}/unpublish`);
  return res.data.data.event;
};

/**
 * PATCH /events/:id/cancel
 */
export const cancelEvent = async (id) => {
  const res = await api.patch(`/events/${id}/cancel`);
  return res.data.data.event;
};

/**
 * PATCH /events/:id/complete
 */
export const completeEvent = async (id) => {
  const res = await api.patch(`/events/${id}/complete`);
  return res.data.data.event;
};

/**
 * PATCH /events/:id/feature
 * Toggles the featured flag. The server enforces that only one event is
 * featured at a time — calling this unfeatures all others automatically.
 */
export const toggleFeaturedEvent = async (id) => {
  const res = await api.patch(`/events/${id}/feature`);
  return res.data.data.event;
};

/**
 * GET /events?isFeatured=true&limit=1
 * Returns the currently featured event, or null if none is featured.
 */
export const getFeaturedEvent = async () => {
  const res = await api.get("/events", { params: { isFeatured: true, limit: 1 } });
  return res.data.data.events?.[0] ?? null;
};
