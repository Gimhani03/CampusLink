/**
 * Admin Routes
 *
 * All routes require authentication + "admin" role.
 *
 *   GET /api/v1/admin/stats
 *   GET /api/v1/admin/analytics/registration-trend
 *   GET /api/v1/admin/analytics/top-events
 *   GET /api/v1/admin/analytics/by-category
 *   GET /api/v1/admin/analytics/monthly-creation
 */

import { Router }   from "express";
import authenticate from "../middleware/authenticate.js";
import authorize    from "../middleware/authorize.js";
import {
  getStats,
  getRegistrationTrend,
  getTopEvents,
  getEventsByCategory,
  getMonthlyCreation,
} from "../controllers/admin.controller.js";
import { lookupCheckIn, markCheckIn } from "../controllers/checkIn.controller.js";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/stats",                        getStats);
router.get("/analytics/registration-trend", getRegistrationTrend);
router.get("/analytics/top-events",         getTopEvents);
router.get("/analytics/by-category",        getEventsByCategory);
router.get("/analytics/monthly-creation",   getMonthlyCreation);

router.get("/check-in/:token",  lookupCheckIn);
router.post("/check-in/:token", markCheckIn);

export default router;
