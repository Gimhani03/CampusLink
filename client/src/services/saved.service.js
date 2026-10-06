import api from "./api";

/**
 * Fetch the current student's saved events.
 * Returns an array of populated event objects.
 */
export const getSavedEvents = async () => {
  const { data } = await api.get("/auth/me/saved");
  return data.data.savedEvents ?? [];
};

/**
 * Toggle save state for an event.
 * Returns { saved: boolean, savedCount: number }.
 */
export const toggleSaved = async (eventId) => {
  const { data } = await api.post(`/auth/me/saved/${eventId}`);
  return data.data;
};
