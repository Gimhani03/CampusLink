/**
 * AppContext
 *
 * Global state for the Student Dashboard.
 * Replaces mock data with live API data from the hooks layer.
 * The context surface is identical to the previous mock version so
 * all dashboard components work without changes.
 *
 * Data sources:
 *   user / student   → AuthContext (already fetched on login / page load)
 *   notifications    → useNotifications hook (REST + SSE)
 *   savedEvents      → useEffect synced from GET /auth/me/saved, toggled via POST /auth/me/saved/:id
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { useRegistrations } from "../hooks/useRegistrations";
import { toggleFollow as apiToggleFollow, getFollowedChannels } from "../services/channel.service";
import { getSavedEvents as apiGetSaved, toggleSaved as apiToggleSaved } from "../services/saved.service";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const { user }  = useAuth();

  const {
    notifications,
    unreadCount,
    markAsRead: markNotificationRead,
    markAllRead,
    deleteOne: deleteNotification,
    refetch: refetchNotifications,
  } = useNotifications();

  const { registrations, activeCount, registeredEventIds, register, cancel } = useRegistrations();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);

  // Saved events — Set of event ID strings, synced from the backend.
  const [savedEventIds, setSavedEventIds] = useState(new Set());

  // Followed channels — seeded from user.followedChannels and kept in sync.
  const [followedChannelIds, setFollowedChannelIds] = useState(
    new Set((user?.followedChannels ?? []).map(String))
  );

  // Sync followed channels and saved events from backend whenever user changes.
  useEffect(() => {
    if (!user) return;
    if (user.studentType === "external") {
      setFollowedChannelIds(new Set());
      apiGetSaved()
        .then((events) => setSavedEventIds(new Set(events.map((e) => String(e._id ?? e)))))
        .catch(() => {});
      return;
    }
    getFollowedChannels()
      .then((chs) => setFollowedChannelIds(new Set(chs.map((c) => String(c._id)))))
      .catch(() => {});
    apiGetSaved()
      .then((events) => setSavedEventIds(new Set(events.map((e) => String(e._id ?? e)))))
      .catch(() => {});
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChannelFollow = useCallback(async (channelId) => {
    // Optimistic update
    const id = String(channelId);
    setFollowedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      return await apiToggleFollow(channelId);
    } catch (e) {
      // Revert on error
      setFollowedChannelIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      throw e;
    }
  }, []);

  // Derived stats — recomputed whenever any source changes so Hero updates
  // instantly after register / save / follow actions.
  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = registrations.filter(
      (r) => r.status !== "cancelled" && r.event?.startDate && new Date(r.event.startDate) > now
    );
    return {
      upcomingRegistrations: upcoming.length,
      // Use backend-sourced activeCount so the number is always exact,
      // even if fewer registrations were loaded on the current page.
      totalRegistrations:    activeCount,
      savedEvents:           savedEventIds.size,
      followedChannels:      followedChannelIds.size,
    };
  }, [registrations, activeCount, savedEventIds, followedChannelIds]);

  const toggleSaved = useCallback(async (eventId) => {
    const id = String(eventId);
    // Optimistic update
    setSavedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await apiToggleSaved(eventId);
    } catch {
      // Revert on error
      setSavedEventIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }, []);

  // Memoised so RecommendedEvents (and other consumers) only re-render when
  // user data or stats genuinely change — not on every unrelated state update
  // (sidebar open, notifications, etc.). This also ensures useEvents in
  // RecommendedEvents re-fires exactly when user.interests changes.
  const student = useMemo(
    () => (user ? { ...user, stats } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, stats]
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), []);
  const openSearch    = useCallback(() => setSearchOpen(true), []);
  const closeSearch   = useCallback(() => setSearchOpen(false), []);

  return (
    <AppContext.Provider
      value={{
        student,
        // Notifications
        notifications,
        unreadCount,
        markNotificationRead,
        markAllRead,
        deleteNotification,
        refetchNotifications,
        // UI state
        sidebarOpen,
        toggleSidebar,
        setSidebarOpen,
        searchOpen,
        openSearch,
        closeSearch,
        // Saved events
        savedEventIds,
        toggleSaved,
        // Channels
        followedChannelIds,
        toggleChannelFollow,
        // Registrations — exposed so child components can register/cancel
        // without each needing their own hook instance.
        registrations,
        registeredEventIds,
        register,
        cancelRegistration: cancel,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
};
