import api from "./api";

/**
 * GET /recommendations
 * Returns personalised scored event recommendations for the current student.
 */
export const getRecommendations = async (params = {}) => {
  const res = await api.get("/recommendations", { params });
  return res.data.data; // { recommendations }
};

/**
 * POST /recommendations/refresh
 * Invalidates the current student's recommendation cache.
 */
export const refreshRecommendations = async () => {
  await api.post("/recommendations/refresh");
};
