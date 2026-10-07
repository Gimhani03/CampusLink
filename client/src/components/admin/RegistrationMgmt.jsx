import { useState, useMemo, useEffect } from "react";
import {
  Search, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Download, Eye, UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAdmin } from "../../context/AdminContext";
import { ROLE_LABELS } from "../../constants/teamRegistration";
import { countEventAttendance, getRegAttendance } from "../../utils/checkIn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PLATFORM_NAME } from "@/constants/branding";
import { eventKey } from "../../utils/eventId";

const formatAnswer = (answer) => {
  if (Array.isArray(answer)) return answer.join("; ");
  return answer ?? "";
};

const safeFileName = (title) =>
  (title ?? "event")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);

const downloadRegistrationsPdf = (regs, event) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const isTeamEvent = event?.registrationMode === "team" || regs.some((r) => r.team);

  const questionHeaders = [];
  const seenQuestions = new Set();
  regs.forEach((r) => {
    (r.answers ?? []).forEach((a) => {
      if (a.question && !seenQuestions.has(a.question)) {
        seenQuestions.add(a.question);
        questionHeaders.push(a.question);
      }
    });
  });

  const confirmed  = regs.filter((r) => r.status === "confirmed").length;
  const waitlisted = regs.filter((r) => r.status === "waitlisted").length;
  const cancelled  = regs.filter((r) => r.status === "cancelled").length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 60);
  doc.text(`${PLATFORM_NAME} — Registration Report`, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 90);
  doc.text(event?.title ?? "Event", 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  const unit = isTeamEvent ? "teams" : "registrations";
  const meta = [
    event?.startDate ? `Event date: ${format(new Date(event.startDate), "PPP")}` : null,
    `Exported: ${format(new Date(), "PPP p")}`,
    `Total: ${regs.length} ${unit}  ·  Confirmed: ${confirmed}  ·  Waitlisted: ${waitlisted}  ·  Cancelled: ${cancelled}`,
  ].filter(Boolean);
  meta.forEach((line, i) => doc.text(line, 14, 31 + i * 5));

  const tableStartY = 31 + meta.length * 5 + 4;

  const head = [[
    "#",
    ...(isTeamEvent ? ["Team", "University", "Size", "Submitted By"] : []),
    "Full Name",
    "Student ID",
    "Email",
    ...(isTeamEvent ? [] : ["Degree", "Batch"]),
    "WhatsApp",
    "Status",
    "Registered",
    ...questionHeaders,
  ]];

  const body = regs.map((r, i) => {
    const profile = r.studentSnapshot ?? r.student ?? {};
    const answerMap = Object.fromEntries(
      (r.answers ?? []).map((a) => [a.question, formatAnswer(a.answer)])
    );

    return [
      String(i + 1),
      ...(isTeamEvent ? [
        r.team?.name ?? "—",
        r.team?.university ?? "—",
        r.team?.size != null ? String(r.team.size) : "—",
        ROLE_LABELS[r.team?.registrantRole] ?? profile.fullName ?? "—",
      ] : []),
      profile.fullName ?? "—",
      profile.studentId ?? "—",
      profile.email ?? "—",
      ...(isTeamEvent ? [] : [profile.degree ?? "—", profile.batch ?? "—"]),
      profile.whatsappNumber ?? "—",
      r.status ?? "—",
      format(new Date(r.registeredAt ?? r.createdAt), "MMM d, yyyy"),
      ...questionHeaders.map((q) => answerMap[q] ?? "—"),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [19, 19, 46], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 18 }, 3: { cellWidth: 32 } },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 160);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    },
  });

  doc.save(`${safeFileName(event?.title)}-registrations-${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

const STATUS_BADGE = {
  confirmed:  { label: "Confirmed",  className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  waitlisted: { label: "Waitlisted", className: "bg-sky-50 text-sky-800 border-sky-200" },
  cancelled:  { label: "Cancelled",  className: "bg-red-50 text-red-800 border-red-200" },
};

const StatusBadge = ({ status }) => {
  const { label, className } = STATUS_BADGE[status] || STATUS_BADGE.confirmed;
  return <Badge variant="outline" className={cn("font-semibold", className)}>{label}</Badge>;
};

const RegistrationModal = ({ reg, readOnly, onClose, onStatusChange }) => (
  <Dialog open={!!reg} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">
          {reg?.team ? "Team Registration" : "Registration Detail"}
        </DialogTitle>
      </DialogHeader>

      {reg?.team && (
        <Card size="sm" className="mb-4">
          <div className="px-(--card-spacing) space-y-2">
            <p className="font-display font-bold text-sm text-foreground">{reg.team.name}</p>
            <p className="text-xs text-muted-foreground">
              {reg.team.university} · {reg.team.size} members · Submitted as {ROLE_LABELS[reg.team.registrantRole]}
            </p>
            <Separator />
            <div className="pt-2 space-y-3">
              {(reg.team.members ?? []).map((m) => (
                <div key={m.role}>
                  <p className="text-xs font-semibold mb-1 text-primary">
                    {ROLE_LABELS[m.role]}{m.isRegistrant ? " (registrant)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.fullName}</p>
                  <p className="text-xs text-muted-foreground/80">
                    {m.phone} · {m.personalEmail} · NIC {m.nic}
                  </p>
                  <p className={cn(
                    "text-[11px] mt-0.5 font-medium",
                    m.checkedInAt ? "text-emerald-700" : "text-muted-foreground",
                  )}>
                    {m.checkedInAt
                      ? `Checked in ${format(new Date(m.checkedInAt), "PPp")}`
                      : "Not checked in"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3 mb-5">
        {[
          ["Submitted by",  reg?.student?.fullName        ],
          ["Student ID",  reg?.student?.studentId       ],
          ["Account Email", reg?.student?.email           ],
          ...(reg?.team ? [] : [
            ["Degree",      reg?.student?.degree          ],
            ["Batch",       reg?.student?.batch           ],
          ]),
          ["WhatsApp",    reg?.student?.whatsappNumber  ],
          ["Event",       reg?.eventTitle ?? "—"        ],
          ["Registered",  reg ? format(new Date(reg.registeredAt ?? reg.createdAt), "PPP") : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <span className="text-xs w-24 shrink-0 font-medium text-muted-foreground">{label}</span>
            <span className="text-xs font-medium text-foreground">{value}</span>
          </div>
        ))}
        <div className="flex gap-3 items-center">
          <span className="text-xs w-24 shrink-0 font-medium text-muted-foreground">Status</span>
          {reg && <StatusBadge status={reg.status} />}
        </div>
        {!reg?.team && reg?.checkedInAt && (
          <div className="flex gap-3 items-center">
            <span className="text-xs w-24 shrink-0 font-medium text-muted-foreground">Attendance</span>
            <span className="text-xs font-medium text-emerald-700">
              Checked in {format(new Date(reg.checkedInAt), "PPp")}
            </span>
          </div>
        )}
      </div>

      {!readOnly && reg && (
        <div className="flex gap-2 pt-4 border-t border-border">
          {reg.status !== "confirmed" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900"
              onClick={() => { onStatusChange(reg._id, "confirmed"); onClose(); }}
            >
              <CheckCircle className="size-3.5" /> Confirm
            </Button>
          )}
          {reg.status !== "waitlisted" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-sky-800 border-sky-200 bg-sky-50 hover:bg-sky-100 hover:text-sky-900"
              onClick={() => { onStatusChange(reg._id, "waitlisted"); onClose(); }}
            >
              <Clock className="size-3.5" /> Waitlist
            </Button>
          )}
          {reg.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive border-destructive/25 bg-destructive/10 hover:bg-destructive/15 hover:text-destructive"
              onClick={() => { onStatusChange(reg._id, "cancelled"); onClose(); }}
            >
              <XCircle className="size-3.5" /> Cancel
            </Button>
          )}
        </div>
      )}
      {readOnly && (
        <p className="text-xs pt-4 text-center text-muted-foreground border-t border-border">
          This event is cancelled — registrations are read-only.
        </p>
      )}
    </DialogContent>
  </Dialog>
);

const SummaryChips = ({ regs, isTeamEvent = false }) => {
  const confirmed  = regs.filter((r) => r.status === "confirmed").length;
  const waitlisted = regs.filter((r) => r.status === "waitlisted").length;
  const cancelled  = regs.filter((r) => r.status === "cancelled").length;
  const attendance = countEventAttendance(regs);

  const chips = [
    {
      label: isTeamEvent ? "Total Teams" : "Total",
      value: regs.length,
      chipClass: "bg-slate-50 border-slate-200",
      valueClass: "text-foreground",
    },
    {
      label: "Confirmed",
      value: confirmed,
      chipClass: "bg-emerald-50 border-emerald-200",
      valueClass: "text-emerald-800",
    },
    {
      label: "Waitlisted",
      value: waitlisted,
      chipClass: "bg-sky-50 border-sky-200",
      valueClass: "text-sky-800",
    },
    {
      label: "Cancelled",
      value: cancelled,
      chipClass: "bg-red-50 border-red-200",
      valueClass: "text-red-800",
    },
    {
      label: isTeamEvent ? "Members Present" : "Checked In",
      value: attendance.total > 0 ? `${attendance.checkedIn}/${attendance.total}` : "0",
      chipClass: "bg-violet-50 border-violet-200",
      valueClass: "text-violet-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {chips.map(({ label, value, chipClass, valueClass }) => (
        <div
          key={label}
          className={cn(
            "rounded-xl border px-4 py-3 flex items-baseline gap-2 min-w-0",
            chipClass,
          )}
        >
          <span className={cn("font-display font-bold text-xl tabular-nums leading-none", valueClass)}>
            {value}
          </span>
          <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        </div>
      ))}
    </div>
  );
};

const PAGE_SIZE = 10;

export default function RegistrationMgmt({ defaultEventId }) {
  const {
    events,
    registrations,
    registrationsLoading,
    updateRegistrationStatus,
    loadRegistrationsForEvent,
  } = useAdmin();

  const [selectedEventId, setSelectedEventId] = useState(defaultEventId ?? null);
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatus]          = useState("All");
  const [page,            setPage]            = useState(1);
  const [detailReg,       setDetailReg]       = useState(null);

  useEffect(() => {
    if (defaultEventId) {
      setSelectedEventId(eventKey(defaultEventId));
      setPage(1);
      setSearch("");
      setStatus("All");
    }
  }, [defaultEventId]);

  useEffect(() => {
    if (!selectedEventId && !defaultEventId && events.length > 0) {
      setSelectedEventId(eventKey(events[0]._id));
    }
  }, [events, selectedEventId, defaultEventId]);

  useEffect(() => {
    if (selectedEventId) loadRegistrationsForEvent(selectedEventId);
  }, [selectedEventId, loadRegistrationsForEvent]);

  // Keep registration detail modal in sync after check-ins / status changes.
  useEffect(() => {
    if (!detailReg) return;
    const fresh = registrations.find((r) => r._id === detailReg._id);
    if (fresh) setDetailReg(fresh);
  }, [registrations, detailReg?._id]);

  const eventRegs = registrations;

  const selectedEvent = useMemo(
    () => events.find((e) => eventKey(e._id) === eventKey(selectedEventId)) ?? null,
    [events, selectedEventId]
  );
  const isCancelledEvent = selectedEvent?.status === "cancelled";
  const isTeamEvent = selectedEvent?.registrationMode === "team";

  const filtered = useMemo(() => {
    return eventRegs.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = q
        ? r.student.fullName.toLowerCase().includes(q) ||
          r.student.studentId?.toLowerCase().includes(q) ||
          r.student.email.toLowerCase().includes(q) ||
          r.team?.name?.toLowerCase().includes(q) ||
          r.team?.university?.toLowerCase().includes(q) ||
          r.team?.members?.some(
            (m) =>
              m.fullName?.toLowerCase().includes(q) ||
              m.personalEmail?.toLowerCase().includes(q) ||
              m.nic?.toLowerCase().includes(q)
          )
        : true;
      const matchStatus = statusFilter !== "All" ? r.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [eventRegs, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportPdf = () => {
    if (!selectedEvent || filtered.length === 0) return;
    downloadRegistrationsPdf(filtered, selectedEvent);
  };

  return (
    <div className="flex flex-col gap-4">
      <RegistrationModal
        reg={detailReg}
        readOnly={isCancelledEvent}
        onClose={() => setDetailReg(null)}
        onStatusChange={updateRegistrationStatus}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={eventKey(selectedEventId)}
          onValueChange={(v) => { setSelectedEventId(v); setPage(1); setSearch(""); }}
          disabled={events.length === 0}
        >
          <SelectTrigger className="flex-1 min-w-48 max-w-[340px] h-10">
            <SelectValue placeholder="Select event">
              {selectedEvent?.title ?? "Select event"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {events.map((ev) => (
              <SelectItem key={eventKey(ev._id)} value={eventKey(ev._id)}>
                {ev.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={!selectedEvent || filtered.length === 0 || registrationsLoading}
          className="ml-auto text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900"
        >
          <Download className="size-3.5" /> Export PDF
        </Button>
      </div>

      {isCancelledEvent && (
        <Alert variant="destructive" className="bg-destructive/8 border-destructive/20 text-destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            <strong>{selectedEvent?.title}</strong> is cancelled — viewing registration history only.
          </AlertDescription>
        </Alert>
      )}

      <SummaryChips regs={eventRegs} isTeamEvent={isTeamEvent} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name, ID or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 bg-input/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All", "confirmed", "waitlisted", "cancelled"].map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Student</TableHead>
              <TableHead className="hidden md:table-cell">Degree</TableHead>
              <TableHead className="hidden md:table-cell">Batch</TableHead>
              <TableHead className="hidden md:table-cell">Registered</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Attendance</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrationsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center text-muted-foreground">
                  No registrations found
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((reg) => (
                <TableRow key={reg._id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm truncate text-foreground">
                        {reg.team?.name ?? reg.student?.fullName ?? "—"}
                      </p>
                      <p className="text-xs mt-0.5 text-muted-foreground">
                        {reg.team
                          ? `${reg.team.university} · by ${reg.student?.fullName}`
                          : reg.student?.studentId
                            ? `${reg.student.studentId} · ${reg.student.email}`
                            : reg.student?.email ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                    {reg.student?.degree?.split(" ").slice(0, 2).join(" ") ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {reg.student?.batch ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {format(new Date(reg.registeredAt ?? reg.createdAt), "MMM d")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StatusBadge status={reg.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(() => {
                      const att = getRegAttendance(reg);
                      if (att.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
                      return (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold gap-1",
                            att.complete
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : att.checkedIn > 0
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-slate-50 text-muted-foreground border-slate-200",
                          )}
                        >
                          <UserCheck className="size-3" />
                          {att.label}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-xs" onClick={() => setDetailReg(reg)}>
                        <Eye className="size-3.5" />
                      </Button>
                      {!isCancelledEvent && reg.status !== "confirmed" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          onClick={() => updateRegistrationStatus(reg._id, "confirmed")}
                        >
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      {!isCancelledEvent && reg.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => updateRegistrationStatus(reg._id, "cancelled")}
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
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
            <Button variant="outline" size="icon-xs" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
