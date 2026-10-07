import { motion } from "framer-motion";
import { CalendarDays, Users, Ticket, TrendingUp, XCircle, BarChart2 } from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STAT_CARDS = [
  {
    key:    "totalEvents",
    label:  "Total Events",
    icon:   CalendarDays,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    format: (v) => v,
  },
  {
    key:    "totalRegistrations",
    label:  "Total Registrations",
    icon:   Ticket,
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-400",
    format: (v) => (typeof v === "number" ? v.toLocaleString() : v),
  },
  {
    key:    "activeStudents",
    label:  "Active Students",
    icon:   Users,
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-400",
    format: (v) => (typeof v === "number" ? v.toLocaleString() : v),
  },
  {
    key:    "publishedEvents",
    label:  "Published",
    icon:   TrendingUp,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
    format: (v) => v,
  },
  {
    key:    "cancelledEvents",
    label:  "Cancelled",
    icon:   XCircle,
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    format: (v) => v,
  },
  {
    key:    "avgCapacityFill",
    label:  "Avg. Capacity Fill",
    icon:   BarChart2,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    format: (v) => v,
  },
];

const SkeletonCard = ({ i }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: i * 0.06 }}
  >
    <Card size="sm">
      <CardContent className="space-y-3 pt-0">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  </motion.div>
);

export default function StatsGrid() {
  const { stats, analyticsLoading } = useAdmin();

  if (analyticsLoading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAT_CARDS.map((_, i) => <SkeletonCard key={i} i={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {STAT_CARDS.map(({ key, label, icon: Icon, iconBg, iconColor, format }, i) => {
        const stat = stats[key] ?? { value: 0, delta: null };
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <Card size="sm">
              <CardContent className="pt-0">
                <div className={cn("size-8 rounded-lg flex items-center justify-center mb-3", iconBg)}>
                  <Icon className={cn("size-4", iconColor)} />
                </div>
                <p className="font-display font-bold text-xl leading-none text-foreground">
                  {format(stat.value)}
                </p>
                <p className="text-xs mt-1.5 text-muted-foreground">{label}</p>
                {stat.delta && (
                  <p className={cn(
                    "text-xs mt-0.5 font-semibold",
                    stat.positive ? "text-emerald-400" : "text-red-400"
                  )}>
                    {stat.delta}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
