/**
 * useEvents
 *
 * Fetches the event list from the API with optional query params.
 * Falls back to an empty array on error so UI is never broken.
 */

import { useState, useEffect, useCallback } from "react";
import { getEvents } from "../services/event.service";

export const useEvents = (params = {}) => {
  const [events,     setEvents]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState(null);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEvents(params);
      setEvents(data.events ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load events.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, pagination, isLoading, error, refetch: fetchEvents };
};
