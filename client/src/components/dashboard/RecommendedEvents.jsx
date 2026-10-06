import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ChevronLeft, ChevronRight, ArrowRight, Settings2 } from "lucide-react";
import EventCard from "./EventCard";
import { useApp } from "../../context/AppContext";
import { useEvents } from "../../hooks/useEvents";
import { INTEREST_MAP } from "../../constants/interests";
import { isExternalStudent } from "../../constants/eventAudience";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SkeletonCard = () => (
  <Skeleton className="shrink-0 rounded-2xl" style={{ width: "280px", height: "320px" }} />
);

export default function RecommendedEvents() {
  const scrollRef = useRef(null);
  const navigate  = useNavigate();
  const { student } = useApp();
  const isGuest = isExternalStudent(student);

  const interests = isGuest ? [] : (student?.interests ?? []);

  const { events, isLoading } = useEvents({
    status: "published",
    sort:   "-registrationCount",
    limit:  12,
    ...(interests.length > 0 ? { tags: interests.join(",") } : {}),
  });

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  const interestLabels = interests
    .map((v) => INTEREST_MAP[v]?.label ?? v)
    .slice(0, 5);

  return (
    <section className="px-4 sm:px-6 py-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/20">
              <Sparkles size={13} className="text-primary" />
            </div>
            <h2 className="font-display font-bold text-lg text-foreground">
              {isGuest ? "Inter-University Events" : "Recommended for You"}
            </h2>
          </div>
          {isGuest ? (
            <p className="text-xs mt-1 text-muted-foreground">
              Open hackathons and competitions for {student?.university ?? "your university"}
            </p>
          ) : interests.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {interestLabels.map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="text-[10px] font-semibold border-primary/20 bg-primary/10 text-primary"
                >
                  {label}
                </Badge>
              ))}
              {interests.length > 5 && (
                <span className="text-[10px] text-muted-foreground">
                  +{interests.length - 5} more
                </span>
              )}
            </div>
          ) : !isGuest ? (
            <Button
              variant="link"
              size="xs"
              onClick={() => navigate("/profile")}
              className="h-auto p-0 mt-1 text-primary gap-1"
            >
              <Settings2 size={11} /> Set your interests to personalise this section
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="link"
            size="xs"
            onClick={() => navigate("/events")}
            className="hidden sm:inline-flex h-auto p-0 text-primary"
          >
            View all
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => scroll(-1)} aria-label="Scroll left">
            <ChevronLeft size={14} />
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => scroll(1)} aria-label="Scroll right">
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
      >
        {isLoading
          ? [1, 2, 3].map((n) => (
              <div key={n} className="snap-start">
                <SkeletonCard />
              </div>
            ))
          : events.length > 0
            ? events.map((event, i) => (
                <div key={event._id} className="snap-start">
                  <EventCard event={event} showMatch animDelay={i * 0.07} />
                </div>
              ))
            : (
              <p className="text-sm py-4 text-muted-foreground">
                {isGuest
                  ? "No inter-university events are open for registration right now."
                  : "No events found yet. Check back soon!"}
              </p>
            )
        }

        {!isLoading && events.length === 0 && !isGuest && interests.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-10 text-center w-full">
            <Card className="w-14 h-14 rounded-2xl flex items-center justify-center border-primary/15 bg-primary/10 py-0">
              <CardContent className="p-0 flex items-center justify-center">
                <Sparkles size={24} className="text-primary opacity-50" />
              </CardContent>
            </Card>
            <div>
              <p className="text-sm font-semibold text-foreground">No interests set yet</p>
              <p className="text-xs mt-1 mb-3 text-muted-foreground">
                Add your interests in your profile to get personalised recommendations.
              </p>
              <Button variant="gradient" size="sm" onClick={() => navigate("/profile")}>
                Update Interests
              </Button>
            </div>
          </motion.div>
        )}

        {!isLoading && events.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: events.length * 0.07 }}
            className="snap-start shrink-0"
            style={{ width: "200px", minHeight: "280px" }}
          >
            <Card
              role="button"
              tabIndex={0}
              onClick={() => navigate("/events")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/events")}
              className="h-full min-h-[280px] cursor-pointer border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all py-0"
            >
              <CardContent className="flex flex-col items-center justify-center gap-3 h-full py-8">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/15">
                  <ArrowRight size={20} className="text-primary" />
                </div>
                <div className="text-center px-4">
                  <p className="text-sm font-semibold text-primary">Discover More</p>
                  <p className="text-xs mt-1 text-muted-foreground">Browse all events</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  );
}
