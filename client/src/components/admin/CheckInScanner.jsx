/**
 * CheckInScanner — Admin QR attendance scanner.
 *
 * Scans student QR passes (camera or manual paste) and marks checkedInAt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  QrCode, Camera, CameraOff, CheckCircle2, AlertCircle,
  UserCheck, Loader2, ScanLine, Keyboard,
} from "lucide-react";
import { format } from "date-fns";
import { useAdmin } from "../../context/AdminContext";
import * as checkInService from "../../services/checkIn.service";
import { parseCheckInToken, countEventAttendance, collectEventAttendees } from "../../utils/checkIn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { eventKey } from "../../utils/eventId";

const ResultCard = ({ result, onDismiss }) => {
  if (!result) return null;

  const isSuccess = !result.error && !result.alreadyCheckedIn;
  const isDuplicate = result.alreadyCheckedIn;
  const isError = Boolean(result.error);

  return (
    <Alert
      variant={isError ? "destructive" : "default"}
      className={cn(
        "border",
        isSuccess && "bg-emerald-50 border-emerald-200 text-emerald-900",
        isDuplicate && "bg-amber-50 border-amber-200 text-amber-900",
      )}
    >
      {isError ? (
        <AlertCircle className="size-4" />
      ) : isDuplicate ? (
        <UserCheck className="size-4" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      <AlertDescription className="flex flex-col gap-2">
        <p className="font-semibold">{result.message ?? result.error}</p>
        {result.attendeeName && (
          <div className="text-sm space-y-0.5 opacity-90">
            <p>{result.attendeeName}{result.teamName ? ` · ${result.teamName}` : ""}</p>
            <p>{result.event?.title}</p>
            {result.checkedInAt && (
              <p className="text-xs">
                Checked in {format(new Date(result.checkedInAt), "PPp")}
              </p>
            )}
          </div>
        )}
        <Button variant="outline" size="sm" className="w-fit mt-1" onClick={onDismiss}>
          Scan next
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default function CheckInScanner() {
  const {
    events,
    registrations,
    regEventId,
    registrationsLoading,
    loadRegistrationsForEvent,
  } = useAdmin();

  const [selectedEventId, setSelectedEventId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLockRef = useRef(false);
  const rafRef = useRef(null);

  const selectableEvents = [...events].sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? ""),
  );

  useEffect(() => {
    if (!selectedEventId && selectableEvents.length > 0) {
      setSelectedEventId(eventKey(selectableEvents[0]._id));
    }
  }, [selectableEvents, selectedEventId]);

  // Load saved registrations when event filter changes (persisted check-ins).
  useEffect(() => {
    if (selectedEventId) {
      loadRegistrationsForEvent(selectedEventId);
    }
  }, [selectedEventId, loadRegistrationsForEvent]);

  useEffect(() => {
    setResult(null);
  }, [selectedEventId]);

  const selectedEvent = events.find(
    (e) => eventKey(e._id) === eventKey(selectedEventId),
  );
  const regsReady = eventKey(regEventId) === eventKey(selectedEventId) && !registrationsLoading;
  const savedRegs = regsReady ? registrations : [];
  const attendance = countEventAttendance(savedRegs);
  const attendeeRoster = collectEventAttendees(
    savedRegs,
    selectedEvent?.title ?? savedRegs[0]?.eventSnapshot?.title,
  );

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const processToken = useCallback(async (raw) => {
    const token = parseCheckInToken(raw);
    if (!token) {
      setResult({ error: "Invalid QR code — could not read a check-in token." });
      return;
    }

    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setProcessing(true);
    setResult(null);

    try {
      const data = await checkInService.markCheckIn(token);

      if (
        selectedEventId &&
        data.event?._id &&
        eventKey(data.event._id) !== eventKey(selectedEventId)
      ) {
        if (data.event._id) {
          await loadRegistrationsForEvent(eventKey(data.event._id));
        }
        setResult({
          error: `Wrong event filter — pass is for "${data.event.title}". Attendance was still saved.`,
          attendeeName: data.attendeeName,
          event: data.event,
          checkedInAt: data.checkedInAt,
        });
        return;
      }

      setResult(data);

      // Always refresh saved registrations for the scanned event.
      if (data.event?._id) {
        const scannedEventId = eventKey(data.event._id);
        await loadRegistrationsForEvent(scannedEventId);
        if (scannedEventId !== eventKey(selectedEventId)) {
          setSelectedEventId(scannedEventId);
        }
      }
    } catch (err) {
      setResult({
        error: err.response?.data?.message ?? "Check-in failed. Please try again.",
      });
    } finally {
      setProcessing(false);
      setTimeout(() => { scanLockRef.current = false; }, 1500);
    }
  }, [selectedEventId, loadRegistrationsForEvent]);

  const startCamera = async () => {
    setCameraError("");
    setResult(null);

    if (!("BarcodeDetector" in window)) {
      setCameraError("Camera QR scanning is not supported in this browser. Paste the pass URL or token below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();
      setScanning(true);

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && !scanLockRef.current) {
            await processToken(codes[0].rawValue);
          }
        } catch {
          // ignore frame errors
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError("Could not access camera. Allow camera permission or use manual entry.");
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processToken(manualInput);
    setManualInput("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <ScanLine className="size-5 text-primary" />
              Scan QR Pass
            </CardTitle>
            <CardDescription>
              Point the camera at a student&apos;s event pass QR code to mark attendance instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Event (optional filter)</Label>
              <Select
                value={eventKey(selectedEventId)}
                onValueChange={setSelectedEventId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select event">
                    {selectedEvent?.title ?? "Select event"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {selectableEvents.map((ev) => (
                    <SelectItem key={eventKey(ev._id)} value={eventKey(ev._id)}>
                      {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Rejects passes that belong to a different event than the one selected.
              </p>
              {attendance.total > 0 && (
                <Badge variant="outline" className="bg-violet-50 text-violet-800 border-violet-200">
                  Saved attendance: {attendance.checkedIn}/{attendance.total}
                </Badge>
              )}
            </div>

            <div className="relative aspect-video max-h-72 rounded-xl overflow-hidden bg-slate-900 border border-border">
              <video
                ref={videoRef}
                className={cn("w-full h-full object-cover", !scanning && "hidden")}
                playsInline
                muted
              />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <QrCode className="size-12 opacity-40" />
                  <p className="text-sm">Camera preview</p>
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-primary/70 rounded-xl" />
                </div>
              )}
            </div>

            {cameraError && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              {!scanning ? (
                <Button onClick={startCamera} disabled={processing}>
                  <Camera className="size-4" />
                  Start camera
                </Button>
              ) : (
                <Button variant="outline" onClick={stopCamera} disabled={processing}>
                  <CameraOff className="size-4" />
                  Stop camera
                </Button>
              )}
              {processing && (
                <Badge variant="secondary" className="gap-1.5 py-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Processing…
                </Badge>
              )}
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-border">
              <Label className="flex items-center gap-1.5">
                <Keyboard className="size-3.5" />
                Manual entry
              </Label>
              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste pass URL or token…"
                  className="font-mono text-xs"
                />
                <Button type="submit" variant="secondary" disabled={processing || !manualInput.trim()}>
                  Check in
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ResultCard result={result} onDismiss={() => setResult(null)} />
      </div>

      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Attendance roster</CardTitle>
            <CardDescription className="text-xs">
              All confirmed registrations for this event — same data as Registrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registrationsLoading && eventKey(regEventId) === eventKey(selectedEventId) ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading roster…
              </div>
            ) : attendeeRoster.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No confirmed registrations for this event yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {attendeeRoster.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 text-sm border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      {item.teamName && (
                        <p className="text-xs text-muted-foreground truncate">
                          Team: {item.teamName}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          item.present
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.present ? "Present" : "Absent"}
                      </Badge>
                      {item.present && item.checkedInAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(item.checkedInAt, "PPp")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
