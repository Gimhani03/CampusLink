import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Search, Bell, Menu, Check, X, Calendar,
  AlertCircle, Star, Megaphone, ChevronRight
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { timeAgo } from "../../utils/formatters";
import BrandMark from "../common/BrandMark";
import { PLATFORM_NAME } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

const notifIcon = {
  registration_confirmed: { Icon: Check,       color: "text-emerald-400" },
  registration_rejected:  { Icon: X,           color: "text-red-400" },
  registration_cancelled: { Icon: X,           color: "text-orange-400" },
  deadline_reminder:      { Icon: AlertCircle, color: "text-slate-600" },
  event_updated:          { Icon: Calendar,    color: "text-primary" },
  event_cancelled:        { Icon: X,           color: "text-red-400" },
  new_channel_event:      { Icon: Star,        color: "text-rose-400" },
  event_starts_soon:      { Icon: Calendar,    color: "text-sky-400" },
  admin_announcement:     { Icon: Megaphone,   color: "text-orange-400" },
};

export default function Navbar() {
  const { student, notifications, unreadCount, markNotificationRead, toggleSidebar, openSearch } =
    useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onNotifPage = location.pathname === "/notifications";

  const avatarUrl = student?.profilePicture?.url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(student?.fullName ?? "U")}`;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex items-center h-16 px-4 md:px-6 glass-nav">
      <div className="flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="size-5" />
        </Button>

        <Link to="/" className="flex items-center gap-2.5 group">
          <BrandMark size="sm" />
          <span className="font-display font-bold text-xl tracking-tight hidden sm:block text-foreground">
            {PLATFORM_NAME}
          </span>
        </Link>
      </div>

      <div className="flex-1 max-w-lg mx-4 md:mx-8 hidden md:block">
        <Button
          variant="outline"
          onClick={openSearch}
          className="w-full justify-start gap-3 h-10 bg-input/30 text-muted-foreground font-normal"
        >
          <Search className="size-4" />
          <span>Search events, channels...</span>
          <kbd className="ml-auto text-xs px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground border border-border">
            ⌘K
          </kbd>
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={openSearch}
          className="md:hidden"
          aria-label="Search"
        >
          <Search className="size-5" />
        </Button>

        <DropdownMenu open={onNotifPage ? false : undefined}>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 size-4 p-0 flex items-center justify-center text-[10px]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-display font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} unread</Badge>
              )}
            </div>
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Bell className="mx-auto mb-2 opacity-40 size-6" />
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const meta = notifIcon[n.type] || notifIcon.admin_announcement;
                  return (
                    <DropdownMenuItem
                      key={n._id}
                      onClick={() => markNotificationRead(n._id)}
                      className={`flex items-start gap-3 px-4 py-3 rounded-none cursor-pointer ${!n.isRead ? "bg-accent/50" : ""}`}
                    >
                      <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-muted ${meta.color}`}>
                        <meta.Icon className="size-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight mb-0.5">{n.title}</p>
                        <p className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">{n.body}</p>
                        <p className="text-xs mt-1 text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="shrink-0 w-2 h-2 rounded-full mt-2 bg-primary" />}
                    </DropdownMenuItem>
                  );
                })
              )}
            </ScrollArea>
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-primary border-t border-border hover:bg-accent/50 transition-colors"
            >
              View all notifications <ChevronRight className="size-3.5" />
            </button>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="pl-1 pr-2 h-9 gap-2" aria-label="Profile menu">
                <Avatar className="size-7 rounded-lg">
                  <AvatarImage src={avatarUrl} alt={student?.fullName ?? "User"} className="rounded-lg" />
                  <AvatarFallback className="rounded-lg text-xs">
                    {student?.fullName?.charAt(0) ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:block">
                  {student?.fullName?.split(" ")[0] ?? "Me"}
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="font-display font-semibold text-sm">{student?.fullName ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {student?.studentType === "external"
                  ? (student?.university ?? "")
                  : (student?.studentId ?? "")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{student?.degree ?? ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>View Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/my-events")}>My Registrations</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/saved")}>Saved Events</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>Account Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
