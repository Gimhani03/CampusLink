/**
 * Admin check-in API — QR scan → mark attendance.
 */

import api from "./api";

/** Preview attendee from a scanned token (no side effects). */
export const lookupCheckIn = async (token) => {
  const { data } = await api.get(`/admin/check-in/${encodeURIComponent(token)}`);
  return data.data.attendee;
};

/** Mark attendance for a scanned token. */
export const markCheckIn = async (token) => {
  const { data } = await api.post(`/admin/check-in/${encodeURIComponent(token)}`);
  return data.data;
};
