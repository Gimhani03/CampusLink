/**
 * EditEventForm.jsx
 *
 * Pre-populated admin form for updating an existing event.
 * Submits PUT /api/v1/events/:id with multipart/form-data.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, Plus, Save, RefreshCw,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle, Loader2,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import RegistrationQuestionRow from "./RegistrationQuestionRow";
import TeamRegistrationFieldsPanel from "./TeamRegistrationFieldsPanel";
import { stripLegacyTeamQuestions } from "../../constants/teamRegistration";
import { isUniversityRegistrationQuestion } from "../../constants/registrationQuestions";
import { AUDIENCE_SCOPE_LABELS } from "../../constants/eventAudience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const FormField = ({ label, required, error, hint, children, className = "" }) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {label && (
      <Label className="text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const SectionCard = ({ title, children }) => (
  <Card>
    <CardHeader className="border-b border-border pb-4">
      <CardTitle className="font-display text-sm">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const TagInput = ({ tags, onChange }) => {
  const [input, setInput] = useState("");
  const addTag = () => {
    const t = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap gap-2 p-2.5 rounded-xl min-h-10 bg-input/30 border border-border">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="gap-1 bg-slate-100 text-slate-700 border-slate-300">
          #{tag}
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange(tags.filter((t) => t !== tag))} className="size-4 p-0 hover:bg-transparent">
            <X className="size-2.5" />
          </Button>
        </Badge>
      ))}
      <Input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addTag())}
        onBlur={addTag}
        placeholder="Add tag, press Enter"
        className="flex-1 min-w-24 h-7 border-0 shadow-none bg-transparent text-xs focus-visible:ring-0 px-1"
      />
    </div>
  );
};

const ImageUpload = ({ currentUrl, newFile, onChange }) => {
  const inputRef = useRef(null);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ file, previewUrl: URL.createObjectURL(file) });
  };
  const displayUrl = newFile?.previewUrl || currentUrl;

  return (
    <div className="space-y-2">
      {displayUrl ? (
        <div className="relative rounded-2xl overflow-hidden h-[200px]">
          <img src={displayUrl} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-end justify-between p-3 bg-gradient-to-t from-black/60 to-transparent">
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="size-3" /> Replace
            </Button>
            {newFile && (
              <Badge className="bg-emerald-500/90 text-emerald-950 border-0">New image selected</Badge>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full h-auto flex-col gap-3 py-10 rounded-2xl border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"
        >
          <Upload className="size-5 text-slate-700" />
          <p className="text-sm font-medium text-muted-foreground">Click to upload cover image</p>
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

const toDatetimeLocal = (val) => {
  if (!val) return "";
  try {
    const d   = new Date(val);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
};

const CATEGORIES = [
  "academic","cultural","sports","technology",
  "career","social","religious","competition","other",
];

export default function EditEventForm() {
  const { editingEvent, editEvent, setActiveSection, setEditingEvent } = useAdmin();

  const [form,     setForm]     = useState(null);
  const [errors,   setErrors]   = useState({});
  const [apiError, setApiError] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    if (!editingEvent) return;
    const e = editingEvent;
    setForm({
      title:                e.title         ?? "",
      description:          e.description   ?? "",
      category:             e.category      ?? "technology",
      tags:                 e.tags          ?? [],
      organizer:            e.organizer     ?? "",
      channel:              e.channel       ?? "",
      eventType:            e.eventType     ?? "in-person",
      venueName:            e.venue?.name   ?? "",
      venueAddress:         e.venue?.address?? "",
      venueMapLink:         e.venue?.mapLink ?? "",
      onlineLink:           e.onlineLink    ?? "",
      startDate:            toDatetimeLocal(e.startDate),
      endDate:              toDatetimeLocal(e.endDate),
      registrationDeadline: toDatetimeLocal(e.registrationDeadline),
      capacity:             e.capacity != null ? String(e.capacity) : "",
      isUnlimited:          e.capacity == null,
      isFeatured:           e.isFeatured    ?? false,
      status:               e.status        ?? "draft",
      registrationMode:     e.registrationMode ?? "individual",
      audienceScope:        e.audienceScope ?? "campus",
      minTeamSize:          e.minTeamSize != null ? String(e.minTeamSize) : "2",
      maxTeamSize:          e.maxTeamSize != null ? String(e.maxTeamSize) : "4",
      existingImageUrl:     e.coverImage?.url ?? "",
      newCoverImage:        null,
      registrationQuestions: (() => {
        const mode = e.registrationMode ?? "individual";
        const qs = (e.registrationQuestions ?? []).map((q) => ({
          ...q,
          _clientId: q._id ?? String(Date.now() + Math.random()),
        }));
        if (mode === "team") return stripLegacyTeamQuestions(qs);
        return qs.filter((q) => !isUniversityRegistrationQuestion(q));
      })(),
    });
    setErrors({});
    setApiError("");
    setSaved(false);
  }, [editingEvent]);

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const sanitizeQuestions = (questions, mode) => {
    let qs = questions;
    if (mode === "team") qs = stripLegacyTeamQuestions(qs);
    else qs = qs.filter((q) => !isUniversityRegistrationQuestion(q));
    return qs;
  };

  const setRegistrationMode = (mode) => {
    setForm((p) => ({
      ...p,
      registrationMode: mode,
      audienceScope: mode === "team" ? "inter_university" : p.audienceScope,
      minTeamSize: mode === "team" ? (p.minTeamSize || "2") : p.minTeamSize,
      maxTeamSize: mode === "team" ? (p.maxTeamSize || "4") : p.maxTeamSize,
      registrationQuestions: sanitizeQuestions(p.registrationQuestions, mode),
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim())              e.title = "Title is required.";
    else if (form.title.trim().length < 5) e.title = "Title must be at least 5 characters.";
    if (!form.description.trim())        e.description = "Description is required.";
    else if (form.description.trim().length < 20) e.description = "Description must be at least 20 characters.";
    if (!form.organizer.trim())          e.organizer = "Organiser is required.";
    if (!form.startDate)                 e.startDate = "Start date is required.";
    if (!form.endDate)                   e.endDate = "End date is required.";
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate))
                                         e.endDate = "End date must be after start date.";
    if (form.registrationDeadline && form.startDate &&
        new Date(form.registrationDeadline) >= new Date(form.startDate))
                                         e.registrationDeadline = "Deadline must be before start date.";
    if ((form.eventType === "in-person" || form.eventType === "hybrid") && !form.venueName.trim())
                                         e.venueName = "Venue name is required.";
    if ((form.eventType === "online" || form.eventType === "hybrid") && !form.onlineLink.trim())
                                         e.onlineLink = "Online link is required.";
    if (form.registrationMode === "team") {
      const min = Number(form.minTeamSize);
      const max = Number(form.maxTeamSize);
      if (!min || min < 2 || min > 5) e.minTeamSize = "Minimum team size must be between 2 and 5.";
      if (!max || max < 2 || max > 5) e.maxTeamSize = "Member limit must be between 2 and 5.";
      if (!e.minTeamSize && !e.maxTeamSize && min > max) {
        e.maxTeamSize = "Member limit must be at least the minimum team size.";
      }
    }
    return e;
  };

  const addQuestion = () => set("registrationQuestions", [
    ...form.registrationQuestions,
    { _clientId: String(Date.now()), question: "", questionType: "text", isRequired: false, options: [] },
  ]);

  const updateQuestion = (cid, updated) =>
    set("registrationQuestions", form.registrationQuestions.map((q) => q._clientId === cid ? updated : q));

  const removeQuestion = (cid) =>
    set("registrationQuestions", form.registrationQuestions.filter((q) => q._clientId !== cid));

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("title",       form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("category",    form.category);
    fd.append("organizer",   form.organizer.trim());
    fd.append("eventType",   form.eventType);
    fd.append("status",      form.status);
    fd.append("isFeatured",  String(form.isFeatured));
    fd.append("registrationMode", form.registrationMode);
    fd.append("audienceScope", form.audienceScope);
    if (form.registrationMode === "team") {
      fd.append("minTeamSize", String(Number(form.minTeamSize)));
      fd.append("maxTeamSize", String(Number(form.maxTeamSize)));
    }
    if (form.startDate)            fd.append("startDate",            form.startDate);
    if (form.endDate)              fd.append("endDate",              form.endDate);
    if (form.registrationDeadline) fd.append("registrationDeadline", form.registrationDeadline);
    if (!form.isUnlimited && form.capacity) fd.append("capacity", String(Number(form.capacity)));
    fd.append("tags", JSON.stringify(form.tags));
    fd.append("venue", JSON.stringify({
      name:    form.venueName.trim(),
      address: form.venueAddress.trim(),
      mapLink: form.venueMapLink.trim(),
    }));
    if (form.onlineLink.trim()) fd.append("onlineLink", form.onlineLink.trim());
    if (form.channel?.trim?.()) fd.append("channel", form.channel.trim());
    const questions = sanitizeQuestions(form.registrationQuestions, form.registrationMode)
      .map(({ _clientId, ...rest }) => rest);
    fd.append("registrationQuestions", JSON.stringify(questions));
    if (form.newCoverImage?.file) fd.append("coverImage", form.newCoverImage.file);
    return fd;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    setApiError("");
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await editEvent(editingEvent._id, buildFormData());
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setEditingEvent(null);
        setActiveSection("events");
      }, 1800);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.map((e) => e.msg).join(" · ") ||
        "Failed to save event. Please try again.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!editingEvent || !form) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-muted-foreground">No event selected for editing.</p>
        <Button variant="outline" size="sm" onClick={() => setActiveSection("events")}
          className="text-slate-700 border-slate-300 bg-slate-100">
          Back to Events
        </Button>
      </div>
    );
  }

  if (saved) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="size-16 rounded-full flex items-center justify-center bg-emerald-500/15">
          <CheckCircle className="size-7 text-emerald-400" />
        </div>
        <p className="font-display font-bold text-xl text-foreground">Changes Saved!</p>
        <p className="text-sm text-muted-foreground">Redirecting to All Events…</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200">
        <RefreshCw className="size-3.5 text-slate-700 shrink-0" />
        <span className="text-xs font-semibold text-slate-700">Editing:</span>
        <span className="text-xs truncate text-muted-foreground">{editingEvent.title}</span>
      </div>

      {apiError && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/25">
          <AlertCircle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-2">
            {apiError}
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => setApiError("")}>
              <X className="size-3.5" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <SectionCard title="Basic Information">
        <div className="space-y-4">
          <FormField label="Event Title" required error={errors.title}>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. IEEE Tech Summit 2026" aria-invalid={!!errors.title} className="bg-input/30" />
          </FormField>
          <FormField label="Description" required error={errors.description}>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={4} aria-invalid={!!errors.description} className="bg-input/30 resize-none" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" required>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="w-full bg-input/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Organiser" required error={errors.organizer}>
              <Input value={form.organizer} onChange={(e) => set("organizer", e.target.value)}
                placeholder="e.g. IEEE Student Branch" aria-invalid={!!errors.organizer} className="bg-input/30" />
            </FormField>
          </div>
          <FormField label="Tags" hint="Press Enter or comma to add">
            <TagInput tags={form.tags} onChange={(t) => set("tags", t)} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Schedule">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Start Date & Time" required error={errors.startDate}>
            <Input type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
              aria-invalid={!!errors.startDate} className="bg-input/30 dark:[color-scheme:dark]" />
          </FormField>
          <FormField label="End Date & Time" required error={errors.endDate}>
            <Input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
              aria-invalid={!!errors.endDate} className="bg-input/30 dark:[color-scheme:dark]" />
          </FormField>
          <FormField label="Registration Deadline" error={errors.registrationDeadline} hint="Must be before start date">
            <Input type="datetime-local" value={form.registrationDeadline} onChange={(e) => set("registrationDeadline", e.target.value)}
              className="bg-input/30 dark:[color-scheme:dark]" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Location & Format">
        <div className="space-y-4">
          <FormField label="Event Type" required>
            <div className="flex gap-3">
              {[
                { value: "in-person", label: "In-Person" },
                { value: "online",    label: "Online"    },
                { value: "hybrid",    label: "Hybrid"    },
              ].map(({ value, label }) => (
                <Button key={value} type="button"
                  variant={form.eventType === value ? "secondary" : "outline"}
                  className={cn("flex-1", form.eventType === value && "text-slate-700 border-slate-400 bg-slate-100")}
                  onClick={() => set("eventType", value)}>
                  {label}
                </Button>
              ))}
            </div>
          </FormField>
          {(form.eventType === "in-person" || form.eventType === "hybrid") && (
            <div className="space-y-3">
              <FormField label="Venue Name" required error={errors.venueName}>
                <Input value={form.venueName} onChange={(e) => set("venueName", e.target.value)}
                  placeholder="e.g. Engineering Faculty Auditorium" aria-invalid={!!errors.venueName} className="bg-input/30" />
              </FormField>
              <FormField label="Venue Address" hint="Optional">
                <Input value={form.venueAddress} onChange={(e) => set("venueAddress", e.target.value)}
                  placeholder="e.g. University of Colombo, Reid Avenue" className="bg-input/30" />
              </FormField>
              <FormField label="Map Link" hint="Optional">
                <Input value={form.venueMapLink} onChange={(e) => set("venueMapLink", e.target.value)}
                  placeholder="https://maps.google.com/…" className="bg-input/30" />
              </FormField>
            </div>
          )}
          {(form.eventType === "online" || form.eventType === "hybrid") && (
            <FormField label="Online Link" required error={errors.onlineLink}>
              <Input value={form.onlineLink} onChange={(e) => set("onlineLink", e.target.value)}
                placeholder="https://zoom.us/…" aria-invalid={!!errors.onlineLink} className="bg-input/30" />
            </FormField>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Capacity & Registration Questions">
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button type="button" size="sm" variant={form.registrationMode === "individual" ? "default" : "outline"}
              onClick={() => setRegistrationMode("individual")}>Individual registration</Button>
            <Button type="button" size="sm" variant={form.registrationMode === "team" ? "default" : "outline"}
              onClick={() => setRegistrationMode("team")}>Team registration (hackathon)</Button>
          </div>
          {form.registrationMode === "team" && <TeamRegistrationFieldsPanel />}
          {form.registrationMode === "team" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Minimum team size" error={errors.minTeamSize}>
                <Input type="number" min={2} max={5} value={form.minTeamSize}
                  onChange={(e) => set("minTeamSize", e.target.value)} placeholder="e.g. 2" className="bg-input/30" />
              </FormField>
              <FormField label="Member limit per team" error={errors.maxTeamSize}>
                <Input type="number" min={2} max={5} value={form.maxTeamSize}
                  onChange={(e) => set("maxTeamSize", e.target.value)} placeholder="e.g. 4" className="bg-input/30" />
              </FormField>
            </div>
          )}
          {form.registrationMode === "team" && (
            <p className="text-[11px] -mt-2 text-muted-foreground">
              Students choose a team size within this range when registering. Platform limit: 2–5 members.
            </p>
          )}
          <FormField label="Who can see & register?">
            <Select value={form.audienceScope} onValueChange={(v) => set("audienceScope", v)}>
              <SelectTrigger className="w-full bg-input/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(AUDIENCE_SCOPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <p className="text-[11px] -mt-2 text-muted-foreground">
            Inter-university events appear for guest students from other universities. Campus-only events are hidden from them.
          </p>
          <div className="flex items-center gap-4">
            <FormField label={form.registrationMode === "team" ? "Max teams" : "Capacity"} className="flex-1">
              <Input type="number" value={form.capacity} onChange={(e) => set("capacity", e.target.value)}
                placeholder={form.registrationMode === "team" ? "e.g. 50" : "e.g. 200"}
                disabled={form.isUnlimited} className="bg-input/30" />
            </FormField>
            <Button type="button" variant="ghost" size="sm"
              className={cn("mt-6", form.isUnlimited ? "text-slate-700" : "text-muted-foreground")}
              onClick={() => set("isUnlimited", !form.isUnlimited)}>
              {form.isUnlimited ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />} Unlimited
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-semibold text-muted-foreground">
                {form.registrationMode === "team"
                  ? `Additional Questions (${form.registrationQuestions.length})`
                  : `Registration Questions (${form.registrationQuestions.length})`}
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addQuestion}
                className="text-slate-700 border-slate-300 bg-slate-100">
                <Plus className="size-3" /> Add Question
              </Button>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {form.registrationQuestions.map((q, i) => (
                  <motion.div key={q._clientId}
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <RegistrationQuestionRow q={q} index={i}
                      onChange={(updated) => updateQuestion(q._clientId, updated)}
                      onRemove={() => removeQuestion(q._clientId)} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {form.registrationQuestions.length === 0 && (
                <p className="text-xs text-center py-6 text-muted-foreground/60">
                  {form.registrationMode === "team"
                    ? "No extra questions. Team name, university, and member details are collected automatically."
                    : "No questions added. Students will only submit their profile information."}
                </p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cover Image">
        <ImageUpload currentUrl={form.existingImageUrl} newFile={form.newCoverImage}
          onChange={(img) => set("newCoverImage", img)} />
      </SectionCard>

      <SectionCard title="Settings">
        <div className="flex flex-wrap gap-6">
          <Button type="button" variant="ghost" size="sm"
            className={form.isFeatured ? "text-slate-700" : "text-muted-foreground"}
            onClick={() => set("isFeatured", !form.isFeatured)}>
            {form.isFeatured ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />} Feature this event
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="w-[130px] bg-input/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft","published","cancelled","completed"].map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <Separator />

      <div className="flex items-center gap-3 pb-4">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Changes
        </Button>
        <Button variant="outline" onClick={() => { setEditingEvent(null); setActiveSection("events"); }} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
