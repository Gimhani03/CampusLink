/**
 * Recommendation Controller — HTTP adapter.
 *
 * Exposes two endpoints:
 *   GET  /api/v1/recommendations          — personalised recommendations
 *   POST /api/v1/recommendations/refresh  — force-refresh the cache for
 *                                           the current student (useful after
 *                                           they update their interests)
 */

import * as recommendationService from "../services/recommendation.service.js";
import ApiResponse from "../utils/ApiResponse.js";

/**
 * GET /api/v1/recommendations
 * Returns personalised event recommendations ordered by relevance score.
 *
 * Query params:
 *   page     number   Page number (default 1).
 *   limit    number   Results per page (default 10, max 50).
 *   refresh  "true"   Bypass the cache and recompute from scratch.
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const result = await recommendationService.getRecommendations(
      req.user,
      req.query
    );

    res
      .status(200)
      .json(new ApiResponse(200, result, "Recommendations fetched successfully."));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/recommendations/refresh
 * Invalidates the cached recommendations for the current student.
 * The next GET request will recompute them from scratch.
 * Called by the frontend after the student updates their interests.
 */
export const refreshRecommendations = async (req, res, next) => {
  try {
    recommendationService.invalidateStudentCache(req.user._id);

    res
      .status(200)
      .json(new ApiResponse(200, null, "Recommendation cache cleared. Fetch /recommendations to get fresh results."));
  } catch (error) {
    next(error);
  }
};
