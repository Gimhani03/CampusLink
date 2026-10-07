/**
 * ChannelMgmt.jsx
 *
 * Admin channel management panel.
 */

import { useState, useMemo, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Save, Trash2, Edit2,
  Users, CalendarDays, BadgeCheck, ShieldOff,
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  Camera, Upload,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { categoryMeta } from "../../data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "academic","cultural","sports","technology",
  "career","social","religious","competition","other",
];

const CatBadge = ({ cat }) => {
  const meta = categoryMeta[cat] ?? categoryMeta.other;
  return (
    <Badge variant="outline" className={cn("capitalize font-semibold text-xs", meta.badgeClassName)}>
      {meta.label ?? cat}
    </Badge>
  );
};

const getInitials = (name = "") =>
  name.split(/[\s&\-–—]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const ChannelAvatar = ({ channel, className }) => {
  const meta = categoryMeta[channel.category] ?? categoryMeta.other;
  const initials = getInitials(channel.name);

  if (channel.avatar?.url) {
    return (
      <img
        src={channel.avatar.url}
        alt={channel.name}
        className={cn(
          "rounded-xl object-cover shrink-0 border border-border/80 bg-muted ring-1 ring-black/5",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center font-display font-bold shrink-0 border",
        meta.badgeClassName,
        className,
      )}
      aria-label={`${channel.name} avatar`}
    >
      <span className="text-[10px] leading-none tracking-tight">{initials}</span>
    </div>
  );
};

const emptyForm = { name: "", description: "", category: "technology", organizer: "", isVerified: false, isActive: true };

const ChannelForm = ({ initial, onSave, onCancel, saving, apiError }) => {
  const [f, setF]               = useState(initial ?? emptyForm);
  const [errs, setErrs]         = useState({});
  const [avatarFile, setAvatarFile]   = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(initial?.avatarUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!f.name.trim())      e.name      = "Name is required.";
    if (!f.category)         e.category  = "Category is required.";
    if (!f.organizer.trim()) e.organizer = "Organiser is required.";
    return e;
  };

  const handleSave = () => {
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length > 0) return;
    onSave(f, avatarFile);
  };

  const acceptFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-slate-200">
        <div className="px-(--card-spacing) py-4 space-y-4">
          <h3 className="font-display font-semibold text-sm text-slate-700">
            {initial ? "Edit Channel" : "New Channel"}
          </h3>

          {apiError && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/25 py-2">
              <AlertCircle className="size-3.5" />
              <AlertDescription className="text-xs">{apiError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-start gap-4">
            <div
              className={cn(
                "relative shrink-0 size-20 rounded-2xl overflow-hidden cursor-pointer transition-all border-2 border-dashed",
                dragOver ? "border-primary/50" : "border-border",
                !avatarPreview && "bg-muted/40",
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files[0]); }}
            >
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/55">
                    <Camera className="size-4 text-white" />
                  </div>
                </>
              ) : (
                <div
                  className={cn(
                    "w-full h-full flex flex-col items-center justify-center gap-1.5",
                    categoryMeta[f.category]?.badgeClassName ?? categoryMeta.other.badgeClassName,
                  )}
                >
                  {getInitials(f.name) !== "?" ? (
                    <span className="font-display font-bold text-lg leading-none">{getInitials(f.name)}</span>
                  ) : (
                    <Upload className="size-5 opacity-60" />
                  )}
                  <span className="text-[9px] font-medium text-center leading-tight px-2 text-muted-foreground">
                    Drop or click to upload
                  </span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => acceptFile(e.target.files[0])} />
            <div className="flex-1 flex flex-col gap-1">
              <Label className="text-xs font-semibold">Channel Avatar</Label>
              <p className="text-[11px] text-muted-foreground">
                JPG, PNG or WebP · max 5 MB<br />
                Recommended: square image, at least 400 × 400 px
              </p>
              {avatarFile && (
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle className="size-3 text-emerald-700" />
                  <span className="text-[11px] font-medium text-emerald-700">{avatarFile.name}</span>
                  <Button type="button" variant="ghost" size="icon-xs"
                    onClick={() => { setAvatarFile(null); setAvatarPreview(initial?.avatarUrl ?? null); }}>
                    <X className="size-2.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">
                Channel Name <span className="text-destructive">*</span>
              </Label>
              <Input value={f.name} onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. IEEE Student Branch" aria-invalid={!!errs.name} className="bg-input/30" />
              {errs.name && <p className="text-xs text-destructive">{errs.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">
                Organiser <span className="text-destructive">*</span>
              </Label>
              <Input value={f.organizer} onChange={(e) => set("organizer", e.target.value)}
                placeholder="e.g. Faculty of Engineering" aria-invalid={!!errs.organizer} className="bg-input/30" />
              {errs.organizer && <p className="text-xs text-destructive">{errs.organizer}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={f.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="w-full bg-input/30" aria-invalid={!!errs.category}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea value={f.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of this channel…" rows={2} className="bg-input/30 resize-none" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Button type="button" variant="ghost" size="sm"
              className={f.isVerified ? "text-emerald-700" : "text-muted-foreground"}
              onClick={() => set("isVerified", !f.isVerified)}>
              <BadgeCheck className="size-4" /> {f.isVerified ? "Verified" : "Mark as Verified"}
            </Button>
            <Button type="button" variant="ghost" size="sm"
              className={f.isActive ? "text-slate-700" : "text-destructive"}
              onClick={() => set("isActive", !f.isActive)}>
              {f.isActive ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
              {f.isActive ? "Active" : "Inactive"}
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="size-3.5" />}
              {initial ? "Save Changes" : "Create Channel"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default function ChannelMgmt() {
  const {
    channels, channelsLoading, loadChannels,
    addChannel, saveChannel, removeChannel,
  } = useAdmin();

  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState("All");
  const [showCreate,   setShowCreate]   = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [apiError,     setApiError]     = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return channels.filter((ch) => {
      const matchQ   = !q || ch.name.toLowerCase().includes(q) || ch.organizer?.toLowerCase().includes(q);
      const matchCat = catFilter === "All" || ch.category === catFilter;
      return matchQ && matchCat;
    });
  }, [channels, search, catFilter]);

  const handleCreate = async (form, avatarFile) => {
    setSaving(true); setApiError("");
    try {
      await addChannel(form, avatarFile);
      setShowCreate(false);
    } catch (err) {
      setApiError(err?.response?.data?.message || "Failed to create channel.");
    } finally { setSaving(false); }
  };

  const handleEdit = async (form, avatarFile) => {
    setSaving(true); setApiError("");
    try {
      await saveChannel(editingId, form, avatarFile);
      setEditingId(null);
    } catch (err) {
      setApiError(err?.response?.data?.message || "Failed to save channel.");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await removeChannel(deleteTarget._id); }
    catch {}
    setDeleteTarget(null);
  };

  const handleToggleActive = async (ch) => {
    try { await saveChannel(ch._id, { isActive: !ch.isActive }); }
    catch {}
  };

  const handleToggleVerified = async (ch) => {
    try { await saveChannel(ch._id, { isVerified: !ch.isVerified }); }
    catch {}
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search channels…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-input/30" />
        </div>

        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs hidden sm:block text-muted-foreground">{filtered.length} channels</span>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon-sm" onClick={loadChannels}>
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowCreate((p) => !p); setEditingId(null); setApiError(""); }}
            className={showCreate ? "bg-slate-200 text-slate-700 border-slate-300" : "text-slate-700 border-slate-300 bg-slate-100"}
          >
            {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showCreate ? "Cancel" : "New Channel"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <ChannelForm initial={null} onSave={handleCreate}
            onCancel={() => { setShowCreate(false); setApiError(""); }}
            saving={saving} apiError={apiError} />
        )}
      </AnimatePresence>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 hidden md:table-cell" />
              <TableHead>Channel</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Followers</TableHead>
              <TableHead className="hidden md:table-cell">Events</TableHead>
              <TableHead className="hidden md:table-cell">Active</TableHead>
              <TableHead className="hidden md:table-cell">Verified</TableHead>
              <TableHead className="hidden md:table-cell">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channelsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                  No channels match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ch) => (
                <Fragment key={ch._id}>
                  <TableRow>
                    <TableCell className="hidden md:table-cell">
                      <ChannelAvatar channel={ch} className="size-9" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <ChannelAvatar channel={ch} className="md:hidden size-10" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={cn("font-display font-semibold text-sm truncate",
                              ch.isActive ? "text-foreground" : "text-muted-foreground")}>
                              {ch.name}
                            </p>
                            {ch.isVerified && <BadgeCheck className="size-3.5 text-emerald-700" />}
                            {!ch.isActive && (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-800 border-red-200">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 truncate text-muted-foreground">{ch.organizer || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell"><CatBadge cat={ch.category} /></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" />{(ch.followerCount ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="size-3" />{ch.eventCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Button variant="outline" size="xs"
                        className={ch.isActive
                          ? "text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900"
                          : "text-red-800 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-900"}
                        onClick={() => handleToggleActive(ch)}>
                        {ch.isActive ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                        {ch.isActive ? "Yes" : "No"}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Button variant="outline" size="xs"
                        className={ch.isVerified
                          ? "text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900"
                          : "text-slate-600 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:text-slate-800"}
                        onClick={() => handleToggleVerified(ch)}>
                        {ch.isVerified ? <BadgeCheck className="size-3" /> : <ShieldOff className="size-3" />}
                        {ch.isVerified ? "Yes" : "No"}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-xs"
                          className={editingId === ch._id ? "text-slate-700" : "text-muted-foreground"}
                          onClick={() => { setEditingId(editingId === ch._id ? null : ch._id); setShowCreate(false); setApiError(""); }}>
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(ch)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editingId === ch._id && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-4">
                        <ChannelForm
                          initial={{
                            name:        ch.name,
                            description: ch.description ?? "",
                            category:    ch.category,
                            organizer:   ch.organizer ?? "",
                            isVerified:  ch.isVerified ?? false,
                            isActive:    ch.isActive ?? true,
                            avatarUrl:   ch.avatar?.url ?? null,
                          }}
                          onSave={handleEdit}
                          onCancel={() => { setEditingId(null); setApiError(""); }}
                          saving={saving}
                          apiError={apiError}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Trash2 className="size-5 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Deactivate Channel</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the channel from students. Are you sure you want to deactivate{" "}
              <strong>{deleteTarget?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
