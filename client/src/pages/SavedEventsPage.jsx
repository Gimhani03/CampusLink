/**
 * SavedEventsPage — Student's bookmarked events
 *
 * Features:
 *   ◆ Tab filter — All / Open / Past
 *   ◆ EventCard grid with save toggle
 *   ◆ Syncs with AppContext savedEventIds (unsave removes card instantly)
 *   ◆ Skeleton loaders + empty states
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, AlertCircle, CalendarDays } from "lucide-react";
import { isPast } from "date-fns";

import Navbar      from "../components/layout/Navbar";
import Sidebar     from "../components/layout/Sidebar";
import SearchModal from "../components/dashboard/SearchModal";
import EventCard   from "../components/dashboard/EventCard";
import { useApp }  from "../context/AppContext";
import { getSavedEvents } from "../services/saved.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isRegistrationOpen = (event) => {
  if (!event || event.status !== "published") return false;
  const now = new Date();
  if (event.startDate && new Date(event.startDate) <= now) return false;
  if (event.registrationDeadline && new Date(event.registrationDeadline) <= now) return false;
  return true;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <Card className="overflow-hidden py-0 gap-0">
    <Skeleton className="h-[155px] w-full rounded-none" />
    <CardContent className="p-3.5 space-y-2">
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/5" />
    </CardContent>
  </Card>
);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",  label: "All" },
  { key: "open", label: "Open" },
  { key: "past", label: "Past" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavedEventsPage() {
  const navigate = useNavigate();
  const { savedEventIds, registeredEventIds } = useApp();

  const [tab,     setTab]     = useState("all");
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSavedEvents();
      const valid = (data ?? []).filter(Boolean);
      setEvents(valid);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load saved events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  // Keep list in sync when user unsaves from a card.
  const visibleEvents = useMemo(() => {
    const saved = events.filter((e) => savedEventIds.has(String(e._id)));

    if (tab === "open") {
      return saved.filter(
        (e) => isRegistrationOpen(e) && !registeredEventIds?.has(String(e._id))
      );
    }
    if (tab === "past") {
      return saved.filter(
        (e) => !isRegistrationOpen(e) || registeredEventIds?.has(String(e._id))
      );
    }
    return saved;
  }, [events, savedEventIds, registeredEventIds, tab]);

  const sortedEvents = useMemo(
    () =>
      [...visibleEvents].sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate)
      ),
    [visibleEvents]
  );

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          {/* Header */}
          <div className="px-4 sm:px-8 pt-6 pb-4 flex items-center gap-3 border-b border-border/60">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-orange-500/10 border border-orange-500/20">
              <Bookmark size={18} className="text-orange-700" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-foreground">
                Saved Events
              </h1>
              <p className="text-xs mt-0.5 text-muted-foreground">
                Events you bookmarked to register later
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 sm:px-8 pt-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="rounded-2xl p-1 h-auto bg-card border border-border/60">
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.key}
                    value={t.key}
                    className="px-4 py-2 rounded-xl data-active:bg-primary data-active:text-white"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-8 py-6">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="skel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </motion.div>
              ) : error ? (
                <motion.div
                  key="err"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <AlertCircle size={36} className="mb-3 opacity-40 text-destructive" />
                  <p className="font-semibold text-base text-foreground">
                    Something went wrong
                  </p>
                  <p className="text-sm mt-1 mb-4 text-muted-foreground">{error}</p>
                  <Button variant="secondary" onClick={fetchSaved}>
                    Try again
                  </Button>
                </motion.div>
              ) : sortedEvents.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 bg-orange-500/10 border border-orange-500/15">
                    <Bookmark size={28} className="text-orange-700 opacity-60" />
                  </div>
                  <p className="font-display font-bold text-lg text-foreground">
                    {tab === "all"
                      ? "No saved events yet"
                      : tab === "open"
                      ? "No open saved events"
                      : "No past saved events"}
                  </p>
                  <p className="text-sm mt-2 mb-5 max-w-xs text-muted-foreground">
                    {tab === "all"
                      ? "Tap the bookmark icon on any event to save it for later."
                      : tab === "open"
                      ? "Saved events with open registration will appear here."
                      : "Events whose registration closed or that you've already registered for appear here."}
                  </p>
                  {(tab === "all" || tab === "open") && (
                    <Button variant="gradient" onClick={() => navigate("/events")}>
                      Browse Events
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={`grid-${tab}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                >
                  {sortedEvents.map((event, i) => {
                    const open = isRegistrationOpen(event);
                    const registered = registeredEventIds?.has(String(event._id));
                    const past = event.startDate && isPast(new Date(event.startDate));

                    return (
                      <div key={event._id} className="relative">
                        {(past || !open) && (
                          <Badge
                            className="absolute top-3 left-3 z-10 backdrop-blur-sm"
                            variant={past ? "secondary" : "outline"}
                          >
                            {past ? "Ended" : registered ? "Registered" : "Closed"}
                          </Badge>
                        )}
                        <EventCard event={event} fluid animDelay={i * 0.04} />
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {!loading && !error && sortedEvents.length > 0 && tab === "open" && (
              <Alert className="mt-6 border-border/60 bg-card/50">
                <CalendarDays className="size-4" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Registration deadline reminders are sent to saved events you haven't registered for yet.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
