/**
 * AuthShell — shared layout for login / signup pages.
 * Desktop: brand panel + form. Mobile: compact header + form.
 */

import { motion } from "framer-motion";
import {
  BarChart3, CalendarDays, QrCode, ScanLine, Sparkles, Ticket,
} from "lucide-react";
import BrandMark from "../common/BrandMark";
import { cn } from "@/lib/utils";
import {
  PLATFORM_COPYRIGHT,
  PLATFORM_NAME,
  UNIVERSITY_NAME,
} from "@/constants/branding";

const STUDENT_HIGHLIGHTS = [
  { icon: CalendarDays, text: "Browse campus & inter-university events" },
  { icon: Ticket, text: "Register in seconds with your student profile" },
  { icon: QrCode, text: "Get a unique QR pass for event check-in" },
];

const ADMIN_HIGHLIGHTS = [
  { icon: CalendarDays, text: "Publish and manage campus events" },
  { icon: ScanLine, text: "Scan QR passes and track attendance" },
  { icon: BarChart3, text: "View registrations and analytics" },
];

export const AuthField = ({ label, error, hint, children, htmlFor }) => (
  <div className="space-y-1.5">
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-foreground"
    >
      {label}
    </label>
    {children}
    {hint && !error && (
      <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    )}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

export const StepIndicator = ({ step, total, labels = [] }) => (
  <div className="mb-6 space-y-3">
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === step ? "w-8 bg-primary" : "w-2",
            i < step ? "bg-primary/70" : i === step ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
      <span className="ml-auto text-[11px] font-medium text-muted-foreground tabular-nums">
        {step + 1} / {total}
      </span>
    </div>
    {labels[step] && (
      <p className="text-xs font-medium text-primary">{labels[step]}</p>
    )}
  </div>
);

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  variant = "student",
  step,
  children,
  footer,
  bottomNote,
}) {
  const brandEyebrow = eyebrow ?? PLATFORM_NAME;

  const asideCopy = {
    student: {
      heading: "Your campus events,\none place.",
      body: `Discover hackathons, career fairs, sports meets, and club events across ${UNIVERSITY_NAME}.`,
    },
    register: {
      heading: `Join ${PLATFORM_NAME}`,
      body: "Create your student account once — your profile auto-fills every event registration.",
    },
    guest: {
      heading: "Inter-university\nhackathons",
      body: "Guest accounts are for students from partner universities joining open hackathon events.",
    },
    admin: {
      heading: "Administration\nportal",
      body: `Secure access for ${UNIVERSITY_NAME} staff to manage events, registrations, and check-ins.`,
    },
  }[variant] ?? {
    heading: PLATFORM_NAME,
    body: `${UNIVERSITY_NAME} Event Platform`,
  };

  const highlights = variant === "admin" ? ADMIN_HIGHLIGHTS : STUDENT_HIGHLIGHTS;
  const footerCopyright =
    variant === "admin"
      ? `${PLATFORM_NAME} · Admin Portal`
      : PLATFORM_COPYRIGHT;

  return (
    <div className="min-h-dvh auth-bg flex">
      {/* Brand panel — desktop only */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.18),transparent_50%)]" />
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-16 bottom-10 size-56 rounded-full bg-black/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-12 w-full">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <BrandMark size="md" className="bg-white/15 border-white/25 shadow-lg" />
              <div>
                <p className="font-display font-bold text-lg tracking-tight">{PLATFORM_NAME}</p>
                <p className="text-xs text-primary-foreground/75">{UNIVERSITY_NAME}</p>
              </div>
            </div>

            <h2 className="font-display font-bold text-3xl xl:text-4xl leading-tight whitespace-pre-line">
              {asideCopy.heading}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/85 max-w-sm">
              {asideCopy.body}
            </p>
          </div>

          <ul className="space-y-4 mt-10">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 border border-white/20">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-primary-foreground/60 mt-8">
            © {new Date().getFullYear()} {footerCopyright}
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <BrandMark size="sm" />
            <div>
              <p className="font-display font-bold text-base leading-none">{PLATFORM_NAME}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{UNIVERSITY_NAME}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2 flex items-center gap-1.5">
              <Sparkles className="size-3" />
              {brandEyebrow}
            </p>
            <h1 className="font-display font-bold text-2xl sm:text-[1.65rem] text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>
            )}
          </div>

          {step && (
            <StepIndicator step={step.current} total={step.total} labels={step.labels} />
          )}

          <div className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(13,107,74,0.06)] p-5 sm:p-6">
            {children}
          </div>

          {footer && (
            <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
          )}

          {bottomNote && (
            <p className="text-center text-[11px] text-muted-foreground/70 mt-4">{bottomNote}</p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
