/**
 * Charts.jsx
 *
 * All admin data visualisations in one file.
 * Uses Recharts with shadcn Card wrappers.
 * Data is sourced from AdminContext (real API) — no mock imports.
 */

import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useAdmin } from "../../context/AdminContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const AXIS_TICK = { fill: "#5c5c88", fontSize: 11 };
const GRID_LINE = { stroke: "rgba(255,255,255,0.04)" };

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-xl bg-popover border border-border">
      {label && (
        <p className="font-semibold mb-1.5 text-muted-foreground">{label}</p>
      )}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold ml-1 text-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ChartCard = ({ title, subtitle, children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className={className}
  >
    <Card>
      <CardHeader>
        <CardTitle className="font-display">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  </motion.div>
);

const ChartSkeleton = ({ height = 220, className = "" }) => (
  <ChartCard title="" className={className}>
    <Skeleton className="w-full rounded-xl" style={{ height }} />
  </ChartCard>
);

export const RegistrationTrendChart = () => {
  const { registrationTrend, analyticsLoading } = useAdmin();

  if (analyticsLoading || !registrationTrend.length)
    return <ChartSkeleton height={220} />;

  return (
    <ChartCard
      title="Registration Trend"
      subtitle="Daily registrations over the last 30 days"
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={registrationTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0d6b4a" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0d6b4a" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" {...GRID_LINE} vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
          <Area type="monotone" dataKey="registrations" name="Registrations"
            stroke="#0d6b4a" strokeWidth={2} fill="url(#gradViolet)" dot={false} />
          <Area type="monotone" dataKey="events" name="Events Published"
            stroke="#f59e0b" strokeWidth={1.5} fill="url(#gradAmber)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const EventsBarChart = () => {
  const { topEvents, analyticsLoading } = useAdmin();

  if (analyticsLoading || !topEvents.length)
    return <ChartSkeleton height={260} />;

  return (
    <ChartCard title="Top Events by Registrations" subtitle="Registration count vs capacity">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={topEvents} layout="vertical"
          margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...GRID_LINE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fontSize: 10 }}
            axisLine={false} tickLine={false} width={110} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="count" name="Registered" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {topEvents.map((entry) => {
              const pct = entry.capacity > 0 ? (entry.count / entry.capacity) * 100 : 0;
              const color = pct >= 90 ? "#f87171" : pct >= 70 ? "#f59e0b" : "#0d6b4a";
              return <Cell key={entry.name} fill={color} />;
            })}
          </Bar>
          <Bar dataKey="capacity" name="Capacity" radius={[0, 4, 4, 0]} maxBarSize={16}
            fill="rgba(255,255,255,0.06)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: "10px", fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const CategoryDonutChart = () => {
  const { eventsByCategory, analyticsLoading } = useAdmin();

  if (analyticsLoading || !eventsByCategory.length)
    return <ChartSkeleton height={220} />;

  return (
    <ChartCard
      title="Events by Category"
      subtitle={`${eventsByCategory.length} categor${eventsByCategory.length === 1 ? "y" : "ies"}`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={eventsByCategory} cx="50%" cy="50%"
            innerRadius={55} outerRadius={85}
            paddingAngle={3} dataKey="value"
            labelLine={false} label={<CustomPieLabel />}>
            {eventsByCategory.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<DarkTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        {eventsByCategory.map((cat) => (
          <div key={cat.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
            <span className="text-xs text-muted-foreground">
              {cat.name}
              <span className="font-semibold ml-1 text-foreground">{cat.value}</span>
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
};

export const MonthlyCreationChart = () => {
  const { monthlyCreation, analyticsLoading } = useAdmin();

  if (analyticsLoading || !monthlyCreation.length)
    return <ChartSkeleton height={200} />;

  return (
    <ChartCard title="Monthly Event Activity" subtitle="Events created vs published per month">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={monthlyCreation}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" {...GRID_LINE} vertical={false} />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "var(--muted-foreground)" }} />
          <Bar dataKey="created"   name="Created"   fill="#0d6b4a" radius={[3,3,0,0]} maxBarSize={18} />
          <Bar dataKey="published" name="Published" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
