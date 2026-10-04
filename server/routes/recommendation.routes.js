/**
 * Recommendation routes.
 *
 * Both endpoints require authentication and are restricted to students.
 * Admins do not receive personalised recommendations (they use the full
 * event management dashboard instead).
 *
 *   GET  /          — personalised, scored event recommendations
 *   POST /refresh   — invalidate this student's recommendation cache
 */

import { Router } from "express";

import authenticate from "../middleware/authenticate.js";
import authorize    from "../middleware/authorize.js";

import {
  getRecommendations,
  refreshRecommendations,
} from "../controllers/recommendation.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("student"));

router.get("/", getRecommendations);

router.post("/refresh", refreshRecommendations);

export default router;
