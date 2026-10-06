/**
 * EventPassModal — Student in-app QR pass viewer.
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { QrCode, MapPin, Clock, CheckCircle2, Loader2, X } from "lucide-react";
import { getRegistrationPass } from "../../services/registration.service";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function EventPassModal({ registrationId, open, onClose }) {
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !registrationId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setPass(null);

    getRegistrationPass(registrationId)
      .then((data) => { if (!cancelled) setPass(data); })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message ?? "Could not load your pass.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, registrationId]);

  const when = pass?.event?.startDate
    ? format(new Date(pass.event.startDate), "PPP p")
    : null;
  const where = pass?.event?.eventType === "online"
    ? (pass?.event?.onlineLink || "Online event")
    : (pass?.event?.venue?.name || pass?.event?.venue || "Venue TBA");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            Your Event Pass
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {pass && !loading && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="font-semibold text-sm">{pass.event?.title}</p>
              {pass.teamName && (
                <p className="text-xs text-muted-foreground">Team: {pass.teamName}</p>
              )}
              <p className="text-xs text-muted-foreground">{pass.attendeeName}</p>
              {when && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                  <Clock className="size-3" /> {when}
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3" /> {where}
              </p>
            </div>

            <div className="flex flex-col items-center">
              <img
                src={pass.qrDataUrl}
                alt="Your event pass QR code"
                width={200}
                height={200}
                className="rounded-xl border bg-white p-2"
              />
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Show this at the event entrance for attendance
              </p>
            </div>

            {pass.checkedInAt && (
              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle2 className="size-4 text-emerald-700" />
                <AlertDescription className="text-emerald-900 text-xs">
                  Checked in {format(new Date(pass.checkedInAt), "PPp")}
                </AlertDescription>
              </Alert>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
              <X className="size-3.5" /> Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
