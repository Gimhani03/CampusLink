import api from "./api";
import { tokenStore } from "./api";

/**
 * GET /notifications
 */
export const getNotifications = async (params = {}) => {
  const res = await api.get("/notifications", { params });
  return res.data.data; // { notifications, pagination }
};

/**
 * GET /notifications/unread-count
 */
export const getUnreadCount = async () => {
  const res = await api.get("/notifications/unread-count");
  return res.data.data.count;
};

/**
 * PATCH /notifications/:id/read
 */
export const markAsRead = async (id) => {
  await api.patch(`/notifications/${id}/read`);
};

/**
 * PATCH /notifications/read-all
 */
export const markAllRead = async () => {
  await api.patch("/notifications/read-all");
};

/**
 * DELETE /notifications/:id
 */
export const deleteNotification = async (id) => {
  await api.delete(`/notifications/${id}`);
};

/**
 * POST /notifications/admin/announce  (admin)
 */
export const sendAnnouncement = async (data) => {
  const res = await api.post("/notifications/admin/announce", data);
  return res.data;
};

/**
 * openNotificationStream
 *
 * Opens a native EventSource to the SSE endpoint.
 * Passes the current access token as a query param (supported by
 * the authenticate middleware) since EventSource cannot set headers.
 *
 * Returns the EventSource instance — caller is responsible for closing it.
 *
 * @returns {EventSource}
 */
export const openNotificationStream = () => {
  const token = tokenStore.token;
  const url   = token
    ? `/api/v1/notifications/stream?token=${encodeURIComponent(token)}`
    : "/api/v1/notifications/stream";
  return new EventSource(url);
};
