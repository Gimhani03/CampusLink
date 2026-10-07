import {
  LayoutDashboard, CalendarDays, PlusCircle, Ticket, BarChart2,
  Radio, Bell, Settings, X, ChevronRight, User, ScanLine
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Main",
    items: [
      { id: "overview",      icon: LayoutDashboard, label: "Overview"       },
      { id: "analytics",     icon: BarChart2,       label: "Analytics"      },
    ],
  },
  {
    label: "Events",
    items: [
      { id: "events",        icon: CalendarDays,    label: "All Events"     },
      { id: "create",        icon: PlusCircle,      label: "Create Event"   },
      { id: "registrations", icon: Ticket,          label: "Registrations"  },
      { id: "checkin",       icon: ScanLine,        label: "Check-In"       },
      { id: "calendar",      icon: CalendarDays,    label: "Calendar"       },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "channels",      icon: Radio,           label: "Channels"       },
      { id: "notifications", icon: Bell,            label: "Notifications"  },
      { id: "profile",       icon: User,            label: "My Profile"     },
      { id: "settings",      icon: Settings,        label: "Settings"       },
    ],
  },
];

const SidebarContent = ({ onClose }) => {
  const { admin, activeSection, setActiveSection } = useAdmin();

  const handleNav = (id) => {
    setActiveSection(id);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      {onClose && (
        <div className="flex justify-end px-3 pt-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => handleNav("profile")}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-100 border border-slate-200 text-left transition-colors hover:bg-slate-100"
        >
          <img
            src={admin?.profilePicture?.url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(admin?.fullName ?? "Admin")}&backgroundColor=0d6b4a&fontColor=ffffff`}
            alt={admin?.fullName ?? "Admin"}
            className="size-8 rounded-lg object-cover shrink-0 ring-1 ring-slate-400/40"
          />
          <div className="min-w-0">
            <p className="font-display font-semibold text-xs leading-tight truncate text-foreground">
              {admin?.fullName ?? "Administrator"}
            </p>
            <p className="text-[11px] mt-0.5 text-muted-foreground">System Administrator</p>
          </div>
        </button>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] font-bold tracking-widest uppercase px-3 mb-1.5 text-muted-foreground/60">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ id, icon: Icon, label }) => {
                const active = activeSection === id;
                return (
                  <li key={id}>
                    <Button
                      variant="ghost"
                      onClick={() => handleNav(id)}
                      className={cn(
                        "w-full justify-start gap-3 h-auto py-2.5 px-3 text-sm font-medium rounded-xl",
                        active
                          ? "bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/15 hover:text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {active && <ChevronRight className="size-3 text-primary" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </ScrollArea>

      <div className="px-3 py-3 border-t border-border">
        <a
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LayoutDashboard className="size-4" />
          <span>Student View</span>
        </a>
      </div>
    </div>
  );
};

export default function AdminSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAdmin();

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen overflow-hidden bg-card border-r border-border">
        <SidebarContent />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 lg:hidden" showCloseButton={false}>
          <SidebarContent onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
