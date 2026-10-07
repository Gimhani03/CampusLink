/**
 * AdminContext
 *
 * Global state for the Admin Dashboard.
 * All data is fetched from the real API — no mock fallbacks.
 *
 * Exposes:
 *   admin              — authenticated admin user from AuthContext
 *   activeSection      — which sidebar section is active
 *   stats              — KPI stat cards
 *   registrationTrend  — 30-day daily registrations/events trend
 *   topEvents          — top-N events by registration count
 *   eventsByCategory   — events grouped by category
 *   monthlyCreation    — events created vs published per month
 *   analyticsLoading   — true while any analytics request is in-flight
 *   events             — full event list (from useEvents)
 *   eventsLoading      — true while events are loading
 *   addEvent / deleteEvent / changeStatus / toggleFeatured — mutations
 *   registrations      — registrations for the selected event
 *   loadRegistrationsForEvent / updateRegistrationStatus
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth }   from "./AuthContext";
import { useEvents } from "../hooks/useEvents";
import * as eventApi   from "../services/event.service";
import * as regApi     from "../services/registration.service";
import * as adminApi   from "../services/admin.service";
import * as channelApi from "../services/channel.service";

const AdminContext = createContext(null);

export const AdminProvider = ({ children }) => {
  const { user } = useAuth();

  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [editingEvent,  setEditingEvent]  = useState(null);

  // ─── Analytics state ────────────────────────────────────────────────────────

  const [stats,             setStats]             = useState(null);
  const [registrationTrend, setRegistrationTrend] = useState([]);
  const [topEvents,         setTopEvents]         = useState([]);
  const [eventsByCategory,  setEventsByCategory]  = useState([]);
  const [monthlyCreation,   setMonthlyCreation]   = useState([]);
  const [analyticsLoading,  setAnalyticsLoading]  = useState(false);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [s, trend, top, cats, monthly] = await Promise.all([
        adminApi.getStats(),
        adminApi.getRegistrationTrend(),
        adminApi.getTopEvents(8),
        adminApi.getEventsByCategory(),
        adminApi.getMonthlyCreation(12),
      ]);
      setStats(s);
      setRegistrationTrend(trend);
      setTopEvents(top);
      setEventsByCategory(cats);
      setMonthlyCreation(monthly);
    } catch (err) {
      console.error("[AdminContext] analytics load failed:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Load analytics once when the user first authenticates (user._id changes).
  // Using user?._id instead of the full user object prevents re-loading every
  // time refreshUser() is called (which creates a new user reference).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) loadAnalytics();
  }, [user?._id]); // intentionally omit loadAnalytics — stable useCallback

  // ─── Events (live) ─────────────────────────────────────────────────────────

  const {
    events: liveEvents,
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useEvents({ limit: 100, status: "all" });

  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!eventsLoading) setEvents(liveEvents);
  }, [liveEvents, eventsLoading]);

  // ─── Registrations (live, per-event) ───────────────────────────────────────

  const [registrations,        setRegistrations]  = useState([]);
  const [regEventId,           setRegEventId]     = useState(null);
  const [registrationsLoading, setRegsLoading]    = useState(false);
  const regLoadSeqRef = useRef(0);

  const loadRegistrationsForEvent = useCallback(async (eventId) => {
    if (!eventId) return;
    const seq = ++regLoadSeqRef.current;
    setRegEventId(eventId);
    setRegistrations([]);
    setRegsLoading(true);
    try {
      const data = await regApi.getEventRegistrations(eventId, { limit: 500 });
      if (seq !== regLoadSeqRef.current) return;
      setRegistrations(data.registrations ?? []);
    } catch (err) {
      if (seq !== regLoadSeqRef.current) return;
      console.error("[AdminContext] registrations load failed:", err);
      setRegistrations([]);
    } finally {
      if (seq === regLoadSeqRef.current) setRegsLoading(false);
    }
  }, []);

  // ─── Event mutations ────────────────────────────────────────────────────────

  const deleteEvent = useCallback(async (id) => {
    setEvents((prev) => prev.filter((e) => e._id !== id));
    try {
      await eventApi.deleteEvent(id);
      loadAnalytics();
    } catch {
      refetchEvents();
    }
  }, [refetchEvents, loadAnalytics]);

  const changeStatus = useCallback(async (id, status) => {
    setEvents((prev) =>
      prev.map((e) => (e._id === id ? { ...e, status } : e))
    );
    try {
      if (status === "published")       await eventApi.publishEvent(id);
      else if (status === "draft")      await eventApi.unpublishEvent(id);
      else if (status === "cancelled")  await eventApi.cancelEvent(id);
      else if (status === "completed")  await eventApi.completeEvent(id);
      loadAnalytics();
    } catch {
      refetchEvents();
    }
  }, [refetchEvents, loadAnalytics]);

  const toggleFeatured = useCallback(async (id) => {
    // Optimistic update: unfeature all others, toggle this one.
    setEvents((prev) => {
      const current = prev.find((e) => e._id === id);
      const willBeFeatured = !current?.isFeatured;
      return prev.map((e) => ({
        ...e,
        isFeatured: e._id === id ? willBeFeatured : willBeFeatured ? false : e.isFeatured,
      }));
    });
    try {
      const updated = await eventApi.toggleFeaturedEvent(id);
      // Sync the authoritative response from the server.
      setEvents((prev) =>
        prev.map((e) => (e._id === id ? { ...e, isFeatured: updated.isFeatured } : e))
      );
    } catch {
      refetchEvents();
    }
  }, [refetchEvents]);

  const addEvent = useCallback(async (formData) => {
    const created = await eventApi.createEvent(formData);
    setEvents((prev) => [created, ...prev]);
    loadAnalytics();
    return created;
  }, [loadAnalytics]);

  const editEvent = useCallback(async (id, formData) => {
    const updated = await eventApi.updateEvent(id, formData);
    setEvents((prev) => prev.map((e) => (e._id === id ? updated : e)));
    loadAnalytics();
    return updated;
  }, [loadAnalytics]);

  // ─── Registration mutations ─────────────────────────────────────────────────

  const updateRegistrationStatus = useCallback(async (id, status) => {
    setRegistrations((prev) =>
      prev.map((r) => (r._id === id ? { ...r, status } : r))
    );
    try {
      await regApi.updateRegistrationStatus(id, status);
    } catch {
      if (regEventId) loadRegistrationsForEvent(regEventId);
    }
  }, [regEventId, loadRegistrationsForEvent]);

  // ─── Channels ───────────────────────────────────────────────────────────────

  const [channels,        setChannels]        = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const data = await channelApi.getChannels({ limit: 100 });
      setChannels(data.channels ?? []);
    } catch (err) {
      console.error("[AdminContext] channels load failed:", err);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  // Same reasoning — only reload when the logged-in user changes identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) loadChannels(); }, [user?._id]); // stable useCallback

  const addChannel = useCallback(async (payload, avatarFile = null) => {
    const ch = await channelApi.createChannel(payload, avatarFile);
    setChannels((prev) => [ch, ...prev]);
    return ch;
  }, []);

  const saveChannel = useCallback(async (id, payload, avatarFile = null) => {
    const ch = await channelApi.updateChannel(id, payload, avatarFile);
    setChannels((prev) => prev.map((c) => (c._id === id ? ch : c)));
    return ch;
  }, []);

  const removeChannel = useCallback(async (id) => {
    setChannels((prev) => prev.filter((c) => c._id !== id));
    try { await channelApi.deleteChannel(id); }
    catch { loadChannels(); }
  }, [loadChannels]);

  // ─── Context value (memoized) ───────────────────────────────────────────────

  const value = useMemo(() => ({
    admin: user,
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen,
    editingEvent,
    setEditingEvent,
    // analytics
    stats,
    registrationTrend,
    topEvents,
    eventsByCategory,
    monthlyCreation,
    analyticsLoading,
    refetchAnalytics: loadAnalytics,
    // events
    events,
    eventsLoading,
    addEvent,
    editEvent,
    deleteEvent,
    toggleFeatured,
    changeStatus,
    refetchEvents,
    // registrations
    registrations,
    registrationsLoading,
    regEventId,
    loadRegistrationsForEvent,
    updateRegistrationStatus,
    // channels
    channels,
    channelsLoading,
    loadChannels,
    addChannel,
    saveChannel,
    removeChannel,
  }), [
    user, activeSection, sidebarOpen, editingEvent,
    stats, registrationTrend, topEvents, eventsByCategory, monthlyCreation,
    analyticsLoading, loadAnalytics,
    events, eventsLoading, addEvent, editEvent, deleteEvent, toggleFeatured, changeStatus, refetchEvents,
    registrations, registrationsLoading, regEventId, loadRegistrationsForEvent, updateRegistrationStatus,
    channels, channelsLoading, loadChannels, addChannel, saveChannel, removeChannel,
  ]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within <AdminProvider>");
  return ctx;
};
