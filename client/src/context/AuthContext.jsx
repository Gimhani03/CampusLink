/**
 * AuthContext
 *
 * Single source of truth for authentication state.
 *
 * Token strategy:
 *   - Access token: stored in memory (tokenStore.token) for security.
 *     Never written to localStorage or a non-httpOnly cookie.
 *   - Refresh token: httpOnly cookie managed entirely by the server.
 *
 * On first mount the context attempts a silent token refresh so that a
 * user who previously logged in is immediately re-authenticated without
 * seeing the login screen.
 */

import {
  createContext, useContext, useState, useEffect, useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { tokenStore, setOnUnauthorized } from "../services/api";
import * as authService from "../services/auth.service";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true until initial auth check resolves

  // ─── Sync token into the shared store whenever it changes ───────────────

  const setToken = useCallback((token) => {
    tokenStore.token = token ?? null;
  }, []);

  // ─── Register the "force logout" callback for the axios interceptor ──────

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setToken(null);
      navigate("/login", { replace: true });
    });
  }, [navigate, setToken]);

  // ─── Silent re-authentication on page load ────────────────────────────────

  useEffect(() => {
    const tryRestore = async () => {
      try {
        const { accessToken } = await authService.refreshToken();
        setToken(accessToken);
        const me = await authService.getMe();
        setUser(me);
      } catch {
        // No valid refresh token — user must log in.
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    tryRestore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auth actions ─────────────────────────────────────────────────────────

  const login = useCallback(async (email, password) => {
    const { user: loggedInUser, accessToken } = await authService.login(email, password);
    setToken(accessToken);
    setUser(loggedInUser);
    return loggedInUser; // caller can check role for redirect
  }, [setToken]);

  const register = useCallback(async (data) => {
    const { user: newUser, accessToken } = await authService.register(data);
    setToken(accessToken);
    setUser(newUser);
    return newUser;
  }, [setToken]);

  const registerGuest = useCallback(async (data) => {
    const { user: newUser, accessToken } = await authService.registerGuest(data);
    setToken(accessToken);
    setUser(newUser);
    return newUser;
  }, [setToken]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore server errors on logout — always clear client state.
    }
    setUser(null);
    setToken(null);
    navigate("/login", { replace: true });
  }, [navigate, setToken]);

  /**
   * Replaces the user in state with a fully-fresh copy from the server.
   * Call this after any mutation (profile update, avatar upload, interests)
   * so the context always mirrors the database exactly.
   */
  const refreshUser = useCallback(async () => {
    try {
      const me = await authService.getMe();
      setUser(me);
    } catch {
      // Silently ignore — the user will be refreshed on the next page load.
    }
  }, []);

  /** Called after a successful profile update to sync user state globally. */
  const updateUser = useCallback((updatedUser) => {
    // Replace, not merge — the backend always returns the full user document
    // so merging provides no benefit and can leave stale nested values.
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, registerGuest, logout, updateUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
