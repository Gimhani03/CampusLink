import { useState, useMemo, useCallback } from "react";
import {
  Search, Filter, Edit2, Trash2, Ticket, Star, StarOff,
  ChevronLeft, ChevronRight, MoreHorizontal,
  CheckCircle, XCircle, AlertCircle, Ban, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { useAdmin } from "../../context/AdminContext";
import { categoryMeta } from "../../data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STATUS_BADGE = {
  published: { label: "Published", className: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle },
  draft:     { label: "Draft",     className: "bg-slate-100 text-slate-700 border-slate-200",     icon: AlertCircle },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-800 border-red-200",           icon: XCircle     },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200",     icon: CheckCircle },
};

const StatusBadge = ({ status }) => {
  const { label, className, icon: Icon } = STATUS_BADGE[status] || STATUS_BADGE.draft;
  return (
    <Badge variant="outline" className={cn("gap-1 font-semibold", className)}>
      <Icon className="size-2.5" />
      {label}
    </Badge>
  );
};

const CapacityCell = ({ count, capacity }) => {
  if (!capacity) return <span className="text-xs text-muted-foreground">Unlimited</span>;
  const pct = Math.min(Math.round((count / capacity) * 100), 100);
  const indicatorClass =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-sky-600" : "bg-emerald-600";
  const textClass =
    pct >= 90 ? "text-red-700" : pct >= 70 ? "text-sky-800" : "text-emerald-700";

  return (
    <div className="w-24">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {count.toLocaleString()}/{capacity.toLocaleString()}
        </span>
        <span className={cn("text-xs font-semibold tabular-nums", textClass)}>{pct}%</span>
      </div>
      <Progress value={pct} className="gap-0">
        <ProgressTrack className="h-1.5 bg-slate-100">
          <ProgressIndicator className={indicatorClass} />
        </ProgressTrack>
      </Progress>
    </div>
  );
};

const ActionMenu = ({ event, onEdit, onDelete, onToggleFeatured, onStatusChange, onViewRegs }) => {
  const actions = [
    event.status !== "cancelled"
      ? { label: "Edit", icon: Edit2, fn: () => onEdit(event) }
      : null,
    { label: "View Registrations", icon: Ticket, fn: () => onViewRegs(event._id) },
    event.status === "published"
      ? {
          label: event.isFeatured ? "Unfeature" : "Feature",
          icon: event.isFeatured ? StarOff : Star,
          fn: () => onToggleFeatured(event._id),
        }
      : null,
    event.status === "draft"
      ? { label: "Publish", icon: CheckCircle, fn: () => onStatusChange(event._id, "published") }
      : event.status === "published"
      ? { label: "Unpublish (Draft)", icon: AlertCircle, fn: () => onStatusChange(event._id, "draft") }
      : null,
    event.status === "published"
      ? { label: "Cancel Event", icon: Ban, fn: () => onStatusChange(event._id, "cancelled"), danger: true }
      : null,
    event.status === "cancelled"
      ? { label: "Delete Permanently", icon: Trash2, fn: () => onDelete(event._id), danger: true }
      : null,
  ].filter(Boolean);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        {actions.map(({ label, icon: Icon, fn, danger }) => (
          <DropdownMenuItem
            key={label}
            variant={danger ? "destructive" : "default"}
            onClick={fn}
          >
            <Icon className="size-3.5" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const PAGE_SIZE = 8;
const CATEGORY_OPTIONS = ["All", "competition", "technology", "career", "cultural", "sports", "academic", "social"];
const STATUS_OPTIONS   = ["All", "published", "draft", "cancelled", "completed"];

export default function EventsTable({ onViewRegistrations }) {
  const { events, deleteEvent, toggleFeatured, changeStatus, setEditingEvent, setActiveSection } = useAdmin();

  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState("All");
  const [statusFilter, setStatus]       = useState("All");
  const [page,         setPage]         = useState(1);
  const [confirm,      setConfirm]      = useState(null);

  const askConfirm = useCallback((opts) => setConfirm(opts), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  const handleCancel = useCallback((id, title) => {
    askConfirm({
      title:        "Cancel this event?",
      message:      `"${title}" will be marked as cancelled and all registered students will be notified immediately. This cannot be undone.`,
      confirmLabel: "Yes, cancel event",
      danger:       true,
      onConfirm:    () => { changeStatus(id, "cancelled"); closeConfirm(); },
    });
  }, [askConfirm, closeConfirm, changeStatus]);

  const handleDelete = useCallback((id, title) => {
    askConfirm({
      title:        "Remove cancelled event?",
      message:      `"${title}" will be permanently removed from the database along with its registrations and cover image. Use this to clean up cancelled events you no longer need.`,
      confirmLabel: "Yes, delete permanently",
      danger:       true,
      onConfirm:    () => { deleteEvent(id); closeConfirm(); },
    });
  }, [askConfirm, closeConfirm, deleteEvent]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchSearch = search
        ? e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.organizer.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchCat    = catFilter !== "All" ? e.category === catFilter : true;
      const matchStatus = statusFilter !== "All" ? e.status === statusFilter : true;
      return matchSearch && matchCat && matchStatus;
    });
  }, [events, search, catFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilter = (setter) => (v) => { setter(v); setPage(1); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search events, organiser..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 bg-input/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={catFilter} onValueChange={handleFilter(setCatFilter)}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "All" ? "All" : o.charAt(0).toUpperCase() + o.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleFilter(setStatus)}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "All" ? "All" : o.charAt(0).toUpperCase() + o.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs ml-auto hidden sm:block text-muted-foreground">
          {filtered.length} events
        </span>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 hidden md:table-cell" />
              <TableHead>Event</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Capacity</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <Search className="mx-auto mb-2 opacity-20 size-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No events match your filters</p>
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((event) => {
                const cat = categoryMeta[event.category];
                return (
                  <TableRow key={event._id}>
                    <TableCell className="hidden md:table-cell">
                      <img src={event.coverImage.url} alt={event.title}
                        className="size-8 rounded-lg object-cover" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={event.coverImage.url} alt="" className="md:hidden size-9 rounded-xl object-cover shrink-0" />
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm truncate text-foreground">
                            {event.title}
                          </p>
                          <p className="text-xs mt-0.5 truncate text-muted-foreground">
                            {event.organizer}
                            {event.isFeatured && (
                              <span className="ml-2 text-[10px] font-semibold text-slate-700">★ Featured</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn("text-xs font-semibold", cat?.badgeClassName)}>
                        {cat?.label ?? event.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell capitalize text-xs text-muted-foreground">
                      {event.eventType}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {format(new Date(event.startDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <CapacityCell count={event.registrationCount} capacity={event.capacity} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge status={event.status} />
                    </TableCell>
                    <TableCell>
                      <ActionMenu
                        event={event}
                        onEdit={(ev) => { setEditingEvent(ev); setActiveSection("edit"); }}
                        onDelete={(id) => handleDelete(id, event.title)}
                        onToggleFeatured={toggleFeatured}
                        onStatusChange={(id, status) =>
                          status === "cancelled"
                            ? handleCancel(id, event.title)
                            : changeStatus(id, status)
                        }
                        onViewRegs={onViewRegistrations}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="size-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={page === p ? "secondary" : "outline"}
                size="icon-xs"
                onClick={() => setPage(p)}
                className={page === p ? "text-slate-700 border-slate-600/35 bg-slate-200" : ""}
              >
                {p}
              </Button>
            ))}
            <Button variant="outline" size="icon-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && closeConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={confirm?.danger ? "bg-destructive/10" : "bg-slate-100"}>
              <AlertTriangle className={cn("size-5", confirm?.danger ? "text-destructive" : "text-slate-700")} />
            </AlertDialogMedia>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.danger ? "destructive" : "default"}
              onClick={confirm?.onConfirm}
            >
              {confirm?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
