/**
 * CreateEventForm.jsx
 *
 * Admin form for creating a new event.
 * Submits via multipart/form-data so the cover image can be uploaded
 * to Cloudinary in a single request.
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, Plus, Save, Send,
  Image as ImageIcon, AlertCircle,
  ToggleLeft, ToggleRight, Loader2,
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

const SectionCard = ({ title, icon: Icon, children }) => (
  <Card>
    <CardHeader className="border-b border-border pb-4">
      <CardTitle className="flex items-center gap-2 font-display text-sm">
        {Icon && (
          <div className="size-6 rounded-lg flex items-center justify-center bg-slate-100">
            <Icon className="size-3.5 text-slate-700" />
          </div>
        )}
        {title}
      </CardTitle>
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

const ImageUpload = ({ preview, onChange }) => {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ file, previewUrl: URL.createObjectURL(file) });
  };

  return (
    <div>
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden h-[200px]">
          <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => onChange(null)}
            className="absolute top-3 right-3 bg-background/70 hover:bg-background/90"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full h-auto flex-col gap-3 py-10 rounded-2xl border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400"
        >
          <div className="size-12 rounded-2xl flex items-center justify-center bg-slate-100">
            <Upload className="size-5 text-slate-700" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Click to upload cover image</p>
            <p className="text-xs mt-1 text-muted-foreground/80">PNG, JPG up to 5 MB · Recommended: 1200×630 px</p>
          </div>
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

const initialForm = {
  title:                "",
  description:          "",
  category:             "technology",
  tags:                 [],
  organizer:            "",
  channel:              "",
  eventType:            "in-person",
  venueName:            "",
  venueAddress:         "",
  venueMapLink:         "",
  onlineLink:           "",
  startDate:            "",
  endDate:              "",
  registrationDeadline: "",
  capacity:             "",
  isUnlimited:          false,
  isFeatured:           false,
  status:               "draft",
  coverImage:           null,
  registrationQuestions: [],
  registrationMode:     "individual",
  audienceScope:        "campus",
  minTeamSize:          "2",
  maxTeamSize:          "4",
};

const CATEGORIES = [
  "academic","cultural","sports","technology",
  "career","social","religious","competition","other",
];

export default function CreateEventForm() {
  const { addEvent, setActiveSection } = useAdmin();

  const [form,      setForm]      = useState(initialForm);
  const [errors,    setErrors]    = useState({});
  const [apiError,  setApiError]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const validate = (saveAsDraft = false) => {
    const e = {};
    if (!form.title.trim())              e.title = "Title is required.";
    else if (form.title.trim().length < 5) e.title = "Title must be at least 5 characters.";
    if (!form.description.trim())        e.description = "Description is required.";
    else if (form.description.trim().length < 20)
                                         e.description = "Description must be at least 20 characters.";
    if (!form.organizer.trim())          e.organizer = "Organiser is required.";
    if (!saveAsDraft) {
      if (!form.startDate)               e.startDate = "Start date is required.";
      if (!form.endDate)                 e.endDate = "End date is required.";
      if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate))
                                         e.endDate = "End date must be after start date.";
      if (form.registrationDeadline && form.startDate &&
          new Date(form.registrationDeadline) >= new Date(form.startDate))
                                         e.registrationDeadline = "Deadline must be before start date.";
      if ((form.eventType === "in-person" || form.eventType === "hybrid") && !form.venueName.trim())
                                         e.venueName = "Venue name is required for in-person / hybrid events.";
      if ((form.eventType === "online" || form.eventType === "hybrid") && !form.onlineLink.trim())
                                         e.onlineLink = "Online link is required for online / hybrid events.";
      if (form.registrationMode === "team") {
        const min = Number(form.minTeamSize);
        const max = Number(form.maxTeamSize);
        if (!min || min < 2 || min > 5) e.minTeamSize = "Minimum team size must be between 2 and 5.";
        if (!max || max < 2 || max > 5) e.maxTeamSize = "Member limit must be between 2 and 5.";
        if (!e.minTeamSize && !e.maxTeamSize && min > max) {
          e.maxTeamSize = "Member limit must be at least the minimum team size.";
        }
      }
    }
    return e;
  };

  const addQuestion = () => {
    set("registrationQuestions", [
      ...form.registrationQuestions,
      { _clientId: Date.now(), question: "", questionType: "text", isRequired: false, options: [] },
    ]);
  };

  const updateQuestion = (cid, updated) =>
    set("registrationQuestions", form.registrationQuestions.map((q) =>
      q._clientId === cid ? updated : q
    ));

  const removeQuestion = (cid) =>
    set("registrationQuestions", form.registrationQuestions.filter((q) => q._clientId !== cid));

  const buildFormData = (saveAsDraft) => {
    const fd = new FormData();
    fd.append("title",       form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("category",    form.category);
    fd.append("organizer",   form.organizer.trim());
    fd.append("eventType",   form.eventType);
    fd.append("status",      saveAsDraft ? "draft" : form.status);
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
    if (form.channel.trim()) fd.append("channel", form.channel.trim());
    const questions = sanitizeQuestions(form.registrationQuestions, form.registrationMode)
      .map(({ _clientId, ...rest }) => rest);
    fd.append("registrationQuestions", JSON.stringify(questions));
    if (form.coverImage?.file) fd.append("coverImage", form.coverImage.file);
    return fd;
  };

  const handleSubmit = async (saveAsDraft = false) => {
    const e = validate(saveAsDraft);
    setErrors(e);
    setApiError("");
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const fd = buildFormData(saveAsDraft);
      await addEvent(fd);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setForm(initialForm);
        setActiveSection("events");
      }, 2000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.map((e) => e.msg).join(" · ") ||
        "Failed to create event. Please try again.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="size-16 rounded-full flex items-center justify-center bg-emerald-500/15">
          <Send className="size-7 text-emerald-400" />
        </div>
        <p className="font-display font-bold text-xl text-foreground">Event Created!</p>
        <p className="text-sm text-muted-foreground">Redirecting to All Events…</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
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

      <SectionCard title="Basic Information" icon={ImageIcon}>
        <div className="space-y-4">
          <FormField label="Event Title" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. IEEE Tech Summit 2026"
              aria-invalid={!!errors.title}
              className="bg-input/30"
            />
          </FormField>

          <FormField label="Description" required error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe the event in detail… (min 20 characters)"
              rows={4}
              aria-invalid={!!errors.description}
              className="bg-input/30 resize-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" required>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="w-full bg-input/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Organiser" required error={errors.organizer}>
              <Input
                value={form.organizer}
                onChange={(e) => set("organizer", e.target.value)}
                placeholder="e.g. IEEE Student Branch"
                aria-invalid={!!errors.organizer}
                className="bg-input/30"
              />
            </FormField>
          </div>

          <FormField label="Tags" hint="Press Enter or comma to add a tag">
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
                <Button
                  key={value}
                  type="button"
                  variant={form.eventType === value ? "secondary" : "outline"}
                  className={cn("flex-1", form.eventType === value && "text-slate-700 border-slate-400 bg-slate-100")}
                  onClick={() => set("eventType", value)}
                >
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
              <FormField label="Map Link" hint="Optional — Google Maps or similar URL">
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
            <Button
              type="button"
              size="sm"
              variant={form.registrationMode === "individual" ? "default" : "outline"}
              onClick={() => setRegistrationMode("individual")}
            >
              Individual registration
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.registrationMode === "team" ? "default" : "outline"}
              onClick={() => setRegistrationMode("team")}
            >
              Team registration (hackathon)
            </Button>
          </div>

          {form.registrationMode === "team" && <TeamRegistrationFieldsPanel />}

          {form.registrationMode === "team" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Minimum team size" error={errors.minTeamSize}>
                <Input
                  type="number"
                  min={2}
                  max={5}
                  value={form.minTeamSize}
                  onChange={(e) => set("minTeamSize", e.target.value)}
                  placeholder="e.g. 2"
                  className="bg-input/30"
                />
              </FormField>
              <FormField label="Member limit per team" error={errors.maxTeamSize}>
                <Input
                  type="number"
                  min={2}
                  max={5}
                  value={form.maxTeamSize}
                  onChange={(e) => set("maxTeamSize", e.target.value)}
                  placeholder="e.g. 4"
                  className="bg-input/30"
                />
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
              <SelectTrigger className="w-full bg-input/30">
                <SelectValue />
              </SelectTrigger>
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
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                placeholder={form.registrationMode === "team" ? "e.g. 50" : "e.g. 200"}
                disabled={form.isUnlimited}
                className="bg-input/30"
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("mt-6", form.isUnlimited ? "text-slate-700" : "text-muted-foreground")}
              onClick={() => set("isUnlimited", !form.isUnlimited)}
            >
              {form.isUnlimited ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
              Unlimited
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
                className="text-slate-700 border-slate-300 bg-slate-100 hover:bg-slate-100 hover:text-slate-700">
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
        <ImageUpload preview={form.coverImage?.previewUrl} onChange={(img) => set("coverImage", img)} />
      </SectionCard>

      <SectionCard title="Settings">
        <div className="flex flex-wrap gap-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={form.isFeatured ? "text-slate-700" : "text-muted-foreground"}
            onClick={() => set("isFeatured", !form.isFeatured)}
          >
            {form.isFeatured ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
            Feature this event
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Publish immediately</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={form.status === "published" ? "text-slate-700" : "text-muted-foreground"}
              onClick={() => set("status", form.status === "published" ? "draft" : "published")}
            >
              {form.status === "published" ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
            </Button>
          </div>
        </div>
      </SectionCard>

      <Separator />

      <div className="flex items-center gap-3 pb-4">
        <Button onClick={() => handleSubmit(false)} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {form.status === "published" ? "Publish Event" : "Save as Draft"}
        </Button>

        <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading}>
          <Save className="size-4" /> Save Draft
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => { setForm(initialForm); setErrors({}); setApiError(""); }}
          disabled={loading}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
