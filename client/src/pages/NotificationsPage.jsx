/**
 * NotificationsPage
 *
 * Full-page notification centre. Features:
 *   • Filter tabs: All / Unread / Read
 *   • Notifications grouped by date: Today / Yesterday / This Week / Older
 *   • Per-item actions: mark read, delete, view related event
 *   • Bulk "Mark all as read" action
 *   • Real-time via SSE (already wired in useNotifications / AppContext)
 *   • Skeleton loading state
 *   • Empty state per filter
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCheck, Trash2, ExternalLink,
  Check, X, Calendar, AlertCircle, Star, Megaphone, Info,
} from "lucide-react";
import {
  isToday, isYesterday, isThisWeek, format,
} from "date-fns";
import { useApp } from "../context/AppContext";
import Navbar  from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Notification meta map ────────────────────────────────────────────────────

const NOTIF_META = {
  registration_confirmed: { Icon: Check,       iconClass: "bg-emerald-50 text-emerald-800 border-emerald-200", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Registration" },
  registration_rejected:  { Icon: X,           iconClass: "bg-red-50 text-red-800 border-red-200",         badgeClass: "bg-red-50 text-red-800 border-red-200",         label: "Registration" },
  registration_cancelled: { Icon: X,           iconClass: "bg-orange-50 text-orange-800 border-orange-200", badgeClass: "bg-orange-50 text-orange-800 border-orange-200", label: "Registration" },
  deadline_reminder:      { Icon: AlertCircle, iconClass: "bg-orange-50 text-orange-800 border-orange-200", badgeClass: "bg-orange-50 text-orange-800 border-orange-200", label: "Deadline"     },
  event_updated:          { Icon: Calendar,    iconClass: "bg-primary/10 text-primary border-primary/20",   badgeClass: "bg-primary/10 text-primary border-primary/20",   label: "Event Update" },
  event_cancelled:        { Icon: X,           iconClass: "bg-red-50 text-red-800 border-red-200",         badgeClass: "bg-red-50 text-red-800 border-red-200",         label: "Event"        },
  new_channel_event:      { Icon: Star,        iconClass: "bg-sky-50 text-sky-800 border-sky-200",           badgeClass: "bg-sky-50 text-sky-800 border-sky-200",           label: "Channel"      },
  event_starts_soon:      { Icon: Calendar,    iconClass: "bg-sky-50 text-sky-800 border-sky-200",           badgeClass: "bg-sky-50 text-sky-800 border-sky-200",           label: "Reminder"     },
  admin_announcement:     { Icon: Megaphone,   iconClass: "bg-purple-50 text-purple-800 border-purple-200",  badgeClass: "bg-purple-50 text-purple-800 border-purple-200",  label: "Announcement" },
};

const getMeta = (type) => NOTIF_META[type] ?? {
  Icon: Info,
  iconClass: "bg-slate-100 text-slate-700 border-slate-200",
  badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  label: "Notification",
};

// ─── Date group helpers ───────────────────────────────────────────────────────

const getGroup = (date) => {
  const d = new Date(date);
  if (isToday(d))     return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d))  return "This Week";
  return format(d, "MMMM yyyy");
};

const groupNotifications = (list) => {
  const groups = {};
  for (const n of list) {
    const g = getGroup(n.createdAt);
    if (!groups[g]) groups[g] = [];
    groups[g].push(n);
  }
  return groups;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <Card className="gap-0 py-0">
    <CardContent className="flex items-start gap-4 px-6 py-5">
      <Skeleton className="size-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 rounded-full" />
        <Skeleton className="h-3 w-72 rounded-full" />
        <Skeleton className="h-3 w-24 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

// ─── Notification Card ────────────────────────────────────────────────────────

const NotificationCard = ({ notification: n, onMarkRead, onDelete }) => {
  const navigate = useNavigate();
  const meta = getMeta(n.type);
  const [removing, setRemoving] = useState(false);

  const handleDelete = async () => {
    setRemoving(true);
    await onDelete(n._id);
  };

  const handleView = () => {
    if (!n.isRead) onMarkRead(n._id);
    if (n.data?.eventId) navigate(`/events/${n.data.eventId}`);
  };

  const timeStr = useMemo(() => {
    const d = new Date(n.createdAt);
    if (isToday(d))     return format(d, "h:mm a");
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  }, [n.createdAt]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: removing ? 0 : 1, x: removing ? 40 : 0, y: 0 }}
      exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
    >
      <Card
        className={cn(
          "group relative gap-0 overflow-hidden py-0 transition-all",
          n.isRead
            ? "border-border/60"
            : "border-emerald-200 bg-emerald-50/40",
        )}
      >
        {!n.isRead && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 size-2 rounded-full bg-emerald-600" />
        )}

        <CardContent className="flex items-start gap-4 pl-8 pr-6 py-5">
          <span className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5", meta.iconClass)}>
            <meta.Icon size={16} />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide font-semibold", meta.badgeClass)}>
                    {meta.label}
                  </Badge>
                  {!n.isRead && (
                    <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
                      NEW
                    </Badge>
                  )}
                </div>
                <p className="font-display font-semibold text-sm leading-snug text-foreground">
                  {n.title}
                </p>
                <p className="text-sm mt-1.5 leading-relaxed text-muted-foreground">
                  {n.body}
                </p>
              </div>

              <span className="text-xs shrink-0 mt-0.5 tabular-nums text-muted-foreground">
                {timeStr}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {n.data?.eventId && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleView}
                  className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:text-primary"
                >
                  <ExternalLink size={11} />
                  View Event
                </Button>
              )}

              {!n.isRead && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onMarkRead(n._id)}
                  className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-900"
                >
                  <Check size={11} />
                  Mark read
                </Button>
              )}

              <Button
                variant="outline"
                size="xs"
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 ml-auto text-red-800 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-900"
              >
                <Trash2 size={11} />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ─── Empty State ─────────────────────────────────────────────────────────────

const EmptyState = ({ filter }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-primary/10 border border-primary/20">
      <Bell size={28} className="text-primary" />
    </div>
    <p className="font-display font-semibold text-lg mb-1 text-foreground">
      {filter === "unread" ? "No unread notifications" :
       filter === "read"   ? "No read notifications yet" :
       "You're all caught up!"}
    </p>
    <p className="text-sm max-w-xs text-muted-foreground">
      {filter === "unread"
        ? "All notifications have been read."
        : "Notifications about your registrations, events, and channels will appear here."}
    </p>
  </motion.div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: "all",    label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read",   label: "Read" },
];

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markNotificationRead,
    markAllRead,
    deleteNotification,
    sidebarOpen,
    setSidebarOpen,
    student,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = useMemo(() => {
    if (activeFilter === "unread") return notifications.filter((n) => !n.isRead);
    if (activeFilter === "read")   return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, activeFilter]);

  const grouped = useMemo(() => groupNotifications(filtered), [filtered]);
  const groupKeys = Object.keys(grouped);

  return (
    <div className="flex h-screen overflow-hidden mesh-bg">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        student={student}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

            {/* Page header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl flex items-center justify-center bg-primary border border-primary/20 shadow-sm">
                  <Bell size={18} className="text-white" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-2xl leading-tight text-foreground">
                    Notifications
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {notifications.length === 0
                      ? "No notifications yet"
                      : `${notifications.length} notification${notifications.length !== 1 ? "s" : ""}${unreadCount > 0 ? ` · ${unreadCount} unread` : ""}`}
                  </p>
                </div>
              </div>

              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  onClick={markAllRead}
                  className="shrink-0 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-900"
                >
                  <CheckCheck size={15} />
                  Mark all read
                </Button>
              )}
            </motion.div>

            {/* Filter tabs */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6"
            >
              <Tabs value={activeFilter} onValueChange={setActiveFilter}>
                <TabsList className="w-full rounded-2xl p-1.5 h-auto bg-slate-50 border border-slate-200">
                  {FILTERS.map((f) => {
                    const isActive = activeFilter === f.id;
                    const count = f.id === "unread" ? unreadCount
                                : f.id === "all"    ? notifications.length
                                : notifications.filter((n) => n.isRead).length;
                    return (
                      <TabsTrigger
                        key={f.id}
                        value={f.id}
                        className={cn(
                          "flex-1 gap-2 py-2.5 rounded-xl text-sm font-semibold border-0 shadow-none",
                          "text-slate-600 hover:text-foreground",
                          "data-active:!bg-primary data-active:!text-white data-active:shadow-sm",
                        )}
                      >
                        {f.label}
                        {count > 0 && (
                          <span
                            className={cn(
                              "inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums leading-none",
                              isActive
                                ? "bg-white/25 text-white"
                                : "bg-white text-slate-600 border border-slate-200",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </motion.div>

            {/* Notification list */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState filter={activeFilter} />
            ) : (
              <div className="space-y-6">
                {groupKeys.map((group) => (
                  <motion.div
                    key={group}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {group}
                      </span>
                      <Separator className="flex-1" />
                    </div>

                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {grouped[group].map((n) => (
                          <NotificationCard
                            key={n._id}
                            notification={n}
                            onMarkRead={markNotificationRead}
                            onDelete={deleteNotification}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
