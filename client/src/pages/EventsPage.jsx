/**
 * EventsPage — Browse all published events
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, SlidersHorizontal, LayoutGrid, List,
  ChevronLeft, ChevronRight, Filter, LayoutDashboard,
  CalendarDays, Ticket, Bookmark, Radio,
} from "lucide-react";
import Navbar    from "../components/layout/Navbar";
import Sidebar   from "../components/layout/Sidebar";
import SearchModal from "../components/dashboard/SearchModal";
import EventCard from "../components/dashboard/EventCard";
import { categoryMeta } from "../data/mockData";
import { getEvents } from "../services/event.service";
import { useAuth } from "../context/AuthContext";
import { isExternalStudent } from "../constants/eventAudience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "",            label: "All Categories" },
  { value: "academic",    label: "Academic"    },
  { value: "cultural",    label: "Cultural"    },
  { value: "sports",      label: "Sports"      },
  { value: "technology",  label: "Technology"  },
  { value: "career",      label: "Career"      },
  { value: "social",      label: "Social"      },
  { value: "religious",   label: "Religious"   },
  { value: "competition", label: "Competition" },
  { value: "other",       label: "Other"       },
];

const EVENT_TYPES = [
  { value: "all",        label: "All Types" },
  { value: "physical",   label: "In-person" },
  { value: "online",     label: "Online"    },
  { value: "hybrid",     label: "Hybrid"    },
];

const SORT_OPTIONS = [
  { value: "startDate:asc",    label: "Soonest first"  },
  { value: "startDate:desc",   label: "Latest first"   },
  { value: "createdAt:desc",   label: "Newest added"   },
  { value: "registrationCount:desc", label: "Most popular"  },
  { value: "registrationDeadline:asc", label: "Deadline soon" },
];

const PAGE_LIMIT = 12;

const mobileNavItems = [
  { icon: LayoutDashboard, label: "Home",    href: "/"          },
  { icon: CalendarDays,    label: "Events",  href: "/events", active: true },
  { icon: Ticket,          label: "Mine",    href: "/my-events" },
  { icon: Bookmark,        label: "Saved",   href: "/saved"     },
  { icon: Radio,           label: "Channels",href: "/channels"  },
];

const SkeletonCard = () => (
  <Card className="overflow-hidden py-0 gap-0">
    <Skeleton className="h-[155px] w-full rounded-none" />
    <CardContent className="p-3.5 space-y-2">
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/5" />
      <div className="flex justify-between mt-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

const CategoryChip = ({ value, label, active, onClick }) => {
  const meta = value ? categoryMeta[value] : null;
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? "secondary" : "outline"}
      size="xs"
      className={cn(
        "shrink-0 rounded-full font-semibold",
        active && meta && "border-transparent",
      )}
      style={active ? {
        background: meta ? meta.bg : "rgba(13,107,74,0.12)",
        color: meta ? meta.color : undefined,
        borderColor: meta ? `${meta.color}50` : undefined,
      } : undefined}
    >
      {label}
    </Button>
  );
};

const Pagination = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Button variant="outline" size="icon-sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft size={15} />
      </Button>

      {start > 1 && (
        <>
          <Button variant="outline" size="icon-sm" onClick={() => onChange(1)}>1</Button>
          {start > 2 && <span className="text-xs text-muted-foreground">…</span>}
        </>
      )}

      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? "default" : "outline"}
          size="icon-sm"
          onClick={() => onChange(p)}
          className={p === page ? "bg-primary hover:bg-primary/90" : ""}
        >
          {p}
        </Button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-xs text-muted-foreground">…</span>}
          <Button variant="outline" size="icon-sm" onClick={() => onChange(totalPages)}>{totalPages}</Button>
        </>
      )}

      <Button variant="outline" size="icon-sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        <ChevronRight size={15} />
      </Button>
    </div>
  );
};

export default function EventsPage() {
  const { user } = useAuth();
  const guestView = isExternalStudent(user);

  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category,    setCategory]    = useState("");
  const [eventType,   setEventType]   = useState("");
  const [sort,        setSort]        = useState("startDate:asc");
  const [page,        setPage]        = useState(1);
  const [viewMode,    setViewMode]    = useState("grid");
  const [filterOpen,  setFilterOpen]  = useState(false);

  const [events,     setEvents]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState(null);

  const mainRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [category, eventType, sort]);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        status: "published",
        limit:  PAGE_LIMIT,
        page,
        sort,
        ...(search    && { search }),
        ...(category  && { category }),
        ...(eventType && { eventType }),
      };
      const data = await getEvents(params);
      setEvents(data.events ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load events.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, category, eventType, sort]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const totalPages   = pagination?.totalPages ?? 1;
  const totalEvents  = pagination?.total ?? events.length;
  const hasFilters   = search || category || eventType || sort !== "startDate:asc";

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setEventType("");
    setSort("startDate:asc");
    setPage(1);
  };

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main ref={mainRef} className="flex-1 min-w-0 pb-24 lg:pb-0">
          <div className="sticky top-16 z-30 px-4 sm:px-6 py-4 glass-bar border-b">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-display font-bold text-xl text-foreground">Browse Events</h1>
                {!isLoading && (
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    {totalEvents.toLocaleString()} event{totalEvents !== 1 ? "s" : ""} found
                    {hasFilters && " · filtered"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {hasFilters && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                      <Button variant="destructive" size="xs" onClick={clearFilters}>
                        <X size={12} /> Clear
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center rounded-lg overflow-hidden border border-border/60 bg-muted">
                  {[["grid", LayoutGrid], ["list", List]].map(([mode, Icon]) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={viewMode === mode ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => setViewMode(mode)}
                      className="rounded-none"
                    >
                      <Icon size={15} />
                    </Button>
                  ))}
                </div>

                <Button
                  variant={filterOpen ? "secondary" : "outline"}
                  size="xs"
                  onClick={() => setFilterOpen((p) => !p)}
                  className={cn("md:hidden", filterOpen && "bg-primary/15 text-primary border-primary/30")}
                >
                  <Filter size={13} />
                  Filters
                </Button>
              </div>
            </div>

            {guestView && (
              <Alert className="mb-3 border-primary/15 bg-primary/8">
                <AlertDescription className="text-xs text-muted-foreground">
                  Showing <strong>inter-university</strong> events only — open to students from {user?.university || "your university"}.
                </AlertDescription>
              </Alert>
            )}

            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search events, tags, organizers…"
                className="h-10 pl-9 pr-9 bg-input/30"
              />
              {searchInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X size={14} />
                </Button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {(filterOpen || true) && (
                <motion.div initial={false} className={`${filterOpen ? "flex" : "hidden md:flex"} flex-col md:flex-row gap-2`}>
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 flex-1">
                    {CATEGORIES.map(({ value, label }) => (
                      <CategoryChip
                        key={value}
                        value={value}
                        label={label}
                        active={category === value}
                        onClick={() => setCategory(value)}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={eventType || "all"} onValueChange={(v) => setEventType(v === "all" ? "" : v)}>
                      <SelectTrigger size="sm" className="h-8 text-xs font-medium">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 bg-muted">
                      <SlidersHorizontal size={12} className="text-muted-foreground" />
                      <Select value={sort} onValueChange={setSort}>
                        <SelectTrigger size="sm" className="h-auto border-0 bg-transparent shadow-none px-0 text-xs font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_OPTIONS.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-4 sm:px-6 py-6">
            {error ? (
              <Card className="py-16 text-center">
                <CardContent>
                  <p className="text-sm font-medium text-destructive mb-3">{error}</p>
                  <Button variant="secondary" onClick={fetchEvents}>Try again</Button>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <div className={viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                : "flex flex-col gap-3"
              }>
                {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : events.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="py-20 text-center">
                  <CardContent>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-muted">
                      <CalendarDays size={28} className="text-muted-foreground" />
                    </div>
                    <h3 className="font-display font-bold text-lg mb-2 text-foreground">No events found</h3>
                    <p className="text-sm mb-4 text-muted-foreground">
                      {hasFilters ? "Try adjusting your search or filters." : "No published events yet. Check back soon!"}
                    </p>
                    {hasFilters && (
                      <Button variant="gradient" onClick={clearFilters}>Clear all filters</Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${page}-${category}-${eventType}-${sort}-${search}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                    : "flex flex-col gap-3"
                  }
                >
                  {events.map((event, i) => (
                    <EventCard key={event._id} event={event} fluid animDelay={i * 0.04} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {!isLoading && events.length > 0 && (
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            )}
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center glass-bar border-t pb-[env(safe-area-inset-bottom,0)]">
        {mobileNavItems.map(({ icon: Icon, label, href, active }) => (
          <a
            key={label}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-3 text-center transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
