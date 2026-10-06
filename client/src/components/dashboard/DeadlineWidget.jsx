import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlarmClock, ArrowRight, Clock } from "lucide-react";
import { categoryMeta } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import { useEvents } from "../../hooks/useEvents";
import { getDeadlineUrgency } from "../../utils/formatters";
import { format, differenceInSeconds } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const useCountdown = (targetDate) => {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, differenceInSeconds(new Date(targetDate), new Date()))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.max(0, differenceInSeconds(new Date(targetDate), new Date())));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return { d, h, m, s, seconds };
};

const CountdownDisplay = ({ date, colorClass }) => {
  const { d, h, m, s, seconds } = useCountdown(date);

  if (seconds <= 0) {
    return <span className="text-xs font-medium text-muted-foreground">Closed</span>;
  }

  if (d > 0) {
    return (
      <span className={cn("font-display font-bold text-sm tabular-nums", colorClass)}>
        {d}d {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m
      </span>
    );
  }

  return (
    <span className={cn("font-display font-bold text-sm tabular-nums", colorClass)}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
};

const DeadlineItem = ({ event, index, onRegister }) => {
  const cat     = categoryMeta[event.category] ?? { label: event.category, bg: "rgba(13,107,74,0.12)", color: "var(--primary)" };
  const urgency = getDeadlineUrgency(event.registrationDeadline);
  const colorClass = urgency.urgent ? (urgency.label?.includes("hour") ? "text-red-400" : "text-slate-600") : "text-primary";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Card
        className={cn(
          "py-0 cursor-pointer hover:bg-accent/30 transition-all",
          urgency.urgent && "border-red-400/25"
        )}
      >
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-display font-semibold text-sm leading-tight line-clamp-2 flex-1 text-foreground">
              {event.title}
            </h4>
            <CountdownDisplay date={event.registrationDeadline} colorClass={colorClass} />
          </div>

          <div className="h-0.5 rounded-full overflow-hidden mb-2.5 bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{ background: urgency.color, width: urgency.urgent ? "70%" : "30%" }}
              animate={{ opacity: urgency.urgent ? [1, 0.5, 1] : 1 }}
              transition={{ duration: 1.5, repeat: urgency.urgent ? Infinity : 0 }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="text-xs font-medium border-0"
                style={{ background: cat.bg, color: cat.color }}
              >
                {cat.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                <Clock size={10} className="inline mr-1" />
                {format(new Date(event.registrationDeadline), "MMM d")}
              </span>
            </div>
            <motion.div whileHover={{ x: 2 }}>
              <Button
                variant="link"
                size="xs"
                onClick={() => onRegister(event._id)}
                className="h-auto p-0 gap-1 font-semibold"
                style={{ color: urgency.color }}
              >
                Register <ArrowRight size={11} />
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function DeadlineWidget() {
  const navigate = useNavigate();
  const { registeredEventIds, register } = useApp();

  const { events, isLoading } = useEvents({
    status: "published",
    sort:   "registrationDeadline",
    limit:  5,
  });

  const urgentDeadlines = useMemo(() => {
    const now     = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return events.filter((e) => {
      if (!e.registrationDeadline) return false;
      const dl = new Date(e.registrationDeadline);
      return dl > now && dl <= in7days && !(registeredEventIds?.has(e._id));
    });
  }, [events, registeredEventIds]);

  const handleRegister = async (eventId) => {
    try {
      await register(eventId, []);
    } catch {
      // Error shown elsewhere or swallowed; deadline card stays as-is
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-red-400/15">
            <AlarmClock size={13} className="text-red-400" />
          </div>
          <h2 className="font-display font-bold text-base text-foreground">Closing Soon</h2>
        </div>
        <Button
          variant="link"
          size="xs"
          onClick={() => navigate("/events")}
          className="h-auto p-0 text-primary"
        >
          All events
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : urgentDeadlines.length > 0 ? (
        <div className="space-y-2.5">
          {urgentDeadlines.map((event, i) => (
            <DeadlineItem key={event._id} event={event} index={i} onRegister={handleRegister} />
          ))}
        </div>
      ) : (
        <Card className="py-0">
          <CardContent className="py-8 text-center">
            <AlarmClock className="mx-auto mb-2 opacity-20 size-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No urgent deadlines</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
