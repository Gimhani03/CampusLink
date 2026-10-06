/**
 * Student Dashboard Page
 *
 * NSBM students: full dashboard (hero, upcoming, recommendations, channels, trending).
 * Guest students: inter-university hackathons only — no channels or campus recommendations.
 */

import { motion } from "framer-motion";
import {
  LayoutDashboard, CalendarDays, Ticket, Bookmark, Radio, GraduationCap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isExternalStudent } from "../constants/eventAudience";
import { filterNavForGuest } from "../constants/guestNav";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import Hero from "../components/dashboard/Hero";
import UpcomingEvents from "../components/dashboard/UpcomingEvents";
import RecommendedEvents from "../components/dashboard/RecommendedEvents";
import FollowedChannels from "../components/dashboard/FollowedChannels";
import DeadlineWidget from "../components/dashboard/DeadlineWidget";
import TrendingEvents from "../components/dashboard/TrendingEvents";
import SearchModal from "../components/dashboard/SearchModal";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { icon: LayoutDashboard, label: "Home",    href: "/",          active: true  },
  { icon: CalendarDays,    label: "Events",  href: "/events",    active: false },
  { icon: Ticket,          label: "Mine",    href: "/my-events", active: false },
  { icon: Bookmark,        label: "Saved",   href: "/saved",     active: false },
  { icon: Radio,           label: "Channels", href: "/channels", active: false },
];

const MobileBottomNav = ({ isGuest }) => {
  const items = filterNavForGuest(mobileNavItems, isGuest);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center glass-bar border-t pb-[env(safe-area-inset-bottom,0)]">
      {items.map(({ icon: Icon, label, href, active }) => (
        <a
          key={label}
          href={href}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-3 text-center transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Icon size={20} />
          <span className="text-[10px] font-medium">{label}</span>
        </a>
      ))}
    </nav>
  );
};

const GuestDashboardBanner = ({ university }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="mx-4 sm:mx-6 mt-4"
  >
    <Card className="border-primary/20 bg-primary/5 py-0">
      <CardContent className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-primary/15">
          <GraduationCap size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Guest dashboard — inter-university events
          </p>
          <p className="text-xs mt-0.5 leading-relaxed text-muted-foreground">
            You&apos;re signed in as a student from <strong>{university || "your university"}</strong>.
            Only open hackathons and inter-university events are shown here — NSBM campus events are not available on guest accounts.
          </p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const isGuest = isExternalStudent(user);

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          {isGuest && <GuestDashboardBanner university={user?.university} />}

          <Hero />

          <UpcomingEvents />

          <RecommendedEvents />

          {!isGuest ? (
            <div className="px-0">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-0 md:gap-0">
                <div className="md:col-span-3">
                  <FollowedChannels />
                </div>
                <div className="md:col-span-2 px-4 sm:px-6 py-6 border-l border-border">
                  <DeadlineWidget />
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-6">
              <DeadlineWidget />
            </div>
          )}

          <Separator className="mx-4 sm:mx-6" />

          <TrendingEvents />

          <div className="h-8" />
        </main>
      </div>

      <MobileBottomNav isGuest={isGuest} />
    </div>
  );
}
