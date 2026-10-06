/**
 * useNotifications
 *
 * Fetches notifications from the API and subscribes to the SSE stream
 * for real-time updates.
 *
 * SSE events handled:
 *   "notification"    — new notification object pushed by server
 *   "unread_count"    — server sends updated count
 *   "heartbeat"       — keep-alive ping (ignored)
 *   "initial_payload" — server sends current state on connect
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllRead as apiMarkAllRead,
  deleteNotification as apiDelete,
  openNotificationStream,
} from "../services/notification.service";

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const esRef = useRef(null);

  // ─── Initial fetch ────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const [{ notifications: list }, count] = await Promise.all([
        getNotifications({ limit: 30 }),
        getUnreadCount(),
      ]);
      setNotifications(list ?? []);
      setUnreadCount(count ?? 0);
    } catch {
      // silently fail — user sees stale/empty notifications
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ─── SSE stream ───────────────────────────────────────────────────────────

  useEffect(() => {
    const es = openNotificationStream();
    esRef.current = es;

    es.addEventListener("notification", (e) => {
      try {
        const notif = JSON.parse(e.data);
        setNotifications((prev) => [notif, ...prev]);
        setUnreadCount((c) => c + 1);
      } catch { /* ignore malformed */ }
    });

    es.addEventListener("initial_payload", (e) => {
      try {
        const { notifications: list, unreadCount: count } = JSON.parse(e.data);
        if (list)  setNotifications(list);
        if (count !== undefined) setUnreadCount(count);
      } catch { /* ignore */ }
    });

    es.addEventListener("unread_count", (e) => {
      try {
        const { count } = JSON.parse(e.data);
        if (count !== undefined) setUnreadCount(count);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // EventSource auto-reconnects; close if it keeps failing.
      // Browsers handle reconnect automatically — no manual logic needed.
    };

    return () => { es.close(); esRef.current = null; };
  }, []); // mount once

  // ─── Actions ──────────────────────────────────────────────────────────────

  const markAsRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try { await apiMarkAsRead(id); } catch { /* server sync best-effort */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try { await apiMarkAllRead(); } catch { /* best-effort */ }
  }, []);

  const deleteOne = useCallback(async (id) => {
    const target = notifications.find((n) => n._id === id);
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (target && !target.isRead) setUnreadCount((c) => Math.max(0, c - 1));
    try { await apiDelete(id); } catch { /* best-effort */ }
  }, [notifications]);

  return { notifications, unreadCount, isLoading, markAsRead, markAllRead, deleteOne, refetch: fetchNotifications };
};
