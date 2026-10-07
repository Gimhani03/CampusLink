/**
 * Admin Service (client)
 *
 * Thin wrappers around the admin analytics API endpoints.
 * All functions return the unwrapped data (not the full ApiResponse wrapper).
 */

import api from "./api";

/** KPI stats: totals, averages. */
export const getStats = async () => {
  const { data } = await api.get("/admin/stats");
  return data.data.stats;
};

/** 30-day daily registration + events-published trend. */
export const getRegistrationTrend = async () => {
  const { data } = await api.get("/admin/analytics/registration-trend");
  return data.data.trend;
};

/** Top N events by registration count. */
export const getTopEvents = async (limit = 8) => {
  const { data } = await api.get("/admin/analytics/top-events", { params: { limit } });
  return data.data.events;
};

/** Events grouped by category with colours. */
export const getEventsByCategory = async () => {
  const { data } = await api.get("/admin/analytics/by-category");
  return data.data.categories;
};

/** Events created vs published per month (last 12 months). */
export const getMonthlyCreation = async (months = 12) => {
  const { data } = await api.get("/admin/analytics/monthly-creation", { params: { months } });
  return data.data.data;
};
