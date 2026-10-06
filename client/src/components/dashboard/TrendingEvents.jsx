import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Users, Clock, ArrowUpRight } from "lucide-react";
import { categoryMeta } from "../../data/mockData";
import { useEvents } from "../../hooks/useEvents";
import { formatEventDate, capacityPercent } from "../../utils/formatters";
import { useApp } from "../../context/AppContext";
import { isExternalStudent } from "../../constants/eventAudience";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANK_STYLES = {
  1: "bg-primary/15 text-primary",
  2: "bg-slate-400/12 text-slate-400",
  3: "bg-orange-400/15 text-orange-400",
};

const RankBadge = ({ rank }) => (
  <span
    className={cn(
      "shrink-0 w-7 h-7 rounded-xl flex items-center justify-center font-display font-black text-sm",
      RANK_STYLES[rank] ?? "text-muted-foreground"
    )}
  >
    {rank}
  </span>
);

const SkeletonRow = () => (
  <div className="flex items-center gap-3 p-3 rounded-xl">
    <Skeleton className="w-7 h-7 rounded-xl" />
    <Skeleton className="w-12 h-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-[60%]" />
      <Skeleton className="h-2 w-[40%]" />
    </div>
  </div>
);

const TrendingRow = ({ event, rank, index }) => {
  const navigate = useNavigate();
  const cat = categoryMeta[event.category] ?? { label: event.category, color: "var(--primary)" };
  const pct = capacityPercent(event.registrationCount ?? 0, event.capacity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
    >
      <Card
        onClick={() => navigate(`/events/${event._id}`)}
        className="group flex flex-row items-center gap-3 p-3 cursor-pointer border-transparent bg-transparent hover:bg-accent/40 hover:border-border transition-all py-3"
      >
        <RankBadge rank={rank} />

        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
          <img
            src={event.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(event._id)}`}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm leading-tight truncate text-foreground">
            {event.title}
          </p>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-medium" style={{ color: cat.color }}>
              {cat.label}
            </span>
            <span className="text-xs text-muted-foreground">
              <Clock size={10} className="inline mr-0.5" />
              {formatEventDate(event.startDate)}
            </span>
          </div>

          <div className="mt-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-muted-foreground">
                <Users size={10} className="inline mr-0.5" />
                {(event.registrationCount ?? 0).toLocaleString()} registered
              </span>
              {event.capacity && (
                <span className="text-xs text-muted-foreground">{pct}%</span>
              )}
            </div>
            {event.capacity && (
              <div className="h-1 rounded-full overflow-hidden bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 0.8, delay: index * 0.07 + 0.2, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    pct >= 80
                      ? "bg-red-500"
                      : "bg-gradient-to-r from-primary to-primary/80"
                  )}
                />
              </div>
            )}
          </div>
        </div>

        <ArrowUpRight
          size={15}
          className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground"
        />
      </Card>
    </motion.div>
  );
};

export default function TrendingEvents() {
  const navigate = useNavigate();
  const { student } = useApp();
  const isGuest = isExternalStudent(student);
  const { events, isLoading } = useEvents({
    status: "published",
    sort:   "-registrationCount",
    limit:  8,
  });

  return (
    <section className="px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/15">
            <TrendingUp size={13} className="text-primary" />
          </div>
          <h2 className="font-display font-bold text-lg text-foreground">
            {isGuest ? "Popular Inter-University" : "Trending"}
          </h2>
        </div>
        <Button
          variant="link"
          size="xs"
          onClick={() => navigate("/events")}
          className="h-auto p-0 text-primary"
        >
          View all
        </Button>
      </div>

      <Separator className="mb-2" />

      <div>
        {isLoading
          ? [1, 2, 3, 4, 5].map((n) => <SkeletonRow key={n} />)
          : events.length > 0
            ? events.map((event, i) => (
                <TrendingRow key={event._id} event={event} rank={i + 1} index={i} />
              ))
            : (
              <p className="text-sm py-4 px-3 text-muted-foreground">
                No trending events yet.
              </p>
            )
        }
      </div>
    </section>
  );
}
