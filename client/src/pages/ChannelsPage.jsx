/**
 * ChannelsPage — Browse and follow university channels
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Search, X, CheckCircle2, Users, CalendarDays,
  ChevronRight, Loader2, Bell, BellOff,
} from "lucide-react";
import { format } from "date-fns";

import Navbar       from "../components/layout/Navbar";
import Sidebar      from "../components/layout/Sidebar";
import SearchModal  from "../components/dashboard/SearchModal";
import { getChannels, getChannelBySlug } from "../services/channel.service";
import { useApp } from "../context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const CATEGORY_FILTERS = [
  { value: "",             label: "All" },
  { value: "technology",   label: "Technology" },
  { value: "academic",     label: "Academic" },
  { value: "career",       label: "Career" },
  { value: "cultural",     label: "Cultural" },
  { value: "sports",       label: "Sports" },
  { value: "social",       label: "Social" },
  { value: "competition",  label: "Competition" },
  { value: "other",        label: "Other" },
];

const CAT_COLORS = {
  technology:  { bg: "bg-sky-500/12",     color: "text-sky-400"     },
  academic:    { bg: "bg-primary/12",  color: "text-primary"  },
  career:      { bg: "bg-emerald-500/12", color: "text-emerald-400" },
  cultural:    { bg: "bg-amber-500/12",   color: "text-slate-600"   },
  sports:      { bg: "bg-red-500/12",     color: "text-red-400"     },
  social:      { bg: "bg-fuchsia-500/12", color: "text-fuchsia-400" },
  competition: { bg: "bg-orange-500/12",  color: "text-orange-400"  },
  other:       { bg: "bg-muted",          color: "text-muted-foreground" },
};

const ChannelSkeleton = () => (
  <Card className="overflow-hidden py-0 gap-0">
    <Skeleton className="h-[100px] w-full rounded-none" />
    <CardContent className="p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </CardContent>
  </Card>
);

const ChannelCard = ({ channel, onSelect }) => {
  const { followedChannelIds, toggleChannelFollow } = useApp();
  const [following, setFollowing] = useState(() => followedChannelIds.has(String(channel._id)));
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    setFollowing(followedChannelIds.has(String(channel._id)));
  }, [followedChannelIds, channel._id]);

  const catStyle = CAT_COLORS[channel.category] ?? CAT_COLORS.other;

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (loadingFollow) return;
    setLoadingFollow(true);
    setFollowing((v) => !v);
    try {
      await toggleChannelFollow(channel._id);
    } catch {
      setFollowing((v) => !v);
    } finally {
      setLoadingFollow(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      onClick={() => onSelect(channel)}
    >
      <Card className="overflow-hidden cursor-pointer group py-0 gap-0 hover:border-border hover:shadow-lg transition-all">
        <div className="relative overflow-hidden h-[90px]">
          <img
            src={channel.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${channel.slug}&backgroundColor=7c5af5`}
            alt={channel.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-background/70" />
          <Badge className={cn("absolute top-2 left-2 text-[10px] capitalize backdrop-blur-sm border-0", catStyle.bg, catStyle.color)}>
            {channel.category}
          </Badge>
          {channel.isVerified && (
            <Badge className="absolute top-2 right-2 text-[10px] bg-emerald-500/20 text-emerald-400 border-0 backdrop-blur-sm gap-1">
              <CheckCircle2 size={10} /> Verified
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="size-10 rounded-xl shrink-0 -mt-7 relative z-10 overflow-hidden border-2 border-card">
              {channel.avatar?.url ? (
                <img src={channel.avatar.url} alt={channel.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-emerald-700">
                  <Radio size={16} className="text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="font-display font-bold text-sm leading-tight line-clamp-1 text-foreground">{channel.name}</h3>
              {channel.organizer && (
                <p className="text-xs mt-0.5 line-clamp-1 text-muted-foreground">{channel.organizer}</p>
              )}
            </div>
          </div>

          <p className="text-xs leading-5 line-clamp-2 mb-3 text-muted-foreground">
            {channel.description || "No description provided."}
          </p>

          <div className="flex items-center gap-3 text-xs mb-3 text-muted-foreground">
            <span className="flex items-center gap-1"><Users size={11} />{channel.followerCount.toLocaleString()} followers</span>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1"><CalendarDays size={11} />{channel.eventCount} events</span>
          </div>

          <Button
            variant={following ? "secondary" : "outline"}
            size="sm"
            onClick={handleFollow}
            disabled={loadingFollow}
            className={cn(
              "w-full text-xs font-bold",
              following
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15"
                : "bg-primary/15 text-primary border-primary/25 hover:bg-primary/20"
            )}
          >
            {loadingFollow ? <Loader2 size={12} className="animate-spin" />
              : following ? <><BellOff size={12} /> Following</> : <><Bell size={12} /> Follow</>}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ChannelDrawer = ({ slug, onClose }) => {
  const navigate = useNavigate();
  const { followedChannelIds, toggleChannelFollow } = useApp();
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getChannelBySlug(slug)
      .then((ch) => {
        setChannel(ch);
        setFollowing(followedChannelIds.has(String(ch._id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (channel) setFollowing(followedChannelIds.has(String(channel._id)));
  }, [followedChannelIds, channel]);

  const handleFollow = async () => {
    if (!channel || loadingFollow) return;
    setLoadingFollow(true);
    setFollowing((v) => !v);
    try {
      await toggleChannelFollow(channel._id);
    } catch {
      setFollowing((v) => !v);
    } finally {
      setLoadingFollow(false);
    }
  };

  const catStyle = channel ? (CAT_COLORS[channel.category] ?? CAT_COLORS.other) : {};

  return (
    <Sheet open={Boolean(slug)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-md p-0 gap-0 overflow-y-auto">
        {loading || !channel ? (
          <div className="flex-1 flex items-center justify-center min-h-[50vh]">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden shrink-0 h-[160px]">
              <img
                src={channel.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${channel.slug}&backgroundColor=7c5af5`}
                alt={channel.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-background/85" />
            </div>

            <div className="px-5 pb-6 -mt-8 relative z-10">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div className="size-14 rounded-2xl shrink-0 overflow-hidden border-[3px] border-background">
                  {channel.avatar?.url ? (
                    <img src={channel.avatar.url} alt={channel.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-emerald-700">
                      <Radio size={22} className="text-white" />
                    </div>
                  )}
                </div>
                <Button
                  variant={following ? "secondary" : "gradient"}
                  size="sm"
                  onClick={handleFollow}
                  disabled={loadingFollow}
                  className={following ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 mb-1" : "mb-1"}
                >
                  {loadingFollow ? <Loader2 size={14} className="animate-spin" />
                    : following ? <><BellOff size={14} /> Unfollow</> : <><Bell size={14} /> Follow</>}
                </Button>
              </div>

              <SheetHeader className="p-0 text-left mb-3">
                <SheetTitle className="font-display font-black text-lg flex items-center gap-2">
                  {channel.name}
                  {channel.isVerified && <CheckCircle2 size={16} className="text-emerald-400" />}
                </SheetTitle>
                {channel.organizer && (
                  <SheetDescription>{channel.organizer}</SheetDescription>
                )}
              </SheetHeader>

              <Badge className={cn("capitalize mb-4 border-0", catStyle.bg, catStyle.color)}>{channel.category}</Badge>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Followers", value: channel.followerCount.toLocaleString(), Icon: Users },
                  { label: "Events", value: channel.eventCount.toLocaleString(), Icon: CalendarDays },
                ].map(({ label, value, Icon }) => (
                  <Card key={label} className="py-0 gap-0">
                    <CardContent className="px-4 py-3 text-center">
                      <Icon size={16} className="mx-auto mb-1 text-primary" />
                      <p className="font-display font-bold text-lg text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {channel.description && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold uppercase tracking-widest mb-2 text-muted-foreground">About</h4>
                  <p className="text-sm leading-6 text-muted-foreground">{channel.description}</p>
                </div>
              )}

              {channel.recentEvents?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest mb-3 text-muted-foreground">Upcoming Events</h4>
                  <div className="space-y-2">
                    {channel.recentEvents.map((ev) => (
                      <Button
                        key={ev._id}
                        variant="outline"
                        onClick={() => navigate(`/events/${ev._id}`)}
                        className="w-full h-auto justify-start gap-3 px-3 py-2.5"
                      >
                        <img
                          src={ev.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${ev._id}`}
                          alt={ev.title}
                          className="size-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-xs font-semibold line-clamp-1 text-foreground">{ev.title}</p>
                          <p className="text-[11px] mt-0.5 text-muted-foreground">{format(new Date(ev.startDate), "d MMM yyyy")}</p>
                        </div>
                        <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default function ChannelsPage() {
  const { followedChannelIds } = useApp();

  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [channels, setChannels] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSlug, setActiveSlug] = useState(null);

  const LIMIT = 12;

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (category) params.category = category;
      if (search) params.search = search;
      const data = await getChannels(params);
      setChannels(data.channels ?? []);
      setPagination(data.pagination);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load channels.");
    } finally {
      setLoading(false);
    }
  }, [page, category, search]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);
  useEffect(() => { setPage(1); }, [tab, category, search]);

  const visible = tab === "following"
    ? channels.filter((ch) => followedChannelIds.has(String(ch._id)))
    : channels;

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      <Navbar />

      <ChannelDrawer slug={activeSlug} onClose={() => setActiveSlug(null)} />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <div className="px-4 sm:px-8 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                <Radio size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="font-display font-black text-xl text-foreground">Channels</h1>
                <p className="text-xs mt-0.5 text-muted-foreground">Follow departments and clubs to stay updated</p>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-8 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="rounded-2xl p-1 h-auto bg-card border border-border/60">
                  {[
                    { key: "all", label: "All Channels" },
                    { key: "following", label: `Following (${followedChannelIds.size})` },
                  ].map((t) => (
                    <TabsTrigger key={t.key} value={t.key} className="px-4 py-2 rounded-xl whitespace-nowrap data-active:bg-primary data-active:text-white">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {tab === "all" && (
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                  <Input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels…"
                    className="pl-9 pr-9 bg-input/30"
                  />
                  {search && (
                    <Button variant="ghost" size="icon-xs" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <X size={13} />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {tab === "all" && (
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_FILTERS.map((c) => (
                  <Button
                    key={c.value}
                    type="button"
                    variant={category === c.value ? "default" : "outline"}
                    size="xs"
                    onClick={() => setCategory(c.value)}
                    className={cn("rounded-full", category === c.value && "bg-primary hover:bg-primary/90")}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                  {Array.from({ length: 8 }).map((_, i) => <ChannelSkeleton key={i} />)}
                </motion.div>
              ) : error ? (
                <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-24 text-center">
                  <p className="text-base font-semibold mb-2 text-foreground">Failed to load channels</p>
                  <p className="text-sm mb-4 text-muted-foreground">{error}</p>
                  <Button variant="secondary" onClick={fetchChannels}>Try again</Button>
                </motion.div>
              ) : visible.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-24 text-center">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                    <Radio size={28} className="text-primary opacity-60" />
                  </div>
                  <p className="font-display font-bold text-lg text-foreground">
                    {tab === "following" ? "You're not following any channels" : "No channels found"}
                  </p>
                  <p className="text-sm mt-2 mb-5 max-w-xs text-muted-foreground">
                    {tab === "following"
                      ? "Follow channels to get notified about new events from your favourite clubs and departments."
                      : "Try a different search or category."}
                  </p>
                  {tab === "following" && (
                    <Button variant="gradient" onClick={() => setTab("all")}>Browse Channels</Button>
                  )}
                </motion.div>
              ) : (
                <motion.div key={`grid-${tab}-${page}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                  <AnimatePresence>
                    {visible.map((ch) => (
                      <ChannelCard key={ch._id} channel={ch} onSelect={(c) => setActiveSlug(c.slug)} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {tab === "all" && !loading && !error && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pb-6">
                <Button variant="outline" size="icon-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronRight size={16} className="rotate-180" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button key={p} variant={p === page ? "default" : "outline"} size="icon-sm" onClick={() => setPage(p)}
                    className={p === page ? "bg-primary hover:bg-primary/90" : ""}>
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="icon-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
