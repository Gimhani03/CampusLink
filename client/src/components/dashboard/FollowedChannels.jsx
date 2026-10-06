/**
 * FollowedChannels — Dashboard widget
 *
 * Shows the student's followed channels from the real API.
 * Falls back to "all channels" view so the widget is never empty on first load.
 * Follow/unfollow is wired to AppContext so the header count stays in sync.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Radio, Users, CalendarDays, Plus, Check, Loader2 } from "lucide-react";

import { getChannels } from "../../services/channel.service";
import { useApp }      from "../../context/AppContext";
import { formatCount } from "../../utils/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CAT_COLORS = {
  technology:  "#38bdf8",
  academic:    "#0d6b4a",
  career:      "#34d399",
  cultural:    "#fbbf24",
  sports:      "#f87171",
  social:      "#e879f9",
  competition: "#fb923c",
  other:       "#94a3b8",
};

const getAccent  = (cat) => CAT_COLORS[cat] ?? "#0d6b4a";
const getInitials = (name = "") =>
  name.split(/[\s&\-–—]+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

const ChannelRow = ({ channel, index }) => {
  const { followedChannelIds, toggleChannelFollow } = useApp();
  const [following,     setFollowing]     = useState(() => followedChannelIds.has(String(channel._id)));
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    setFollowing(followedChannelIds.has(String(channel._id)));
  }, [followedChannelIds, channel._id]);

  const accent   = getAccent(channel.category);
  const initials = getInitials(channel.name);

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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card className="py-0 hover:border-border hover:bg-accent/30 transition-all">
        <CardContent className="flex items-center gap-4 p-4">
          {channel.avatar?.url ? (
            <img
              src={channel.avatar.url}
              alt={channel.name}
              className="w-12 h-12 rounded-xl shrink-0 object-cover"
              style={{ border: `1.5px solid ${accent}40` }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-sm shrink-0"
              style={{
                background: `${accent}20`,
                color:      accent,
                border:     `1.5px solid ${accent}40`,
              }}
            >
              {initials || <Radio size={14} />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm truncate text-foreground">
              {channel.name}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={11} />
                {formatCount(channel.followerCount ?? 0)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays size={11} />
                {channel.eventCount ?? 0} events
              </span>
            </div>
          </div>

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="xs"
              onClick={handleFollow}
              disabled={loadingFollow}
              className={cn(
                "shrink-0 gap-1.5 font-semibold",
                following
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/15"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {loadingFollow
                ? <Loader2 size={11} className="animate-spin" />
                : following
                  ? <><Check size={11} /> Following</>
                  : <><Plus  size={11} /> Follow</>
              }
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const RowSkeleton = () => (
  <Card className="py-0">
    <CardContent className="flex items-center gap-4 p-4">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-20 h-7 rounded-lg" />
    </CardContent>
  </Card>
);

const MAX_COLLAPSED = 4;

export default function FollowedChannels() {
  const navigate = useNavigate();
  const { followedChannelIds } = useApp();

  const [channels, setChannels] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAll,  setShowAll]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChannels({ limit: 20 })
      .then(({ channels: list }) => {
        if (!cancelled) {
          const sorted = [...list].sort((a, b) => {
            const aF = followedChannelIds.has(String(a._id)) ? 0 : 1;
            const bF = followedChannelIds.has(String(b._id)) ? 0 : 1;
            return aF - bF;
          });
          setChannels(sorted);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = showAll ? channels : channels.slice(0, MAX_COLLAPSED);
  const hiddenCount = channels.length - MAX_COLLAPSED;

  return (
    <section className="px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-teal-400/15">
            <Radio size={13} className="text-teal-400" />
          </div>
          <h2 className="font-display font-bold text-lg text-foreground">Channels</h2>
        </div>
        <Button
          variant="link"
          size="xs"
          onClick={() => navigate("/channels")}
          className="h-auto p-0 text-primary"
        >
          Browse all
        </Button>
      </div>

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)
          : displayed.map((ch, i) => <ChannelRow key={ch._id} channel={ch} index={i} />)
        }
      </div>

      {!loading && hiddenCount > 0 && (
        <Button
          variant="outline"
          onClick={() => setShowAll((p) => !p)}
          className="mt-3 w-full text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </Button>
      )}
    </section>
  );
}
