/**
 * AdminCalendar — monthly event calendar for admins.
 */

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, startOfDay, parseISO,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, X, MapPin, Clock, Users,
  Edit2, Ticket, Filter,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { categoryMeta } from "../../data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_META = {
  published:  { label: "Published",  className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  draft:      { label: "Draft",      className: "bg-slate-100 text-slate-800 border-slate-200" },
  cancelled:  { label: "Cancelled",  className: "bg-red-50 text-red-800 border-red-200" },
  completed:  { label: "Completed",  className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const STATUS_OPTIONS = ["all", "published", "draft", "cancelled", "completed"];
const CATEGORY_OPTIONS = ["all", "technology", "career", "competition", "cultural", "sports", "academic", "social", "religious", "other"];

const getEventSpanDays = (event) => {
  const start = startOfDay(parseISO(event.startDate));
  const end   = startOfDay(parseISO(event.endDate ?? event.startDate));
  if (end < start) return [start];
  return eachDayOfInterval({ start, end });
};

const EventPopover = ({ event, onClose, onEdit, onViewRegs }) => {
  if (!event) return null;
  const cat = categoryMeta[event.category] ?? { label: event.category };
  const status = STATUS_META[event.status] ?? STATUS_META.draft;

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
        <div className="relative h-36 overflow-hidden">
          {event.coverImage?.url ? (
            <img src={event.coverImage.url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
          <Badge variant="outline" className="absolute top-3 left-3 text-xs font-bold"
            style={{ background: cat.bg, color: cat.color, borderColor: `${cat.color}33` }}>
            {cat.label}
          </Badge>
        </div>
        <div className="p-4">
          <DialogHeader className="mb-3">
            <DialogTitle className="font-display text-base">{event.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{format(parseISO(event.startDate), "PPP")} – {format(parseISO(event.endDate ?? event.startDate), "PPP")}</span>
            </div>
            {(event.venue?.name || event.onlineLink) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                <span>{event.venue?.name || event.onlineLink || "Online"}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{event.registrationCount ?? 0} / {event.capacity ?? "∞"} registered</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className={cn("capitalize font-semibold", status.className)}>{status.label}</Badge>
            <Badge variant="secondary" className="capitalize">{event.eventType}</Badge>
            {event.isFeatured && (
              <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">★ Featured</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {event.status !== "cancelled" && (
              <Button variant="outline" size="sm" className="flex-1"
                onClick={() => { onEdit(event); onClose(); }}>
                <Edit2 className="size-3.5" /> Edit
              </Button>
            )}
            <Button variant="outline" size="sm" className="flex-1 text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
              onClick={() => { onViewRegs(event._id); onClose(); }}>
              <Ticket className="size-3.5" /> Registrations
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DayCell = ({ day, events, currentMonth, isSelected, onSelectDay, onEventClick }) => {
  const inMonth    = isSameMonth(day, currentMonth);
  const isCurrent  = isToday(day);
  const MAX_CHIPS  = 2;
  const overflow   = events.length > MAX_CHIPS;
  const statusClass = (event) => (STATUS_META[event.status] ?? STATUS_META.draft).className;

  return (
    <button
      type="button"
      onClick={() => onSelectDay(day)}
      className={cn(
        "min-h-20 w-full p-1.5 rounded-xl text-left transition-colors border",
        isSelected && "bg-primary/10 border-primary/40 ring-1 ring-primary/20",
        !isSelected && isCurrent && "bg-primary/5 border-primary/20",
        !isSelected && !isCurrent && "border-transparent hover:bg-muted/50",
        !inMonth && "opacity-35"
      )}
    >
      <div className="flex justify-end mb-1">
        <span className={cn(
          "size-6 rounded-full flex items-center justify-center text-xs font-semibold",
          isCurrent && "bg-primary text-white",
          !isCurrent && isSelected && "bg-primary/15 text-primary font-bold",
          !isCurrent && !isSelected && "text-muted-foreground"
        )}>
          {format(day, "d")}
        </span>
      </div>
      <div className="space-y-0.5">
        {events.slice(0, MAX_CHIPS).map((event) => (
          <Badge
            key={event._id}
            variant="outline"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onEventClick(event); } }}
            className={cn("block w-full text-left text-[10px] font-semibold px-1.5 py-0.5 truncate cursor-pointer h-auto", statusClass(event))}
          >
            {event.title}
          </Badge>
        ))}
        {overflow && (
          <span className="text-[10px] px-1 font-medium text-muted-foreground">
            +{events.length - MAX_CHIPS} more
          </span>
        )}
      </div>
    </button>
  );
};

const DayPanel = ({ date, events, onEventClick, onClose }) => {
  if (!date) return null;
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
      <Card className="h-fit sticky top-20">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{format(date, "EEEE")}</p>
            <CardTitle className="font-display text-lg">{format(date, "MMMM d, yyyy")}</CardTitle>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm py-6 text-center text-muted-foreground">No events on this day</p>
          ) : (
            <ScrollArea className="max-h-80">
              <ul className="space-y-2 pr-3">
                {events.map((ev) => {
                  const status = STATUS_META[ev.status] ?? STATUS_META.draft;
                  const cat = categoryMeta[ev.category];
                  return (
                    <li key={ev._id}>
                      <button type="button" onClick={() => onEventClick(ev)}
                        className="w-full text-left p-3 rounded-xl border border-border bg-muted/30 hover:border-slate-300 transition-colors">
                        <p className="font-display font-semibold text-sm truncate mb-1 text-foreground">{ev.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", status.className)}>{status.label}</Badge>
                          {cat && (
                            <Badge variant="outline" className="text-[10px] font-semibold"
                              style={{ background: cat.bg, color: cat.color, borderColor: `${cat.color}33` }}>
                              {cat.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] mt-1.5 text-muted-foreground">
                          {format(parseISO(ev.startDate), "h:mm a")}
                          {ev.venue?.name ? ` · ${ev.venue.name}` : ""}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const CalendarSkeleton = () => (
  <Card className="overflow-hidden">
    <div className="grid grid-cols-7 gap-px p-2 bg-border">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="min-h-20 p-2 bg-card">
          <Skeleton className="size-6 rounded-full ml-auto mb-2" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  </Card>
);

export default function AdminCalendar({ onViewRegistrations }) {
  const { events, eventsLoading, setEditingEvent, setActiveSection } = useAdmin();

  const [currentMonth, setCurrentMonth]     = useState(new Date());
  const [selectedDay, setSelectedDay]       = useState(new Date());
  const [selectedEvent, setSelectedEvent]   = useState(null);
  const [statusFilter, setStatusFilter]     = useState("all");
  const [catFilter, setCatFilter]           = useState("all");

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchCat    = catFilter === "all" || e.category === catFilter;
      return matchStatus && matchCat;
    });
  }, [events, statusFilter, catFilter]);

  const eventsByDay = useMemo(() => {
    const acc = {};
    filteredEvents.forEach((ev) => {
      getEventSpanDays(ev).forEach((day) => {
        const key = format(day, "yyyy-MM-dd");
        if (!acc[key]) acc[key] = [];
        if (!acc[key].some((x) => x._id === ev._id)) acc[key].push(ev);
      });
    });
    return acc;
  }, [filteredEvents]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calDays    = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  });

  const monthEventCount = useMemo(
    () => filteredEvents.filter((e) => isSameMonth(parseISO(e.startDate), currentMonth)).length,
    [filteredEvents, currentMonth]
  );

  const selectedDayEvents = useMemo(() => {
    const key = format(startOfDay(selectedDay), "yyyy-MM-dd");
    return eventsByDay[key] ?? [];
  }, [selectedDay, eventsByDay]);

  const handleEdit = useCallback((event) => {
    setEditingEvent(event);
    setActiveSection("edit");
  }, [setEditingEvent, setActiveSection]);

  const handleViewRegs = useCallback((eventId) => {
    onViewRegistrations?.(eventId);
    setActiveSection("registrations");
  }, [onViewRegistrations, setActiveSection]);

  return (
    <div className="flex flex-col gap-4">
      <EventPopover
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleEdit}
        onViewRegs={handleViewRegs}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
          <p className="text-xs mt-0.5 text-muted-foreground">
            {monthEventCount} event{monthEventCount !== 1 ? "s" : ""} starting this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }}>
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All Categories" : (categoryMeta[c]?.label ?? c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        {eventsLoading ? (
          <CalendarSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden py-0">
              <div className="grid grid-cols-7 border-b border-border">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px p-2 bg-border">
                {calDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  return (
                    <div key={key} className="bg-card">
                      <DayCell
                        day={day}
                        events={eventsByDay[key] ?? []}
                        currentMonth={currentMonth}
                        isSelected={isSameDay(day, selectedDay)}
                        onSelectDay={setSelectedDay}
                        onEventClick={setSelectedEvent}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        <DayPanel
          date={selectedDay}
          events={selectedDayEvents}
          onEventClick={setSelectedEvent}
          onClose={() => setSelectedDay(new Date())}
        />
      </div>

      <div className="flex flex-wrap gap-4 pt-1">
        <span className="text-xs font-semibold text-muted-foreground">Status:</span>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full",
              key === "published" && "bg-emerald-400",
              key === "draft" && "bg-slate-500",
              key === "cancelled" && "bg-red-400",
              key === "completed" && "bg-slate-400"
            )} />
            <span className="text-xs text-muted-foreground">{meta.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
