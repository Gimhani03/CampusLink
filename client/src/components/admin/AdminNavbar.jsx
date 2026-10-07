import { Menu, Bell, Shield } from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const sectionTitles = {
  overview:      "Overview",
  analytics:     "Analytics",
  events:        "All Events",
  create:        "Create Event",
  edit:          "Edit Event",
  registrations: "Registrations",
  calendar:      "Calendar",
  channels:      "Channels",
  profile:       "My Profile",
  notifications: "Notifications",
  settings:      "Settings",
};

export default function AdminNavbar() {
  const { admin, activeSection, setSidebarOpen, setActiveSection } = useAdmin();

  const avatarSrc = admin?.profilePicture?.url
    || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(admin?.fullName ?? "Admin")}&backgroundColor=0d6b4a&fontColor=ffffff`;

  return (
    <header className="sticky top-0 z-30 flex items-center h-14 px-4 md:px-6 shrink-0 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-muted-foreground"
        >
          <Menu className="size-4" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium hidden sm:block text-muted-foreground">
            Admin
          </span>
          <Separator orientation="vertical" className="hidden sm:block h-4" />
          <span className="font-display font-bold text-sm text-foreground">
            {sectionTitles[activeSection] || "Dashboard"}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" className="relative text-muted-foreground">
          <Bell className="size-4" />
          <Badge className="absolute -top-0.5 -right-0.5 size-3.5 p-0 flex items-center justify-center text-[9px] bg-slate-800 text-white border-0">
            3
          </Badge>
        </Button>

        <button
          type="button"
          onClick={() => setActiveSection("profile")}
          className="flex items-center gap-2 pl-2 pr-1 h-8 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          <img
            src={avatarSrc}
            alt={admin?.fullName ?? "Admin"}
            className="size-6 rounded-md object-cover ring-1 ring-slate-400/40"
          />
          <span className="text-xs font-medium hidden sm:block text-foreground">
            {admin?.fullName?.split(" ")[0] ?? "Admin"}
          </span>
          <Shield className="size-3 text-slate-800 hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
