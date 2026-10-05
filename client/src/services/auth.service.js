import api from "./api";

/**
 * POST /auth/register
 * Returns { user, accessToken }. Refresh token is set as httpOnly cookie.
 */
export const register = async (data) => {
  const res = await api.post("/auth/register", data);
  return res.data.data;
};

/**
 * POST /auth/register/guest
 * External-university student signup for inter-university hackathons.
 */
export const registerGuest = async (data) => {
  const res = await api.post("/auth/register/guest", data);
  return res.data.data;
};

/**
 * POST /auth/login
 * Returns { user, accessToken }. Refresh token is set as httpOnly cookie.
 */
export const login = async (email, password) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data.data; // { user, accessToken }
};

/**
 * POST /auth/refresh-token
 * Reads the httpOnly refresh cookie. Returns { accessToken }.
 */
export const refreshToken = async () => {
  const res = await api.post("/auth/refresh-token");
  return res.data.data; // { accessToken }
};

/**
 * POST /auth/logout
 * Invalidates the server-side session and clears the cookie.
 */
export const logout = async () => {
  await api.post("/auth/logout");
};

/**
 * GET /auth/me
 * Returns the current authenticated user's profile.
 */
export const getMe = async () => {
  const res = await api.get("/auth/me");
  return res.data.data.user;
};

/**
 * PUT /auth/me
 * Updates mutable profile fields.
 */
export const updateProfile = async (data) => {
  const res = await api.put("/auth/me", data);
  return res.data.data.user;
};

/**
 * PATCH /auth/me/avatar
 * Uploads a new profile picture (multipart/form-data, field: "avatar").
 *
 * Explicitly set Content-Type to "multipart/form-data" here so Axios
 * uses it as the base — the browser XHR will then automatically append
 * the correct boundary string (e.g. "multipart/form-data; boundary=…")
 * when it detects a FormData body. This is the same pattern used by
 * event.service.js createEvent and is known to work in this setup.
 */
export const updateAvatar = async (formData) => {
  const res = await api.patch("/auth/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data.user;
};

/**
 * PATCH /auth/me/password
 * Changes the authenticated user's password.
 */
export const changePassword = async ({ currentPassword, newPassword, confirmNewPassword }) => {
  const res = await api.patch("/auth/me/password", {
    currentPassword,
    newPassword,
    confirmNewPassword,
  });
  return res.data;
};
