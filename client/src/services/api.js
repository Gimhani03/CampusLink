/**
 * api.js — Base Axios instance
 *
 * Features:
 *   - Injects Authorization header from in-memory tokenStore
 *   - On 401: calls /auth/refresh-token (uses httpOnly cookie),
 *     updates the token, and retries the original request once.
 *   - On refresh failure: calls onUnauthorized() to clear auth state
 *     and redirect to /login.
 *   - Queues concurrent 401 failures while a refresh is in-flight
 *     so only one refresh call is made.
 */

import axios from "axios";

// ─── Shared mutable token store (outside React, so interceptors can read it) ──

export const tokenStore = { token: null };

// Callback registered by AuthContext to clear auth state on hard failure.
let onUnauthorized = null;
export const setOnUnauthorized = (fn) => { onUnauthorized = fn; };

// ─── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ─── Request interceptor ───────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (tokenStore.token) {
    config.headers.Authorization = `Bearer ${tokenStore.token}`;
  }
  return config;
});

// ─── Response interceptor — auto-refresh logic ────────────────────────────────

let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't attempt token refresh for auth endpoints — a 401 here means bad credentials.
    const url = original.url ?? "";
    if (
      url.includes("/auth/login")
      || url.includes("/auth/register")
      || url.includes("/auth/refresh-token")
    ) {
      return Promise.reject(error);
    }

    // Queue concurrent failures while a refresh is already running.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry  = true;
    isRefreshing     = true;

    try {
      const { data } = await axios.post(
        "/api/v1/auth/refresh-token",
        {},
        { withCredentials: true }
      );
      const newToken       = data.data.accessToken;
      tokenStore.token     = newToken;
      processQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      tokenStore.token = null;
      onUnauthorized?.();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
