/**
 * CalendarPage — Student Event Calendar
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CalendarDays, Clock,
  MapPin, Monitor, Tag, CheckCircle2, Calendar, Users, LayoutGrid,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, isAfter, addDays
} from "date-fns";

import Navbar      from "../components/layout/Navbar";
import Sidebar     from "../components/layout/Sidebar";
import SearchModal from "../components/dashboard/SearchModal";
import { getEvents } from "../services/event.service";
import { useApp }    from "../context/AppContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const CAT_COLORS = {
  technology:  { dot: "bg-sky-600",    bg: "bg-sky-50",    text: "text-sky-800"    },
  academic:    { dot: "bg-primary", bg: "bg-primary/10", text: "text-primary" },
  career:      { dot: "bg-orange-600", bg: "bg-orange-50", text: "text-orange-800" },
  cultural:    { dot: "bg-purple-600", bg: "bg-purple-50", text: "text-purple-800" },
  sports:      { dot: "bg-emerald-600", bg: "bg-emerald-50", text: "text-emerald-800" },
  social:      { dot: "bg-fuchsia-600", bg: "bg-fuchsia-50", text: "text-fuchsia-800" },
  competition: { dot: "bg-red-600", bg: "bg-red-50", text: "text-red-800" },
  religious:   { dot: "bg-orange-700", bg: "bg-orange-50", text: "text-orange-900" },
  other:       { dot: "bg-slate-500", bg: "bg-slate-100", text: "text-slate-700" },
};
const catStyle = (cat) => CAT_COLORS[cat] ?? CAT_COLORS.other;

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GridSkeleton = () => (
  <div className="grid grid-cols-7 gap-px bg-border/60">
    {Array.from({ length: 35 }).map((_, i) => (
      <div key={i} className="h-20 p-2 bg-background">
        <Skeleton className="w-6 h-3 mb-2" />
        <Skeleton className="w-full h-3" />
      </div>
    ))}
  </div>
);

const EventPill = ({ event, isRegistered }) => {
  const navigate = useNavigate();
  const c = catStyle(event.category);
  return (
    <Button
      variant="ghost"
      onClick={(e) => { e.stopPropagation(); navigate(`/events/${event._id}`); }}
      className={cn(
        "w-full justify-start h-auto px-1.5 py-0.5 text-[10px] font-semibold rounded truncate leading-4",
        isRegistered ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : cn(c.bg, c.text)
      )}
    >
      {isRegistered && "✓ "}
      {format(parseISO(event.startDate), "HH:mm")} {event.title}
    </Button>
  );
};

const DayCell = ({ date, currentMonth, events, registeredEventIds, isSelected, onClick }) => {
  const inMonth  = isSameMonth(date, currentMonth);
  const isT      = isToday(date);
  const MAX_PILLS = 2;
  const overflow  = events.length - MAX_PILLS;

  return (
    <div
      onClick={() => onClick(date)}
      className={cn(
        "relative min-h-20 p-1.5 cursor-pointer select-none transition-colors bg-background hover:bg-muted/50",
        isSelected && "bg-primary/12 ring-[1.5px] ring-primary/50 ring-inset",
        !inMonth && "opacity-35"
      )}
    >
      <div className="flex justify-end mb-1">
        <span className={cn(
          "size-6 flex items-center justify-center rounded-full text-xs font-bold",
          isT && "bg-primary text-white",
          !isT && isSelected && "text-primary font-bold",
          !isT && !isSelected && inMonth && "text-muted-foreground",
          !isT && !isSelected && !inMonth && "text-muted-foreground/60"
        )}>
          {format(date, "d")}
        </span>
      </div>

      <div className="space-y-0.5">
        {events.slice(0, MAX_PILLS).map((ev) => (
          <EventPill key={ev._id} event={ev} isRegistered={registeredEventIds.has(ev._id)} />
        ))}
        {overflow > 0 && (
          <p className="text-[10px] pl-1.5 font-medium text-muted-foreground">+{overflow} more</p>
        )}
      </div>
    </div>
  );
};

const DayPanel = ({ date, events, registeredEventIds }) => {
  const navigate = useNavigate();

  if (!date) return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <Calendar size={36} className="mb-3 opacity-20 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">Select a day to see events</p>
    </div>
  );

  return (
    <div>
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <p className="text-xs font-semibold uppercase tracking-widest mb-0.5 text-muted-foreground">{format(date, "EEEE")}</p>
        <h3 className="font-display font-black text-2xl text-foreground">{format(date, "MMMM d, yyyy")}</h3>
        <p className="text-xs mt-1 text-muted-foreground">
          {events.length === 0 ? "No events scheduled" : `${events.length} event${events.length > 1 ? "s" : ""} scheduled`}
        </p>
      </div>

      <ScrollArea className="max-h-[calc(100vh-280px)]">
        <div className="px-4 py-4 space-y-3">
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CalendarDays size={28} className="mb-3 opacity-20 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Free day — nothing scheduled!</p>
            </div>
          ) : (
            events.map((ev) => {
              const c = catStyle(ev.category);
              const isReg = registeredEventIds.has(ev._id);
              const isOnline = ev.eventType === "online" || ev.eventType === "hybrid";
              const location = ev.venue?.name || (ev.onlineLink ? "Online" : "TBA");

              return (
                <motion.div key={ev._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="overflow-hidden cursor-pointer py-0 gap-0 hover:border-border transition-colors" onClick={() => navigate(`/events/${ev._id}`)}>
                    <div className={cn("h-0.5 w-full", isReg ? "bg-emerald-400" : c.dot)} />
                    <CardContent className="p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-display font-bold text-sm leading-tight text-foreground">{ev.title}</p>
                        {isReg && (
                          <Badge variant="outline" className="shrink-0 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25 gap-1">
                            <CheckCircle2 size={9} /> Registered
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} />
                          <span>{format(parseISO(ev.startDate), "h:mm a")}{ev.endDate && ` – ${format(parseISO(ev.endDate), "h:mm a")}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isOnline ? <Monitor size={11} /> : <MapPin size={11} />}
                          <span className="truncate">{location}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Tag size={11} />
                          <span className={cn("capitalize font-semibold", c.text)}>{ev.category}</span>
                        </div>
                        {ev.capacity && (
                          <div className="flex items-center gap-1.5">
                            <Users size={11} />
                            <span>{ev.registrationCount ?? 0} / {ev.capacity} registered</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const UpcomingList = ({ registrations }) => {
  const navigate = useNavigate();
  const now = new Date();
  const items = registrations
    .filter((r) => r.status !== "cancelled" && r.event?.startDate && isAfter(parseISO(r.event.startDate), now))
    .sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate))
    .slice(0, 7);

  return (
    <div className="px-4 py-4">
      <h4 className="text-xs font-semibold uppercase tracking-widest mb-3 text-muted-foreground">Your Upcoming Events</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No upcoming registrations.</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const ev = r.event;
            const c = catStyle(ev.category);
            return (
              <Button key={r._id} variant="outline" onClick={() => navigate(`/events/${ev._id}`)}
                className="w-full h-auto justify-start gap-3 px-3 py-2.5">
                <div className={cn("size-2 rounded-full shrink-0", c.dot)} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-semibold line-clamp-1 text-foreground">{ev.title}</p>
                  <p className="text-[11px] mt-0.5 text-muted-foreground">{format(parseISO(ev.startDate), "EEE, d MMM · h:mm a")}</p>
                </div>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function CalendarPage() {
  const { registrations } = useApp();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("month");

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfWeek(startOfMonth(currentMonth));
      const end = endOfWeek(endOfMonth(currentMonth));
      const data = await getEvents({
        status: "published",
        startFrom: start.toISOString(),
        startTo: end.toISOString(),
        limit: 200,
      });
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev.startDate) continue;
      const key = format(parseISO(ev.startDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [events]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(key) ?? [];
  }, [selectedDate, eventsByDate]);

  const regIds = useMemo(() => {
    const ids = new Set();
    for (const r of registrations) {
      if (r.status !== "cancelled") {
        const id = r.event?._id ?? r.event;
        if (id) ids.add(String(id));
      }
    }
    return ids;
  }, [registrations]);

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <div className="px-4 sm:px-8 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                  <CalendarDays size={18} className="text-primary" />
                </div>
                <div>
                  <h1 className="font-display font-black text-xl text-foreground">Calendar</h1>
                  <p className="text-xs mt-0.5 text-muted-foreground">All events · your registrations highlighted</p>
                </div>
              </div>

              <Tabs value={view} onValueChange={setView}>
                <TabsList className="rounded-xl p-1 h-auto bg-card border border-border/60">
                  {[{ k: "month", Icon: LayoutGrid, label: "Month" }, { k: "list", Icon: CalendarDays, label: "List" }].map(({ k, Icon, label }) => (
                    <TabsTrigger key={k} value={k} className="gap-1.5 px-3 py-1.5 text-xs rounded-lg data-active:bg-primary data-active:text-white">
                      <Icon size={13} /> {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="px-4 sm:px-8 pt-5">
            {view === "month" ? (
              <div className="flex gap-5 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon-sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                        <ChevronLeft size={15} />
                      </Button>
                      <h2 className="font-display font-black text-lg w-40 text-center text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
                      <Button variant="outline" size="icon-sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                        <ChevronRight size={15} />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
                      Today
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 mb-px border-b border-border/60">
                    {DAYS_OF_WEEK.map((d) => (
                      <div key={d} className="pb-2 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">{d}</div>
                    ))}
                  </div>

                  {loading ? <GridSkeleton /> : (
                    <div className="grid grid-cols-7 gap-px bg-border/60 rounded-b-2xl overflow-hidden">
                      {calendarDays.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const evs = eventsByDate.get(key) ?? [];
                        return (
                          <DayCell
                            key={key}
                            date={day}
                            currentMonth={currentMonth}
                            events={evs}
                            registeredEventIds={regIds}
                            isSelected={selectedDate && isSameDay(day, selectedDate)}
                            onClick={(d) => setSelectedDate(d)}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-primary" />All events</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-emerald-400" />You're registered</span>
                  </div>
                </div>

                <Card className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 py-0 gap-0 overflow-hidden">
                  <DayPanel date={selectedDate} events={selectedDateEvents} registeredEventIds={regIds} />
                  <Separator />
                  <UpcomingList registrations={registrations} />
                </Card>

                {selectedDate && (
                  <Card className="lg:hidden mt-4 py-0 gap-0 overflow-hidden w-full">
                    <DayPanel date={selectedDate} events={selectedDateEvents} registeredEventIds={regIds} />
                  </Card>
                )}
              </div>
            ) : (
              <ListView events={events} registeredEventIds={regIds} loading={loading} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ListView({ events, registeredEventIds, loading }) {
  const navigate = useNavigate();
  const now = new Date();

  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const map = new Map();
    for (const ev of sorted) {
      if (!ev.startDate) continue;
      const d = parseISO(ev.startDate);
      const key = format(d, "yyyy-MM-dd");
      let label;
      if (isSameDay(d, now)) label = "Today";
      else if (isSameDay(d, addDays(now, 1))) label = "Tomorrow";
      else label = format(d, "EEEE, MMMM d");
      if (!map.has(key)) map.set(key, { label, events: [] });
      map.get(key).events.push(ev);
    }
    return [...map.values()];
  }, [events, now]);

  if (loading) return (
    <div className="space-y-4 pb-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ))}
    </div>
  );

  if (groups.length === 0) return (
    <div className="flex flex-col items-center py-24 text-center">
      <CalendarDays size={36} className="mb-3 opacity-20 text-muted-foreground" />
      <p className="font-display font-bold text-lg text-foreground">No events this month</p>
      <p className="text-sm mt-2 text-muted-foreground">Try navigating to a different month.</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-8 max-w-2xl">
      {groups.map(({ label, events: dayEvs }) => (
        <div key={label}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3 px-1 text-muted-foreground">{label}</p>
          <div className="space-y-2">
            {dayEvs.map((ev) => {
              const c = catStyle(ev.category);
              const isReg = registeredEventIds.has(String(ev._id));
              return (
                <motion.div key={ev._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <Button variant="outline" onClick={() => navigate(`/events/${ev._id}`)}
                    className="w-full h-auto justify-start gap-4 p-4">
                    <div className="w-14 shrink-0 text-center">
                      <p className={cn("text-sm font-bold", isReg ? "text-emerald-400" : "text-muted-foreground")}>{format(parseISO(ev.startDate), "h:mm")}</p>
                      <p className="text-[10px] text-muted-foreground">{format(parseISO(ev.startDate), "a")}</p>
                    </div>
                    <div className={cn("w-0.5 h-10 rounded-full shrink-0", isReg ? "bg-emerald-400" : c.dot)} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-bold text-sm text-foreground">{ev.title}</p>
                        {isReg && <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0">Registered</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className={cn("capitalize font-semibold", c.text)}>{ev.category}</span>
                        {ev.venue?.name && <span>· {ev.venue.name}</span>}
                      </div>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-muted-foreground" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
