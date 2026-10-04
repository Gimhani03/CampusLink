/**
 * Admin Controller
 *
 * Thin HTTP adapter for admin-only analytics endpoints.
 * All business logic lives in admin.service.js.
 */

import catchAsync  from "../utils/catchAsync.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as adminService from "../services/admin.service.js";

/** GET /api/v1/admin/stats */
export const getStats = catchAsync(async (_req, res) => {
  const stats = await adminService.getStats();
  res.status(200).json(new ApiResponse(200, { stats }, "Admin stats fetched."));
});

/** GET /api/v1/admin/analytics/registration-trend */
export const getRegistrationTrend = catchAsync(async (_req, res) => {
  const trend = await adminService.getRegistrationTrend();
  res.status(200).json(new ApiResponse(200, { trend }, "Registration trend fetched."));
});

/** GET /api/v1/admin/analytics/top-events */
export const getTopEvents = catchAsync(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 8, 20);
  const events = await adminService.getTopEvents(limit);
  res.status(200).json(new ApiResponse(200, { events }, "Top events fetched."));
});

/** GET /api/v1/admin/analytics/by-category */
export const getEventsByCategory = catchAsync(async (_req, res) => {
  const categories = await adminService.getEventsByCategory();
  res.status(200).json(new ApiResponse(200, { categories }, "Events by category fetched."));
});

/** GET /api/v1/admin/analytics/monthly-creation */
export const getMonthlyCreation = catchAsync(async (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 12, 24);
  const data   = await adminService.getMonthlyCreation(months);
  res.status(200).json(new ApiResponse(200, { data }, "Monthly creation data fetched."));
});
