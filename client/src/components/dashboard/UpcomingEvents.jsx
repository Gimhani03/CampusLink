import { useRef, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Ticket, MapPin, Clock, QrCode } from "lucide-react";
import { categoryMeta } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import { formatEventDate, formatDateRange } from "../../utils/formatters";
import { differenceInDays, differenceInHours } from "date-fns";
import EventPassModal from "../common/EventPassModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CountdownChip = ({ date }) => {
  const days = differenceInDays(new Date(date), new Date());
  const hours = differenceInHours(new Date(date), new Date());

  if (days <= 0 && hours <= 0) {
    return <span className="text-xs text-muted-foreground">Today</span>;
  }
  if (hours < 24) {
    return (
      <Badge className="bg-red-400/15 text-red-400 border-0 font-semibold">
        In {hours}h
      </Badge>
    );
  }
  if (days <= 3) {
    return (
      <Badge className="bg-primary/15 text-primary border-0 font-semibold">
        In {days}d
      </Badge>
    );
  }
  return (
    <Badge className="bg-primary/15 text-primary border-0 font-semibold">
      In {days} days
    </Badge>
  );
};

const UpcomingCard = ({ event, registrationId, index, onViewPass }) => {
  const navigate = useNavigate();
  if (!event) return null;

  const cat = categoryMeta[event.category] ?? { label: event.category, bg: "rgba(13,107,74,0.12)", color: "var(--primary)" };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      style={{ width: "320px" }}
      className="shrink-0"
    >
      <Card
        onClick={() => navigate(`/events/${event._id}`)}
        className="group cursor-pointer overflow-hidden py-0 gap-0 hover:border-border hover:shadow-lg transition-all"
      >
        <div className="relative h-36 overflow-hidden shrink-0">
          <img
            src={event.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(event._id)}`}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/55" />

          <Badge
            className="absolute top-2.5 left-2.5 text-xs font-bold backdrop-blur-sm border-0"
            style={{ background: cat.bg, color: cat.color }}
          >
            {cat.label}
          </Badge>

          <div className="absolute top-2.5 right-2.5">
            <CountdownChip date={event.startDate} />
          </div>

          <div className="absolute bottom-2 left-2.5">
            <Badge className="bg-emerald-400/20 text-emerald-400 border-0 backdrop-blur-sm font-semibold">
              <Ticket size={10} /> Registered
            </Badge>
          </div>
        </div>

        <CardContent className="p-3.5 flex-1 flex flex-col">
          <h3 className="font-display font-semibold text-sm leading-tight line-clamp-2 mb-2 text-foreground">
            {event.title}
          </h3>

          <div className="space-y-1.5 mt-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={11} />
              <span>{formatDateRange(event.startDate, event.endDate)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={11} />
              <span className="truncate">{event.venue?.name || event.onlineLink || "Online"}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between p-3.5 pt-0 border-t border-border bg-transparent">
          <span className="text-xs text-muted-foreground">
            Organised by {event.organizer}
          </span>
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0 text-primary gap-1"
            onClick={(e) => { e.stopPropagation(); onViewPass(registrationId); }}
          >
            <QrCode size={12} /> View pass
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

const SectionHeader = ({ title, subtitle, showAll = true, scrollRef }) => {
  const scroll = (dir) => {
    if (scrollRef?.current) {
      scrollRef.current.scrollBy({ left: dir * 340, behavior: "smooth" });
    }
  };

  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs mt-0.5 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showAll && (
          <a href="#" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            View all
          </a>
        )}
        <Button variant="secondary" size="icon-sm" onClick={() => scroll(-1)} aria-label="Scroll left">
          <ChevronLeft size={14} />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => scroll(1)} aria-label="Scroll right">
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
};

export { SectionHeader };

export default function UpcomingEvents() {
  const scrollRef = useRef(null);
  const { registrations } = useApp();
  const [passRegId, setPassRegId] = useState(null);

  const upcomingRegistrations = useMemo(() => {
    const now = new Date();
    return registrations
      .filter((r) => r?.status !== "cancelled" && r?.event?.startDate && new Date(r.event.startDate) > now)
      .sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate));
  }, [registrations]);

  if (upcomingRegistrations.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 py-6">
      {passRegId && (
        <EventPassModal
          registrationId={passRegId}
          open
          onClose={() => setPassRegId(null)}
        />
      )}

      <SectionHeader
        title="Upcoming Events"
        subtitle={`${upcomingRegistrations.length} event${upcomingRegistrations.length !== 1 ? "s" : ""} you're registered for`}
        scrollRef={scrollRef}
      />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
      >
        {upcomingRegistrations.map((reg, i) => (
          <div key={reg._id} className="snap-start">
            <UpcomingCard
              event={reg.event}
              registrationId={reg._id}
              index={i}
              onViewPass={setPassRegId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
