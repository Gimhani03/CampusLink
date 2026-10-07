/**
 * AdminDashboard.jsx
 *
 * The root admin page. Wraps AdminProvider, mounts the persistent
 * sidebar + navbar, and renders the active section.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Construction, LayoutDashboard, CalendarDays, PlusCircle, Ticket, BarChart2, ScanLine } from "lucide-react";

import { useAdmin } from "../context/AdminContext";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminNavbar  from "../components/admin/AdminNavbar";
import StatsGrid    from "../components/admin/StatsGrid";
import {
  RegistrationTrendChart,
  EventsBarChart,
  CategoryDonutChart,
  MonthlyCreationChart,
} from "../components/admin/Charts";
import EventsTable      from "../components/admin/EventsTable";
import CreateEventForm  from "../components/admin/CreateEventForm";
import EditEventForm    from "../components/admin/EditEventForm";
import RegistrationMgmt from "../components/admin/RegistrationMgmt";
import CheckInScanner   from "../components/admin/CheckInScanner";
import AdminCalendar    from "../components/admin/AdminCalendar";
import ChannelMgmt     from "../components/admin/ChannelMgmt";
import AdminProfile    from "../components/admin/AdminProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
    <div>
      <h2 className="font-display font-bold text-xl text-foreground">{title}</h2>
      {subtitle && (
        <p className="text-sm mt-0.5 text-muted-foreground">{subtitle}</p>
      )}
    </div>
    {action}
  </div>
);

const ComingSoon = ({ label }) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="size-14 rounded-2xl flex items-center justify-center bg-slate-100">
        <Construction className="size-6 text-slate-700" />
      </div>
      <div className="text-center">
        <p className="font-display font-bold text-lg text-foreground">{label}</p>
        <p className="text-sm mt-1 text-muted-foreground">This section is coming soon.</p>
      </div>
    </CardContent>
  </Card>
);

const MobileBottomNav = () => {
  const { activeSection, setActiveSection } = useAdmin();
  const items = [
    { id: "overview",      icon: LayoutDashboard, label: "Home"    },
    { id: "events",        icon: CalendarDays,    label: "Events"  },
    { id: "create",        icon: PlusCircle,      label: "Create"  },
    { id: "registrations", icon: Ticket,          label: "Regs"    },
    { id: "analytics",     icon: BarChart2,       label: "Stats"   },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex lg:hidden h-16 px-2 items-center justify-around bg-background/95 backdrop-blur-xl border-t border-border">
      {items.map(({ id, icon: Icon, label }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon size={active ? 20 : 18} />
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const SectionRenderer = ({ onViewRegistrations, registrationEventId }) => {
  const { activeSection, setActiveSection } = useAdmin();

  const sections = {
    overview: (
      <div className="space-y-5">
        <SectionHeader
          title="Overview"
          subtitle="Platform health and registration activity at a glance"
        />
        <StatsGrid />
        <RegistrationTrendChart />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <EventsBarChart />
          <CategoryDonutChart />
        </div>
        <MonthlyCreationChart />
      </div>
    ),

    analytics: (
      <div className="space-y-5">
        <SectionHeader
          title="Analytics"
          subtitle="Deep-dive into event and registration metrics"
        />
        <StatsGrid />
        <div className="grid grid-cols-1 gap-5">
          <RegistrationTrendChart />
          <MonthlyCreationChart />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <EventsBarChart />
          <CategoryDonutChart />
        </div>
      </div>
    ),

    events: (
      <div className="space-y-5">
        <SectionHeader
          title="All Events"
          subtitle="Manage, filter, and control every event on the platform"
          action={
            <Button size="sm" onClick={() => setActiveSection("create")} className="shrink-0">
              <PlusCircle className="size-3.5" />
              New Event
            </Button>
          }
        />
        <EventsTable
          onViewRegistrations={(eventId) => {
            onViewRegistrations(eventId);
            setActiveSection("registrations");
          }}
        />
      </div>
    ),

    create: (
      <div className="space-y-5">
        <SectionHeader
          title="Create Event"
          subtitle="Fill in the details below to publish a new event"
        />
        <CreateEventForm />
      </div>
    ),

    edit: (
      <div className="space-y-5">
        <SectionHeader
          title="Edit Event"
          subtitle="Update the details below and save your changes"
        />
        <EditEventForm />
      </div>
    ),

    registrations: (
      <div className="space-y-5">
        <SectionHeader
          title="Registration Management"
          subtitle="Review, confirm, waitlist, or cancel student registrations"
        />
        <RegistrationMgmt defaultEventId={registrationEventId} />
      </div>
    ),

    checkin: (
      <div className="space-y-5">
        <SectionHeader
          title="Attendance Check-In"
          subtitle="Scan student QR passes to mark event attendance"
        />
        <CheckInScanner />
      </div>
    ),

    calendar: (
      <div className="space-y-5">
        <SectionHeader
          title="Event Calendar"
          subtitle="View all events by date — filter by status or category"
        />
        <AdminCalendar
          onViewRegistrations={(eventId) => {
            onViewRegistrations(eventId);
            setActiveSection("registrations");
          }}
        />
      </div>
    ),

    channels: (
      <div className="space-y-5">
        <SectionHeader
          title="Channel Management"
          subtitle="Create, edit, and manage all event channels on the platform"
        />
        <ChannelMgmt />
      </div>
    ),

    profile: (
      <div className="space-y-5">
        <SectionHeader
          title="My Profile"
          subtitle="Manage your administrator account and security settings"
        />
        <AdminProfile />
      </div>
    ),

    notifications: <ComingSoon label="Notification Centre" />,
    settings:      <ComingSoon label="Platform Settings"   />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeSection}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {sections[activeSection] || sections.overview}
      </motion.div>
    </AnimatePresence>
  );
};

const AdminLayout = () => {
  const [registrationEventId, setRegistrationEventId] = useState(null);

  return (
    <div className="min-h-dvh admin-bg flex flex-col">
      <AdminNavbar />

      <div className="flex flex-1 min-h-0 max-w-screen-2xl w-full mx-auto">
        <AdminSidebar />

        <main className="flex-1 min-w-0 px-4 md:px-6 py-5 pb-24 lg:pb-8 overflow-y-auto">
          <SectionRenderer
            onViewRegistrations={(id) => setRegistrationEventId(id)}
            registrationEventId={registrationEventId}
          />
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default function AdminDashboard() {
  return <AdminLayout />;
}
