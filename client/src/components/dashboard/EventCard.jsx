import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Wifi, Layers, Clock, Users, Bookmark, BookmarkCheck, ArrowRight, Loader2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { categoryMeta } from "../../data/mockData";
import {
  formatEventDate,
  getDeadlineUrgency,
  capacityPercent,
  spotsLabel,
} from "../../utils/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TypeBadge = ({ type }) => {
  const map = {
    physical: { Icon: MapPin,  label: "In-person", className: "text-teal-400" },
    online:   { Icon: Wifi,    label: "Online",    className: "text-sky-400" },
    hybrid:   { Icon: Layers,  label: "Hybrid",    className: "text-primary" },
  };
  const { Icon, label, className } = map[type] || map.physical;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", className)}>
      <Icon className="size-3" />
      {label}
    </span>
  );
};

const CapacityBar = ({ count, capacity, teamMode = false }) => {
  const pct = capacityPercent(count, capacity);
  const spots = spotsLabel(count, capacity, teamMode);
  if (!capacity) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {count.toLocaleString()} / {capacity.toLocaleString()}
        </span>
        {spots && (
          <span className={cn("text-xs font-medium", spots.urgent ? "text-red-400" : "text-slate-600")}>
            {spots.text}
          </span>
        )}
      </div>
      <Progress value={pct} className="h-1 bg-muted" />
    </div>
  );
};

export default function EventCard({ event, compact = false, showMatch = false, animDelay = 0, fluid = false }) {
  const { savedEventIds, toggleSaved, registeredEventIds, register } = useApp();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState(null);

  const isSaved = savedEventIds?.has(String(event._id)) ?? false;
  const isRegistered = event.isRegistered ?? registeredEventIds?.has(event._id) ?? false;
  const isTeamEvent = event.registrationMode === "team";
  const cat = categoryMeta[event.category] ?? { label: event.category, bg: "rgba(13,107,74,0.12)", color: "var(--primary)" };
  const deadline = getDeadlineUrgency(event.registrationDeadline);

  const handleRegister = async () => {
    if (registering || isRegistered) return;
    setRegError(null);
    setRegistering(true);
    try {
      await register(event._id, []);
    } catch (err) {
      setRegError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: animDelay }}
      whileHover={{ y: -2 }}
      style={{ width: fluid ? "100%" : compact ? "240px" : "280px" }}
      className="shrink-0"
    >
      <Card
        onClick={() => navigate(`/events/${event._id}`)}
        className="group cursor-pointer overflow-hidden py-0 gap-0 hover:border-primary/40 hover:shadow-md transition-all"
      >
        <div className="relative overflow-hidden" style={{ height: compact ? "130px" : "155px" }}>
          <img
            src={event.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(event._id)}`}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/40" />

          <div className="absolute top-2.5 left-2.5">
            <Badge
              className="text-xs font-bold backdrop-blur-sm border-0"
              style={{ background: cat.bg, color: cat.color }}
            >
              {cat.label}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => { e.stopPropagation(); toggleSaved(event._id); }}
            className={cn(
              "absolute top-2.5 right-2.5 bg-background/60 backdrop-blur-sm",
              isSaved ? "text-slate-600" : "text-white/70"
            )}
            aria-label={isSaved ? "Unsave event" : "Save event"}
          >
            {isSaved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          </Button>

          {isRegistered && (
            <div className="absolute bottom-2.5 left-2.5">
              <Badge className="bg-emerald-500/25 text-emerald-400 border-0 backdrop-blur-sm">
                ✓ Registered
              </Badge>
            </div>
          )}

          {showMatch && event.matchScore && (
            <div className="absolute bottom-2.5 right-2.5">
              <Badge className="bg-primary/35 text-primary-foreground border-0 backdrop-blur-sm">
                {event.matchScore}% match
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="flex flex-col flex-1 p-3.5 pt-3.5">
          <h3 className={cn("font-display font-semibold leading-tight mb-1.5 line-clamp-2", compact ? "text-[13px]" : "text-sm")}>
            {event.title}
          </h3>

          {showMatch && event.matchReasons?.length > 0 && (
            <p className="text-xs mb-2 line-clamp-1 text-primary">{event.matchReasons[0]}</p>
          )}

          <div className="space-y-1 mb-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{formatEventDate(event.startDate)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{(event.registrationCount ?? 0).toLocaleString()} {isTeamEvent ? "teams" : "registered"}</span>
              <span className="mx-1 opacity-30">·</span>
              <TypeBadge type={event.eventType} />
            </div>
          </div>

          {!compact && <CapacityBar count={event.registrationCount} capacity={event.capacity} teamMode={isTeamEvent} />}
        </CardContent>

        <CardFooter className="flex items-center justify-between p-3.5 pt-0 border-t-0 bg-transparent">
          <Badge
            variant="secondary"
            className="text-xs font-medium border-0"
            style={{ background: deadline.bg, color: deadline.color }}
          >
            {deadline.urgent ? "⚠ " : ""}{deadline.label}
          </Badge>

          {!isRegistered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleRegister(); }}
              disabled={registering}
              className="h-7 text-xs border-primary/25 bg-primary/10 text-primary hover:bg-primary/20"
            >
              {registering ? (
                <><Loader2 className="size-3 animate-spin" /> Registering…</>
              ) : (
                <>Register <ArrowRight className="size-3" /></>
              )}
            </Button>
          ) : (
            <span className="text-xs font-medium text-emerald-400">Confirmed ✓</span>
          )}
          {regError && (
            <p className="text-[10px] mt-1 text-red-400 w-full">{regError}</p>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
