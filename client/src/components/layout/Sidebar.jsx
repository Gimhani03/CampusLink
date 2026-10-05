import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, Ticket, Bookmark,
  Radio, Users, Settings, ChevronRight, X, Bell
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { isExternalStudent } from "../../constants/eventAudience";
import { filterNavForGuest } from "../../constants/guestNav";
import BrandMark from "../common/BrandMark";
import { PLATFORM_NAME } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",        href: "/dashboard"      },
  { icon: CalendarDays,    label: "Browse Events",    href: "/events"         },
  { icon: Ticket,          label: "My Registrations", href: "/my-events"      },
  { icon: Bookmark,        label: "Saved Events",     href: "/saved"          },
  { icon: Radio,           label: "Channels",         href: "/channels"       },
  { icon: CalendarDays,    label: "Calendar",         href: "/calendar"       },
  { icon: Bell,            label: "Notifications",    href: "/notifications"  },
  { icon: Users,           label: "Community",        href: "/community"      },
];

const bottomItems = [
  { icon: Settings, label: "Settings", href: "/settings" },
];

const SidebarContent = ({ onClose }) => {
  const { student, unreadCount } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isGuest = isExternalStudent(student);
  const visibleNavItems = filterNavForGuest(navItems, isGuest);

  const isActive = (href) => {
    if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const avatarUrl = student?.profilePicture?.url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(student?.fullName ?? "U")}`;

  return (
    <div className="flex flex-col h-full">
      <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BrandMark size="xs" />
          <span className="font-display font-bold text-lg text-foreground">{PLATFORM_NAME}</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
          <Avatar className="size-9 rounded-lg">
            <AvatarImage src={avatarUrl} alt={student?.fullName ?? "User"} className="rounded-lg" />
            <AvatarFallback className="rounded-lg text-xs">
              {student?.fullName?.charAt(0) ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">
              {student?.fullName ?? "—"}
            </p>
            <p className="text-xs truncate mt-0.5 text-muted-foreground">
              {isGuest
                ? (student?.university ?? "Guest student")
                : `${student?.batch ?? ""}${student?.batch && student?.degree ? " · " : ""}${student?.degree?.split(" ")[0] ?? ""}`}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 pb-3">
        <p className="text-xs font-semibold tracking-widest uppercase px-3 mb-2 text-muted-foreground/60">
          Menu
        </p>

        <ul className="space-y-0.5">
          {visibleNavItems.map(({ icon: Icon, label, href }) => {
            const active = isActive(href);
            const badge = href === "/notifications" && unreadCount > 0 ? unreadCount : null;
            return (
              <li key={label}>
                <Button
                  variant="ghost"
                  onClick={() => { navigate(href); onClose(); }}
                  className={cn(
                    "w-full justify-start gap-3 h-10 px-3 font-medium",
                    active && "bg-accent text-accent-foreground border-l-2 border-primary rounded-l-none shadow-sm"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {badge && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4">
                      {badge > 9 ? "9+" : badge}
                    </Badge>
                  )}
                  {active && !badge && <ChevronRight className="size-3.5 text-primary" />}
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 px-3">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-muted-foreground/60">
            Your Activity
          </p>
          <div className={cn("grid gap-2", isGuest ? "grid-cols-3" : "grid-cols-2")}>
            {[
              { label: "Upcoming",   value: student?.stats?.upcomingRegistrations ?? 0, color: "text-primary" },
              { label: "Registered", value: student?.stats?.totalRegistrations    ?? 0, color: "text-teal-400" },
              { label: "Saved",      value: student?.stats?.savedEvents           ?? 0, color: "text-orange-700" },
              ...(!isGuest ? [{ label: "Channels", value: student?.stats?.followedChannels ?? 0, color: "text-rose-400" }] : []),
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center bg-muted/50">
                <p className={cn("font-display font-bold text-lg leading-none", color)}>{value}</p>
                <p className="text-xs mt-1 text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 py-3 border-t border-border">
        {bottomItems.map(({ icon: Icon, label, href }) => (
          <Button
            key={label}
            variant="ghost"
            onClick={() => { navigate(href); onClose(); }}
            className="w-full justify-start gap-3 h-10 px-3"
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useApp();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [setSidebarOpen]);

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden bg-sidebar border-r border-sidebar-border">
        <SidebarContent onClose={() => {}} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border" showCloseButton={false}>
          <SidebarContent onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
