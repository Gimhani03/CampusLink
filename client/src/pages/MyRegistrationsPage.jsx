/**
 * MyRegistrationsPage — Student's event registrations
 *
 * Features:
 *   ◆ Tab filter — All / Upcoming / Past / Cancelled
 *   ◆ Registration cards with event snapshot, status badge, answers
 *   ◆ Collapsible answers panel per registration
 *   ◆ Cancel registration with confirmation dialog
 *   ◆ Skeleton loaders + empty states
 *   ◆ Pagination
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, MapPin, Wifi, Layers, Ticket, ChevronDown,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
  Clock, XCircle, ExternalLink, Loader2, X, TriangleAlert, Users, QrCode,
} from "lucide-react";
import { ROLE_LABELS } from "../constants/teamRegistration";
import { format, formatDistanceToNow, isPast } from "date-fns";

import Navbar      from "../components/layout/Navbar";
import Sidebar     from "../components/layout/Sidebar";
import SearchModal from "../components/dashboard/SearchModal";
import EventPassModal from "../components/common/EventPassModal";
import { categoryMeta } from "../data/mockData";
import { getMyRegistrations, cancelRegistration } from "../services/registration.service";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt      = (d) => format(new Date(d), "EEE, d MMM yyyy");
const fmtTime  = (d) => format(new Date(d), "h:mm a");

const matchesCurrentUser = (member, user) => {
  if (!member || !user) return false;
  if (member.user && String(member.user) === String(user._id)) return true;
  if (user.studentId && member.studentId && member.studentId === user.studentId.trim().toUpperCase()) {
    return true;
  }
  if (user.email && member.personalEmail && member.personalEmail === user.email.trim().toLowerCase()) {
    return true;
  }
  return false;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP = {
  confirmed:  { label: "Confirmed",  className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", Icon: CheckCircle2 },
  waitlisted: { label: "Waitlisted", className: "bg-amber-500/12 text-slate-600 border-amber-500/25",         Icon: Clock        },
  cancelled:  { label: "Cancelled",  className: "bg-muted text-muted-foreground border-border/60",            Icon: XCircle      },
};

const StatusBadge = ({ status }) => {
  const { label, className, Icon } = STATUS_MAP[status] ?? STATUS_MAP.cancelled;
  return (
    <Badge variant="outline" className={`gap-1.5 font-semibold ${className}`}>
      <Icon size={11} />
      {label}
    </Badge>
  );
};

// ─── Event type icon ──────────────────────────────────────────────────────────

const TypeIcon = ({ type }) => {
  const map = {
    "in-person": { Icon: MapPin,  className: "text-teal-400"   },
    online:      { Icon: Wifi,    className: "text-sky-400"    },
    hybrid:      { Icon: Layers,  className: "text-primary" },
  };
  const { Icon, className } = map[type] || map["in-person"];
  return <Icon size={13} className={className} />;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const RegistrationSkeleton = () => (
  <Card className="overflow-hidden py-0 gap-0">
    <div className="flex gap-0">
      <Skeleton className="w-32 sm:w-44 shrink-0 h-[130px] rounded-none" />
      <CardContent className="flex-1 p-4 space-y-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/5" />
      </CardContent>
    </div>
  </Card>
);

// ─── Cancel confirmation dialog ───────────────────────────────────────────────

const CancelDialog = ({ eventTitle, open, onConfirm, onClose, loading }) => (
  <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-destructive/15">
          <TriangleAlert className="text-destructive" />
        </AlertDialogMedia>
        <AlertDialogTitle className="font-display">Cancel registration?</AlertDialogTitle>
        <AlertDialogDescription>
          You're about to cancel your spot for <strong className="text-foreground">"{eventTitle}"</strong>.
          This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading}>Keep it</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          {loading ? "Cancelling…" : "Yes, cancel"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// ─── Single Registration Card ─────────────────────────────────────────────────

const RegistrationCard = ({ reg, onCancelled, onViewPass }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded,  setExpanded]  = useState(false);
  const [showDialog,setShowDialog]= useState(false);
  const [cancelling,setCancelling]= useState(false);
  const [cancelErr, setCancelErr] = useState(null);

  const event      = reg.event;
  const cat        = categoryMeta[event?.category] ?? { label: event?.category, bg: "rgba(13,107,74,0.12)", color: "var(--primary)" };
  const isUpcoming = event?.startDate && !isPast(new Date(event.startDate));
  const isRegistrant = String(reg.student?._id ?? reg.student) === String(user?._id);
  const myTeamMember = reg.team?.members?.find((member) => matchesCurrentUser(member, user));
  const canCancel  = isRegistrant && (reg.status === "confirmed" || reg.status === "waitlisted");
  const canViewPass  = reg.status === "confirmed";
  const hasAnswers = reg.answers?.length > 0;
  const hasTeam    = Boolean(reg.team);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelErr(null);
    try {
      await cancelRegistration(reg._id);
      setShowDialog(false);
      onCancelled(reg._id);
    } catch (e) {
      setCancelErr(e.response?.data?.message || "Failed to cancel. Please try again.");
      setCancelling(false);
    }
  };

  if (!event && reg.status !== "cancelled") return null;

  if (!event) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
      >
        <Card className="overflow-hidden opacity-60 py-0 gap-0">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-28 sm:w-40 h-20 rounded-xl shrink-0 flex items-center justify-center bg-muted">
              <Ticket size={24} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold mb-1 text-muted-foreground">CANCELLED REGISTRATION</p>
              <p className="font-display font-bold text-sm text-muted-foreground">Event no longer available</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Cancelled {formatDistanceToNow(new Date(reg.createdAt), { addSuffix: true })}
              </p>
            </div>
            <StatusBadge status="cancelled" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <>
      <CancelDialog
        eventTitle={event.title}
        open={showDialog}
        onConfirm={handleCancel}
        onClose={() => setShowDialog(false)}
        loading={cancelling}
      />

      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
      >
        <Card className="overflow-hidden py-0 gap-0">
          <div className="flex">
            <div
              className="w-28 sm:w-40 shrink-0 relative overflow-hidden cursor-pointer min-h-[120px]"
              onClick={() => navigate(`/events/${event._id}`)}
            >
              <img
                src={event.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${event._id}`}
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-card" />
            </div>

            <CardContent className="flex-1 min-w-0 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-xs font-bold border-0"
                  style={{ background: cat.bg, color: cat.color }}
                >
                  {cat.label}
                </Badge>
                <StatusBadge status={reg.status} />
              </div>

              <h3
                className="font-display font-bold leading-snug line-clamp-2 cursor-pointer hover:underline text-[15px] text-foreground"
                onClick={() => navigate(`/events/${event._id}`)}
              >
                {event.title}
              </h3>

              {hasTeam && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1.5 bg-primary/12 text-primary border-primary/20">
                    <Users size={11} />
                    {reg.team.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {reg.team.university} · {reg.team.size} members
                    {myTeamMember?.role ? ` · Your role: ${ROLE_LABELS[myTeamMember.role]}` : ""}
                    {isRegistrant ? ` · You registered the team` : ""}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays size={12} />
                  <span>{fmt(event.startDate)} · {fmtTime(event.startDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TypeIcon type={event.eventType} />
                  <span className="truncate">{event.venue?.name || event.onlineLink || "Online"}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Registered {formatDistanceToNow(new Date(reg.createdAt), { addSuffix: true })}
              </p>

              <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => navigate(`/events/${event._id}`)}
                  className="bg-primary/12 text-primary border-primary/20 hover:bg-primary/20"
                >
                  View event <ExternalLink size={11} />
                </Button>

                {canViewPass && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => onViewPass(reg._id)}
                    className="bg-emerald-500/12 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    <QrCode size={11} /> View pass
                  </Button>
                )}

                {canCancel && isUpcoming && (
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => setShowDialog(true)}
                  >
                    <X size={11} /> Cancel
                  </Button>
                )}

                {(hasAnswers || hasTeam) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setExpanded((v) => !v)}
                    className="ml-auto text-muted-foreground"
                  >
                    {hasTeam ? "Team details" : `${reg.answers.length} answer${reg.answers.length !== 1 ? "s" : ""}`}
                    <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={13} />
                    </motion.span>
                  </Button>
                )}
              </div>

              {cancelErr && (
                <p className="flex items-center gap-1.5 text-xs mt-1 text-destructive">
                  <AlertCircle size={12} /> {cancelErr}
                </p>
              )}
            </CardContent>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (hasAnswers || hasTeam) && (
              <motion.div
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <CardContent className="px-4 pb-4 pt-1 border-t border-border/60">
                  {hasTeam && (
                    <div className="mb-4 pt-3">
                      <p className="text-xs font-semibold mb-3 text-muted-foreground">Team members</p>
                      <div className="space-y-2">
                        {(reg.team.members ?? []).map((m) => (
                          <div key={m.role} className="p-3 rounded-xl text-xs bg-muted border border-border/60">
                            <p className="font-semibold mb-1 text-foreground">
                              {ROLE_LABELS[m.role] ?? m.role}
                              {matchesCurrentUser(m, user) && (
                                <span className="ml-2 font-normal text-primary">(You)</span>
                              )}
                            </p>
                            <p className="text-muted-foreground">{m.fullName} · {m.personalEmail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasAnswers && (
                    <>
                      <p className="text-xs font-semibold mb-3 pt-3 text-muted-foreground">
                        Your registration answers
                      </p>
                      <div className="space-y-2.5">
                        {reg.answers.map((a, i) => (
                          <div key={i}>
                            <p className="text-xs font-medium mb-0.5 text-muted-foreground">{a.question}</p>
                            <p className="text-sm font-semibold text-foreground">
                              {Array.isArray(a.answer) ? a.answer.join(", ") : (a.answer || "—")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </>
  );
};

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",       label: "All" },
  { key: "upcoming",  label: "Upcoming" },
  { key: "past",      label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyRegistrationsPage() {
  const [tab,           setTab]           = useState("all");
  const [registrations, setRegistrations] = useState([]);
  const [pagination,    setPagination]    = useState(null);
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [passRegId,     setPassRegId]     = useState(null);

  const LIMIT = 10;

  const fetchRegs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (tab === "upcoming")  { params.upcoming = "true"; }
      if (tab === "cancelled") { params.status = "cancelled"; }

      const data = await getMyRegistrations(params);
      let regs = data.registrations ?? [];

      if (tab === "past") {
        const now = new Date();
        regs = regs.filter(
          (r) => r.status !== "cancelled" && r.event && new Date(r.event.startDate) <= now
        );
      }

      setRegistrations(regs);
      setPagination(data.pagination);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load registrations.");
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { fetchRegs(); }, [fetchRegs]);
  useEffect(() => { setPage(1); }, [tab]);

  const handleCancelled = (registrationId) => {
    setRegistrations((prev) =>
      prev.map((r) =>
        r._id === registrationId ? { ...r, status: "cancelled" } : r
      )
    );
  };

  const visible =
    tab === "cancelled"
      ? registrations
      : tab === "past"
      ? registrations.filter((r) => r.status !== "cancelled")
      : registrations.filter((r) => r.status !== "cancelled");

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      {passRegId && (
        <EventPassModal
          registrationId={passRegId}
          open
          onClose={() => setPassRegId(null)}
        />
      )}
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <div className="px-4 sm:px-8 pt-6 pb-4 flex items-center gap-3 border-b border-border/60">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
              <Ticket size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-foreground">My Registrations</h1>
              <p className="text-xs mt-0.5 text-muted-foreground">All your event registrations in one place</p>
            </div>
          </div>

          <div className="px-4 sm:px-8 pt-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="rounded-2xl p-1 h-auto w-fit bg-card border border-border/60">
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.key}
                    value={t.key}
                    className="px-4 py-2 rounded-xl data-active:bg-primary data-active:text-white"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="px-4 sm:px-8 py-6 max-w-3xl space-y-4">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <RegistrationSkeleton key={i} />)}
                </motion.div>
              ) : error ? (
                <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                  <AlertCircle size={36} className="mb-3 opacity-40 text-destructive" />
                  <p className="font-semibold text-base text-foreground">Something went wrong</p>
                  <p className="text-sm mt-1 mb-4 text-muted-foreground">{error}</p>
                  <Button variant="secondary" onClick={fetchRegs}>Try again</Button>
                </motion.div>
              ) : visible.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                    <Ticket size={28} className="text-primary opacity-60" />
                  </div>
                  <p className="font-display font-bold text-lg text-foreground">
                    {tab === "all"       ? "No registrations yet"        :
                     tab === "upcoming"  ? "No upcoming events"          :
                     tab === "past"      ? "No past events"              :
                                          "No cancelled registrations"}
                  </p>
                  <p className="text-sm mt-2 mb-5 max-w-xs text-muted-foreground">
                    {tab === "all" || tab === "upcoming"
                      ? "Browse events and register for something exciting!"
                      : tab === "past"
                      ? "Events you've attended will show up here."
                      : "Registrations you've cancelled will appear here."}
                  </p>
                  {(tab === "all" || tab === "upcoming") && (
                    <Button variant="gradient" onClick={() => window.location.assign("/events")}>
                      Browse Events
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div key={`list-${tab}-${page}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <AnimatePresence>
                    {visible.map((reg) => (
                      <RegistrationCard
                        key={reg._id}
                        reg={reg}
                        onCancelled={handleCancelled}
                        onViewPass={setPassRegId}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {!loading && !error && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e-${i}`} className="w-9 h-9 flex items-center justify-center text-sm text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="icon-sm"
                        onClick={() => setPage(p)}
                        className={p === page ? "bg-primary hover:bg-primary/90" : ""}
                      >
                        {p}
                      </Button>
                    )
                  )}

                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
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
