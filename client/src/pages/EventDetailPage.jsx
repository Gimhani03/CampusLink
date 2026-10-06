/**
 * EventDetailPage — Full details for a single event
 *
 * Sections:
 *   ◆ Hero — cover image, title, category/type badges, organiser
 *   ◆ Meta bar — quick stats (date, venue/link, capacity)
 *   ◆ Two-column layout:
 *       Left  — description, tags, registration questions preview
 *       Right — sticky sidebar: date card, venue card, registration card, share card
 *   ◆ Related events — same category (EventCard grid)
 *   ◆ Registration modal — question-by-question form
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Wifi, Layers, Users, Clock,
  CalendarDays, Share2, Copy, Check, X, Loader2,
  AlertCircle, Ticket, ExternalLink, ChevronRight,
  Star, Radio, Timer, Bookmark, BookmarkCheck
} from "lucide-react";
import { format, formatDistanceToNow, differenceInHours, differenceInDays, differenceInSeconds } from "date-fns";

import Navbar      from "../components/layout/Navbar";
import Sidebar     from "../components/layout/Sidebar";
import SearchModal from "../components/dashboard/SearchModal";
import EventCard   from "../components/dashboard/EventCard";
import TeamRegistrationModal from "../components/events/TeamRegistrationModal";
import { categoryMeta } from "../data/mockData";
import { getEvent } from "../services/event.service";
import { getEvents } from "../services/event.service";
import { useApp } from "../context/AppContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt      = (d) => format(new Date(d), "EEEE, d MMMM yyyy");
const fmtTime  = (d) => format(new Date(d), "h:mm a");
const fmtShort = (d) => format(new Date(d), "d MMM yyyy");

const TypeIcon = ({ type, hero = false }) => {
  const map = {
    "in-person": { Icon: MapPin,  label: "In-person", colorClass: "text-teal-300"   },
    online:      { Icon: Wifi,    label: "Online",    colorClass: "text-sky-300"     },
    hybrid:      { Icon: Layers,  label: "Hybrid",    colorClass: "text-emerald-300" },
  };
  const { Icon, label, colorClass } = map[type] || map["in-person"];
  const content = (
    <>
      <Icon size={14} /> {label}
    </>
  );
  if (hero) {
    return (
      <Badge variant="secondary" className="gap-1.5 border-white/20 bg-black/40 text-white backdrop-blur-sm shadow-sm">
        {content}
      </Badge>
    );
  }
  return (
    <span className={cn("flex items-center gap-1.5 text-sm font-medium", colorClass)}>
      {content}
    </span>
  );
};

const DeadlinePill = ({ deadline, hero = false }) => {
  if (!deadline) return null;
  const now   = new Date();
  const dl    = new Date(deadline);
  const days  = differenceInDays(dl, now);
  const hours = differenceInHours(dl, now);
  if (dl < now) return (
    <Badge variant="secondary" className={hero ? "bg-black/40 text-white/80 border-white/20" : "text-muted-foreground"}>
      Registration closed
    </Badge>
  );
  const label = days <= 0 ? `Closes in ${hours}h` : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
  return (
    <Badge
      variant="outline"
      className={cn(
        hero && "border-white/25 bg-black/40 text-white backdrop-blur-sm",
        !hero && days <= 1 && "border-destructive/30 bg-destructive/10 text-destructive",
        !hero && days > 1 && days <= 3 && "border-amber-600/30 bg-amber-50 text-orange-800",
        !hero && days > 3 && "border-primary/30 bg-primary/10 text-primary",
        hero && days <= 1 && "border-red-300/40 text-red-200",
        hero && days > 1 && days <= 3 && "border-amber-300/40 text-amber-100",
      )}
    >
      ⏰ {label}
    </Badge>
  );
};

// ─── Live countdown timer ─────────────────────────────────────────────────────

const CountdownTimer = ({ deadline }) => {
  const calcRemaining = useCallback(() => {
    const secs = differenceInSeconds(new Date(deadline), new Date());
    return Math.max(0, secs);
  }, [deadline]);

  const [remaining, setRemaining] = useState(calcRemaining);
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(calcRemaining());
    intervalRef.current = setInterval(() => {
      const s = calcRemaining();
      setRemaining(s);
      if (s <= 0) clearInterval(intervalRef.current);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [calcRemaining]);

  if (remaining <= 0) return null;

  const showDays   = remaining >= 24 * 3600;
  const dd  = String(Math.floor(remaining / 86400)).padStart(2, "0");
  const hh  = String(Math.floor((remaining % 86400) / 3600)).padStart(2, "0");
  const mm  = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const ss  = String(remaining % 60).padStart(2, "0");

  const isUrgent  = remaining < 3600;
  const isWarning = remaining < 24 * 3600;

  const containerClass = isUrgent
    ? "bg-destructive/8 border-destructive/25"
    : isWarning
      ? "bg-amber-400/8 border-amber-400/20"
      : "bg-primary/8 border-primary/20";

  const accentClass = isUrgent
    ? "text-destructive"
    : isWarning
      ? "text-slate-600"
      : "text-primary";

  const units = showDays
    ? [{ val: dd, label: "DAYS" }, { val: hh, label: "HRS" }, { val: mm, label: "MIN" }, { val: ss, label: "SEC" }]
    : [{ val: hh, label: "HRS" }, { val: mm, label: "MIN" }, { val: ss, label: "SEC" }];

  return (
    <div className={cn("rounded-2xl p-4 border", containerClass)}>
      <div className="flex items-center gap-2 mb-3">
        <Timer size={13} className={accentClass} />
        <span className={cn("text-xs font-semibold uppercase tracking-widest", accentClass)}>
          Registration Ends In
        </span>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {units.map(({ val, label }, i) => (
          <>
            <div key={label} className="flex flex-col items-center">
              <span
                className={cn(
                  "font-display font-black tabular-nums leading-none tracking-wide",
                  accentClass,
                  showDays ? "text-[1.6rem]" : "text-[2rem]",
                )}
              >
                {val}
              </span>
              <span className={cn("text-[10px] font-medium mt-0.5 uppercase tracking-widest opacity-65", accentClass)}>
                {label}
              </span>
            </div>
            {i < units.length - 1 && (
              <span className={cn("font-black text-2xl pb-3 select-none opacity-50", accentClass)}>
                :
              </span>
            )}
          </>
        ))}
      </div>

      {isUrgent && (
        <p className="text-center text-[11px] font-semibold mt-3 text-destructive">
          Hurry! Registration closes very soon.
        </p>
      )}
    </div>
  );
};

// ─── Registration Modal ───────────────────────────────────────────────────────

const RegistrationModal = ({ event, onClose, onSuccess }) => {
  const { register } = useApp();
  const questions    = event.registrationQuestions ?? [];

  const buildAnswers = (qs) =>
    qs.map((q) => ({ questionId: q._id, answer: q.questionType === "checkbox" ? [] : "" }));

  const [answers,    setAnswers]    = useState(() => buildAnswers(questions));
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    setAnswers(buildAnswers(questions));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event._id]);

  const update = (i, value) => {
    setAnswers((prev) => prev.map((a, idx) => idx === i ? { ...a, answer: value } : a));
  };

  const toggleCheckbox = (i, option) => {
    setAnswers((prev) => prev.map((a, idx) => {
      if (idx !== i) return a;
      const arr = Array.isArray(a.answer) ? a.answer : [];
      return { ...a, answer: arr.includes(option) ? arr.filter((x) => x !== option) : [...arr, option] };
    }));
  };

  const validate = () => {
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].isRequired) continue;
      const ans = answers[i]?.answer;
      if (!ans || (Array.isArray(ans) ? ans.length === 0 : ans.trim() === "")) {
        return `"${questions[i].question}" is required.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSubmitting(true);
    try {
      await register(event._id, answers);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!flex max-h-[min(92dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-primary">
            Registration
          </p>
          <DialogTitle className="font-display font-bold text-base leading-snug">
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 py-4 space-y-5 pb-2">
            {questions.length === 0 ? (
              <div className="py-4 text-center">
                <Ticket size={32} className="mx-auto mb-3 opacity-30 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  No additional questions for this event.
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Your profile details (name, email, student ID) will be used automatically.
                </p>
              </div>
            ) : (
              <>
                <Alert className="bg-primary/8 border-primary/15">
                  <AlertDescription className="text-xs text-muted-foreground">
                    Your profile details (name, email, student ID, degree, batch) are included automatically.
                    Please answer the event-specific questions below.
                  </AlertDescription>
                </Alert>
                {questions.map((q, i) => (
                  <div key={i}>
                    <Label className="block text-sm font-semibold mb-2">
                      {q.question}
                      {q.isRequired && <span className="ml-1 text-destructive">*</span>}
                    </Label>

                    {q.questionType === "text" && (
                      <Textarea
                        value={answers[i]?.answer || ""}
                        onChange={(e) => update(i, e.target.value)}
                        rows={2}
                        placeholder="Your answer…"
                        className="bg-input/30 resize-none"
                      />
                    )}

                    {q.questionType === "dropdown" && (
                      <Select
                        value={answers[i]?.answer || ""}
                        onValueChange={(v) => update(i, v)}
                      >
                        <SelectTrigger className="w-full bg-input/30">
                          <SelectValue placeholder="Select an option…" />
                        </SelectTrigger>
                        <SelectContent>
                          {q.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {q.questionType === "multiple_choice" && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            variant={answers[i]?.answer === opt ? "secondary" : "outline"}
                            onClick={() => update(i, opt)}
                            className={cn(
                              "h-auto px-3 py-2.5 text-xs font-medium text-left justify-start",
                              answers[i]?.answer === opt && "border-primary/50 bg-primary/20 text-primary",
                            )}
                          >
                            {answers[i]?.answer === opt && <Check size={11} className="mr-1.5" />}
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}

                    {q.questionType === "checkbox" && (
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const checked = Array.isArray(answers[i]?.answer) && answers[i].answer.includes(opt);
                          return (
                            <Button
                              key={opt}
                              type="button"
                              variant={checked ? "secondary" : "outline"}
                              onClick={() => toggleCheckbox(i, opt)}
                              className={cn(
                                "w-full h-auto flex items-center gap-3 px-3 py-2.5 text-sm justify-start",
                                checked && "border-primary/40 bg-primary/15 text-primary",
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded flex items-center justify-center shrink-0",
                                checked ? "bg-primary" : "bg-muted border border-border",
                              )}>
                                {checked && <Check size={10} className="text-primary-foreground" />}
                              </div>
                              {opt}
                            </Button>
                          );
                        })}
                      </div>
                    )}

                    {q.questionType === "yes_no" && (
                      <div className="flex gap-3">
                        {[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }].map(({ label, value }) => (
                          <Button
                            key={value}
                            type="button"
                            variant={answers[i]?.answer === value ? "secondary" : "outline"}
                            onClick={() => update(i, value)}
                            className={cn(
                              "flex-1 py-2.5 text-sm font-semibold",
                              answers[i]?.answer === value && value === "yes" && "border-emerald-400/40 bg-emerald-400/20 text-emerald-400",
                              answers[i]?.answer === value && value === "no" && "border-destructive/30 bg-destructive/15 text-destructive",
                            )}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-background px-5 py-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant="gradient"
            className="w-full"
            size="lg"
          >
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
              : <><Ticket size={16} /> Confirm Registration</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── CapacityBar ──────────────────────────────────────────────────────────────

const CapacityBar = ({ count, capacity, teamMode = false }) => {
  if (!capacity) return null;
  const pct   = Math.min(Math.round((count / capacity) * 100), 100);
  const remaining = capacity - count;
  const unit = teamMode ? "teams" : "registered";
  const indicatorClass = pct >= 95
    ? "[&_[data-slot=progress-indicator]]:bg-destructive"
    : pct >= 75
      ? "[&_[data-slot=progress-indicator]]:bg-amber-400"
      : "[&_[data-slot=progress-indicator]]:bg-emerald-400";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{count.toLocaleString()} {unit}</span>
        <span className={remaining <= 10 ? "text-destructive" : "text-muted-foreground"}>
          {remaining <= 0 ? "Full" : `${remaining.toLocaleString()} ${teamMode ? "teams" : "spots"} left`}
        </span>
      </div>
      <Progress value={pct} className={indicatorClass} />
    </div>
  );
};

// ─── Share Button ─────────────────────────────────────────────────────────────

const ShareButton = () => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      onClick={copy}
      variant="outline"
      className="w-full justify-center gap-2 py-2.5"
    >
      {copied
        ? <><Check size={15} className="text-emerald-400" /> Copied!</>
        : <><Copy size={15} /> Copy link</>
      }
    </Button>
  );
};

// ─── EventDetailPage ──────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { registeredEventIds, register, savedEventIds, toggleSaved } = useApp();

  const [event,         setEvent]         = useState(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [registered,    setRegistered]    = useState(false);
  const [justRegistered,setJustRegistered]= useState(false);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvent(id);
      setEvent(data);
    } catch (e) {
      setError(e.response?.data?.message || "Event not found.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  useEffect(() => {
    if (id && registeredEventIds) setRegistered(registeredEventIds.has(id));
  }, [id, registeredEventIds]);

  useEffect(() => {
    if (!event) return;
    getEvents({ category: event.category, status: "published", limit: 4 })
      .then((d) => setRelatedEvents((d.events ?? []).filter((e) => e._id !== id)))
      .catch(() => {});
  }, [event, id]);

  const handleRegistered = () => {
    setModalOpen(false);
    setRegistered(true);
    setJustRegistered(true);
    setTimeout(() => setJustRegistered(false), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-dvh mesh-bg">
        <SearchModal />
        <Navbar />
        <div className="flex max-w-screen-2xl mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0 pb-24 lg:pb-0">
            <Skeleton className="h-[360px] w-full rounded-none" />
            <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-dvh mesh-bg">
        <SearchModal />
        <Navbar />
        <div className="flex max-w-screen-2xl mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0 flex items-center justify-center py-32">
            <div className="text-center px-6">
              <CalendarDays size={40} className="mx-auto mb-4 opacity-20 text-muted-foreground" />
              <h2 className="font-display font-bold text-xl mb-2 text-foreground">Event not found</h2>
              <p className="text-sm mb-5 text-muted-foreground">{error || "This event may have been removed."}</p>
              <Button variant="gradient" onClick={() => navigate("/events")}>
                Back to Events
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const cat             = categoryMeta[event.category] ?? { label: event.category, bg: "rgba(13,107,74,0.12)", color: "var(--primary)" };
  const isDeadlinePast  = event.registrationDeadline && new Date(event.registrationDeadline) < new Date();
  const isFull          = event.capacity && event.registrationCount >= event.capacity;
  const isTeamEvent       = event.registrationMode === "team";
  const canRegister     = !registered && !isDeadlinePast && !isFull && event.status === "published";
  const hasQuestions    = (event.registrationQuestions ?? []).length > 0;
  const isSaved         = savedEventIds?.has(String(event._id)) ?? false;

  return (
    <div className="min-h-dvh mesh-bg">
      {modalOpen && (
        isTeamEvent ? (
          <TeamRegistrationModal
            event={event}
            register={register}
            onClose={() => setModalOpen(false)}
            onSuccess={handleRegistered}
          />
        ) : (
          <RegistrationModal
            event={event}
            onClose={() => setModalOpen(false)}
            onSuccess={handleRegistered}
          />
        )
      )}

      <SearchModal />
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">

          {/* ── Hero ────────────────────────────────────────────────────────── */}
          <div className="relative overflow-hidden h-[clamp(260px,38vw,420px)]">
            <img
              src={event.coverImage?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${event._id}`}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="sm"
              className="absolute top-4 left-4 bg-black/45 backdrop-blur-md text-white border-white/25 hover:bg-black/60 hover:text-white"
            >
              <ArrowLeft size={15} /> Back
            </Button>

            <Button
              onClick={() => toggleSaved(event._id)}
              variant="outline"
              size="sm"
              className={cn(
                "absolute top-4 right-4 bg-black/45 backdrop-blur-md border-white/25 hover:bg-black/60",
                isSaved ? "text-orange-200 border-amber-300/40" : "text-white hover:text-white",
              )}
              aria-label={isSaved ? "Unsave event" : "Save event"}
            >
              {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              {isSaved ? "Saved" : "Save"}
            </Button>

            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-6 pt-16">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {event.isFeatured && (
                  <Badge className="bg-primary text-white border-0 font-bold shadow-sm">
                    <Star size={10} fill="currentColor" /> FEATURED
                  </Badge>
                )}
                <Badge className="font-semibold border border-white/20 bg-black/40 text-white backdrop-blur-sm shadow-sm">
                  {cat.label}
                </Badge>
                <TypeIcon type={event.eventType} hero />
                <DeadlinePill deadline={event.registrationDeadline} hero />
              </div>

              <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl leading-tight mb-2 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                {event.title}
              </h1>

              <p className="text-sm font-medium text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                By {event.organizer}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {justRegistered && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mx-4 sm:mx-8 mt-4"
              >
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm">
                  <Check size={18} className="text-emerald-600" />
                  <AlertTitle className="font-semibold text-sm text-emerald-900">
                    You&apos;re registered!
                  </AlertTitle>
                  <AlertDescription className="text-xs text-emerald-700">
                    A unique QR pass will be emailed to each registered member.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8">

              <div className="flex-1 min-w-0 space-y-8">

                <section>
                  <h2 className="font-display font-bold text-lg mb-3 text-foreground">
                    About this event
                  </h2>
                  <div className="text-sm leading-7 whitespace-pre-line text-muted-foreground">
                    {event.description}
                  </div>
                </section>

                {event.tags?.filter(t => t !== "_seeded").length > 0 && (
                  <section>
                    <h2 className="font-display font-bold text-base mb-3 text-foreground">
                      Tags
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {event.tags.filter(t => t !== "_seeded").map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => navigate(`/events?search=${tag}`)}
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {hasQuestions && (
                  <section>
                    <h2 className="font-display font-bold text-base mb-3 text-foreground">
                      Registration requires
                    </h2>
                    <Card className="overflow-hidden py-0 gap-0">
                      {event.registrationQuestions.map((q, i) => (
                        <div key={i}>
                          {i > 0 && <Separator />}
                          <div className="flex items-start gap-3 px-4 py-3">
                            <div className="w-5 h-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 bg-primary/15">
                              <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {q.question}
                                {q.isRequired && <span className="ml-1 text-xs text-destructive">*required</span>}
                              </p>
                              {q.options?.length > 0 && (
                                <p className="text-xs mt-0.5 text-muted-foreground">
                                  {q.options.join(" · ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </Card>
                  </section>
                )}
              </div>

              <div className="lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-20 lg:self-start">

                <Card>
                  <CardContent className="space-y-4">
                    <CapacityBar count={event.registrationCount ?? 0} capacity={event.capacity} teamMode={isTeamEvent} />

                    {registered ? (
                      <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <Ticket size={18} className="text-emerald-600" />
                        <AlertTitle className="text-sm font-semibold text-emerald-900">
                          You&apos;re registered
                        </AlertTitle>
                        <AlertDescription className="text-xs text-emerald-700">
                          Check My Registrations for your pass
                        </AlertDescription>
                      </Alert>
                    ) : isFull ? (
                      <div className="py-3 text-center rounded-xl text-sm font-semibold bg-muted text-muted-foreground">
                        {isTeamEvent ? "All team slots filled" : "Event is full"}
                      </div>
                    ) : isDeadlinePast ? (
                      <div className="py-3 text-center rounded-xl text-sm font-semibold bg-muted text-muted-foreground">
                        Registration closed
                      </div>
                    ) : (
                      <Button
                        onClick={() => setModalOpen(true)}
                        variant="gradient"
                        className="w-full h-11 font-bold"
                      >
                        <Ticket size={16} />
                        {isTeamEvent ? "Register Team →" : hasQuestions ? "Register Now →" : "Register Now"}
                      </Button>
                    )}

                    {!registered && event.registrationDeadline && !isDeadlinePast && (
                      <CountdownTimer deadline={event.registrationDeadline} />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="font-display text-sm">Date & Time</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-3">
                      <CalendarDays size={16} className="mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{fmt(event.startDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtTime(event.startDate)} → {fmtTime(event.endDate)}
                        </p>
                      </div>
                    </div>
                    {format(new Date(event.startDate), "yyyy-MM-dd") !== format(new Date(event.endDate), "yyyy-MM-dd") && (
                      <div className="flex items-start gap-3">
                        <Clock size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Ends {fmt(event.endDate)}
                        </p>
                      </div>
                    )}
                    <p className="text-xs pl-7 text-primary">
                      {formatDistanceToNow(new Date(event.startDate), { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>

                {(event.eventType === "in-person" || event.eventType === "hybrid") && event.venue?.name && (
                  <Card>
                    <CardHeader className="pb-0">
                      <CardTitle className="font-display text-sm">Venue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-teal-400" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{event.venue.name}</p>
                          {event.venue.address && (
                            <p className="text-xs mt-0.5 text-muted-foreground">{event.venue.address}</p>
                          )}
                          {event.venue.mapLink && (
                            <a href={event.venue.mapLink} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs mt-2 font-medium text-primary hover:underline">
                              View on map <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(event.eventType === "online" || event.eventType === "hybrid") && event.onlineLink && (
                  <Card>
                    <CardHeader className="pb-0">
                      <CardTitle className="font-display text-sm">Online Access</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Wifi size={16} className="text-sky-400" />
                        <a href={event.onlineLink} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 hover:underline">
                          Join online <ExternalLink size={12} />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="font-display text-sm">Organizer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary">
                        <Radio size={15} className="text-white" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{event.organizer}</p>
                    </div>
                  </CardContent>
                </Card>

                <ShareButton />
              </div>
            </div>
          </div>

          {relatedEvents.length > 0 && (
            <section className="px-4 sm:px-8 py-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg text-foreground">
                  More {cat.label} events
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/events?category=${event.category}`)}
                  className="text-primary hover:text-primary/80"
                >
                  View all <ChevronRight size={13} />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {relatedEvents.slice(0, 3).map((e, i) => (
                  <EventCard key={e._id} event={e} fluid animDelay={i * 0.06} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
