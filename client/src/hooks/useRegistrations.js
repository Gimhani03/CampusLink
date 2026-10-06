/**
 * useRegistrations
 *
 * Manages the current student's registrations.
 * Provides register/cancel actions that optimistically update state.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getMyRegistrations,
  registerForEvent as apiRegister,
  cancelRegistration as apiCancel,
} from "../services/registration.service";

export const useRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [activeCount,   setActiveCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState(null);

  const fetchRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMyRegistrations({ limit: 100 });
      setRegistrations(data.registrations ?? []);
      // activeCount from backend is always accurate (not limited by page size).
      setActiveCount(data.activeCount ?? 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load registrations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegistrations(); }, [fetchRegistrations]);

  const register = useCallback(async (eventId, answers, team = null) => {
    const reg = await apiRegister(eventId, answers, team);
    setRegistrations((prev) => [reg, ...prev]);
    setActiveCount((n) => n + 1);
    return reg;
  }, []);

  const cancel = useCallback(async (registrationId) => {
    const updated = await apiCancel(registrationId);
    setRegistrations((prev) =>
      prev.map((r) => (r._id === registrationId ? updated : r))
    );
    setActiveCount((n) => Math.max(0, n - 1));
  }, []);

  // Memoized so consumers get a stable reference — avoids re-renders on every
  // parent render even when the underlying registrations haven't changed.
  const registeredEventIds = useMemo(
    () =>
      new Set(
        registrations
          .filter((r) => r.status !== "cancelled")
          .map((r) => String(r.event?._id ?? r.event))
      ),
    [registrations]
  );

  return { registrations, activeCount, registeredEventIds, isLoading, error, register, cancel, refetch: fetchRegistrations };
};
