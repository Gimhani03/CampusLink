import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, Wifi, Layers, Users, Clock, Star } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { getFeaturedEvent } from "../../services/event.service";
import { isExternalStudent } from "../../constants/eventAudience";
import { formatEventDate, getDeadlineUrgency } from "../../utils/formatters";
import { categoryMeta } from "../../data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STAT_COLORS = {
  primary: "text-primary",
  teal:    "text-emerald-700",
  amber:   "text-orange-800",
  navy:    "text-slate-700",
};

const StatCard = ({ value, label, colorKey, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="flex-1 min-w-0"
  >
    <Card className="py-0 text-center">
      <CardContent className="p-4">
        <p className={cn("font-display font-bold text-2xl leading-none", STAT_COLORS[colorKey])}>
          {value}
        </p>
        <p className="text-xs mt-1.5 font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  </motion.div>
);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const TypeIcon = ({ type }) => {
  const map = {
    "in-person": { Icon: MapPin,  label: "In-person", className: "text-muted-foreground" },
    physical:    { Icon: MapPin,  label: "In-person", className: "text-muted-foreground" },
    online:      { Icon: Wifi,    label: "Online",    className: "text-sky-400" },
    hybrid:      { Icon: Layers,  label: "Hybrid",    className: "text-primary" },
  };
  const { Icon, label, className } = map[type] ?? map["in-person"];
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium", className)}>
      <Icon size={12} />
      {label}
    </span>
  );
};

const FeaturedSkeleton = () => (
  <Card className="overflow-hidden py-0 gap-0">
    <div className="flex flex-col md:flex-row">
      <Skeleton className="h-48 md:h-auto md:w-[42%] md:min-h-[220px] rounded-none shrink-0" />
      <CardContent className="flex-1 px-4 sm:px-6 py-5 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-7 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-xl mt-2" />
      </CardContent>
    </div>
  </Card>
);

const NoFeaturedEvent = ({ isGuest, onBrowse }) => (
  <Card className="border-dashed py-0">
    <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
      <Star size={32} className="text-slate-600 opacity-40" />
      <p className="text-sm font-medium text-muted-foreground">
        {isGuest ? "No featured inter-university event" : "No featured event right now"}
      </p>
      <p className="text-xs text-center px-8 text-muted-foreground/70">
        {isGuest
          ? "Browse open hackathons and inter-university competitions below."
          : "An admin can spotlight one event here from the Admin Dashboard."}
      </p>
      {isGuest && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBrowse}
          className="mt-1 border-primary/35 bg-primary/10 text-primary hover:bg-primary/20"
        >
          Browse events
        </Button>
      )}
    </CardContent>
  </Card>
);

export default function Hero() {
  const { student } = useApp();
  const navigate    = useNavigate();
  const isGuest     = isExternalStudent(student);

  const [event,   setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFeaturedEvent()
      .then((ev) => { if (!cancelled) setEvent(ev); })
      .catch(() => { if (!cancelled) setEvent(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cat      = event ? (categoryMeta[event.category] ?? { label: event.category, bg: "rgba(13,107,74,0.12)", color: "var(--primary)" }) : null;
  const deadline = event ? getDeadlineUrgency(event.registrationDeadline) : null;

  return (
    <section className="px-4 sm:px-6 pt-6 pb-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <p className="text-sm font-medium mb-1 text-primary">
          {getGreeting()} 👋
        </p>
        <h1 className="font-display font-bold text-2xl sm:text-3xl leading-tight text-foreground">
          Welcome back,{" "}
          <span className="text-primary">
            {student?.fullName?.split(" ")[0] ?? "there"}
          </span>
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          {isGuest
            ? `Inter-university events for ${student?.university ?? "your university"}`
            : `${student?.stats?.upcomingRegistrations ?? 0} upcoming event${(student?.stats?.upcomingRegistrations ?? 0) !== 1 ? "s" : ""} this week`}
        </p>
      </motion.div>

      <div className="flex gap-3 mb-6">
        <StatCard value={student?.stats?.upcomingRegistrations ?? 0} label="Upcoming"   colorKey="primary" delay={0.1} />
        <StatCard value={student?.stats?.totalRegistrations    ?? 0} label="Registered" colorKey="teal"    delay={0.15} />
        <StatCard value={student?.stats?.savedEvents           ?? 0} label="Saved"      colorKey="amber"   delay={0.2} />
        {!isGuest && (
          <StatCard value={student?.stats?.followedChannels ?? 0} label="Channels" colorKey="navy" delay={0.25} />
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.3 }}
      >
        {loading ? (
          <FeaturedSkeleton />
        ) : !event ? (
          <NoFeaturedEvent isGuest={isGuest} onBrowse={() => navigate("/events")} />
        ) : (
          <Card className="overflow-hidden py-0 gap-0 border-border/80 shadow-sm ring-1 ring-border/40">
            <div className="flex flex-col md:flex-row md:min-h-[240px]">
              {/* Cover image */}
              <div className="relative h-44 sm:h-52 md:h-auto md:w-[42%] shrink-0 overflow-hidden">
                {event.coverImage?.url ? (
                  <img
                    src={event.coverImage.url}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/25 via-primary/10 to-muted" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent md:bg-gradient-to-r md:from-black/35 md:via-transparent md:to-transparent" />

                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                  <Badge className="gap-1 border-0 bg-amber-500/95 text-white font-semibold shadow-sm backdrop-blur-sm">
                    <Star size={11} fill="currentColor" />
                    Featured Event
                  </Badge>
                </div>

                {deadline?.urgent && (
                  <div className="absolute top-3 right-3">
                    <Badge
                      variant="secondary"
                      className="border-0 backdrop-blur-md shadow-sm"
                      style={{ background: deadline.bg, color: deadline.color, border: `1px solid ${deadline.color}40` }}
                    >
                      <Clock size={11} />
                      {deadline.label}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Details */}
              <CardContent className="relative flex flex-1 flex-col justify-center px-4 sm:px-6 py-5 md:py-6">
                <div className="absolute left-0 top-4 bottom-4 hidden w-1 rounded-full bg-primary/80 md:block" />

                <div className="flex flex-wrap items-center gap-2 mb-3 md:pl-3">
                  <Badge
                    className="text-xs font-bold border-0"
                    style={{ background: cat.bg, color: cat.color }}
                  >
                    {cat.label}
                  </Badge>
                  <TypeIcon type={event.eventType} />
                </div>

                <h2 className="font-display font-bold text-xl sm:text-2xl leading-snug mb-3 text-foreground md:pl-3">
                  {event.title}
                </h2>

                <div className="flex flex-wrap gap-2 mb-5 md:pl-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Clock size={12} className="text-primary/70" />
                    {formatEventDate(event.startDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <MapPin size={12} className="text-primary/70" />
                    <span className="max-w-[180px] truncate sm:max-w-none">
                      {event.venue?.name || event.onlineLink || "Online"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Users size={12} className="text-primary/70" />
                    {(event.registrationCount ?? 0).toLocaleString()} registered
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:pl-3">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="gradient"
                      onClick={() => navigate(`/events/${event._id}`)}
                      className="gap-2 px-5 h-10 text-sm font-semibold shadow-sm"
                    >
                      View Details
                      <ArrowRight size={15} />
                    </Button>
                  </motion.div>

                  <Button
                    variant="ghost"
                    onClick={() => navigate("/events")}
                    className="text-muted-foreground hover:text-foreground h-10 px-3"
                  >
                    Browse all events
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        )}
      </motion.div>
    </section>
  );
}
