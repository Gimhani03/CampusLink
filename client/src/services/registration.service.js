import api from "./api";

/**
 * POST /registrations
 * Student registers for an event.
 */
export const registerForEvent = async (eventId, answers = [], team = null) => {
  const payload = { eventId, answers };
  if (team) payload.team = team;
  const res = await api.post("/registrations", payload);
  return res.data.data.registration;
};

/**
 * GET /registrations/my
 * Student's own registrations.
 */
export const getMyRegistrations = async (params = {}) => {
  const res = await api.get("/registrations/my", { params });
  return res.data.data; // { registrations, pagination }
};

/**
 * GET /registrations/lookup-member/:studentId?eventId=
 * Finds a student profile for team registration autofill.
 */
export const lookupTeamMember = async (studentId, eventId) => {
  const res = await api.get(`/registrations/lookup-member/${encodeURIComponent(studentId)}`, {
    params: eventId ? { eventId } : undefined,
  });
  return res.data.data.member;
};

/**
 * GET /registrations/lookup-member-by-email/:email?eventId=
 * Finds an external-university student for team registration autofill.
 */
export const lookupTeamMemberByEmail = async (email, eventId) => {
  const res = await api.get(`/registrations/lookup-member-by-email/${encodeURIComponent(email)}`, {
    params: eventId ? { eventId } : undefined,
  });
  return res.data.data.member;
};

/**
 * GET /registrations/check/:eventId
 */
export const checkRegistration = async (eventId) => {
  const res = await api.get(`/registrations/check/${eventId}`);
  return res.data.data; // { isRegistered, registration }
};

/**
 * PATCH /registrations/:id/cancel
 */
export const cancelRegistration = async (id) => {
  const res = await api.patch(`/registrations/${id}/cancel`);
  return res.data.data.registration;
};

/**
 * GET /registrations/event/:eventId  (admin)
 */
export const getEventRegistrations = async (eventId, params = {}) => {
  const res = await api.get(`/registrations/event/${eventId}`, { params });
  return res.data.data; // { registrations, pagination }
};

/**
 * PATCH /registrations/:id/status  (admin)
 */
export const updateRegistrationStatus = async (id, status) => {
  const res = await api.patch(`/registrations/${id}/status`, { status });
  return res.data.data.registration;
};

/**
 * GET /registrations/:id/pass
 * Student's QR event pass for a registration.
 */
export const getRegistrationPass = async (id) => {
  const res = await api.get(`/registrations/${id}/pass`);
  return res.data.data.pass;
};
