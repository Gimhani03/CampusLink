/**
 * PassPage — Public event pass display (QR destination from email / in-app pass).
 * Token in the URL is the credential — no login required.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QrCode, MapPin, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getPublicPass } from "../services/pass.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PLATFORM_NAME } from "@/constants/branding";

export default function PassPage() {
  const { token } = useParams();
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getPublicPass(token);
        if (!cancelled) setPass(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message ?? "This pass could not be found.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !pass) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="size-10 mx-auto text-destructive" />
            <p className="font-display font-semibold">{error || "Pass not found"}</p>
            <Button asChild variant="outline">
              <Link to="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const when = pass.event?.startDate
    ? format(new Date(pass.event.startDate), "PPP p")
    : "See event details";
  const where = pass?.event?.eventType === "online"
    ? (pass?.event?.onlineLink || "Online event")
    : (pass?.event?.venue?.name || pass?.event?.venue || "Venue TBA");

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-b from-emerald-50/80 to-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <p className="text-xs font-bold tracking-widest uppercase text-primary">{PLATFORM_NAME}</p>
          <CardTitle className="font-display text-xl">Event Pass</CardTitle>
          <CardDescription>Show this QR at the entrance for check-in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1">
            <p className="font-display font-bold text-foreground">{pass.event?.title}</p>
            {pass.teamName && (
              <p className="text-sm text-muted-foreground">Team: {pass.teamName}</p>
            )}
            <p className="text-sm font-medium">{pass.attendeeName}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <Clock className="size-3" />
              <span>{when}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              <span className="truncate">{where}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <img
              src={pass.qrDataUrl}
              alt="Event pass QR code"
              width={220}
              height={220}
              className="rounded-xl border border-border bg-white p-2"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <QrCode className="size-3" />
              Staff will scan this code to mark your attendance
            </p>
          </div>

          {pass.checkedInAt ? (
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900">
                Checked in {format(new Date(pass.checkedInAt), "PPp")}
              </AlertDescription>
            </Alert>
          ) : pass.registrationStatus === "waitlisted" ? (
            <Badge variant="secondary" className="w-full justify-center py-2 bg-sky-50 text-sky-800">
              Waitlisted — pass not yet valid for check-in
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-full justify-center py-2">
              Not yet checked in
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
