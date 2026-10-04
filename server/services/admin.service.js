/**
 * Admin Service
 *
 * Aggregation-heavy queries that power the admin dashboard.
 * All functions return plain objects ready for JSON serialisation.
 *
 * Sections:
 *   getStats             — six KPI cards (counts + avg capacity fill)
 *   getRegistrationTrend — 30-day daily registrations + events published
 *   getTopEvents         — top-8 events by registration count
 *   getEventsByCategory  — event count grouped by category
 *   getMonthlyCreation   — events created vs published per month (last N months)
 */

import Event        from "../models/Event.model.js";
import Registration from "../models/Registration.model.js";
import User         from "../models/User.model.js";

// ─── Date helpers (pure JS, no external deps) ─────────────────────────────────

/** Returns a Date N whole days before start-of-today (UTC). */
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

/** Returns a Date N whole months before the first of this month (UTC). */
const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
};

/**
 * Formats a Date to "Mmm d" (e.g. "Jul 4") in UTC.
 * Uses a short month-name look-up to avoid locale surprises.
 */
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmtDay   = (d) => `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
const fmtMonth = (d) => MONTHS_SHORT[d.getUTCMonth()];

/** ISO date key "YYYY-MM-DD" in UTC. */
const isoDay = (d) => {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
};

/** ISO month key "YYYY-MM" in UTC. */
const isoMonth = (d) => {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}`;
};

// ─── Category colour palette ──────────────────────────────────────────────────

const CATEGORY_COLORS = {
  technology:  "#38bdf8",
  career:      "#fb923c",
  competition: "#f87171",
  cultural:    "#c084fc",
  sports:      "#34d399",
  academic:    "#60a5fa",
  social:      "#f472b6",
  religious:   "#fbbf24",
  other:       "#94a3b8",
};

// ─── KPI Stats ────────────────────────────────────────────────────────────────

export const getStats = async () => {
  const [
    totalEvents,
    publishedEvents,
    cancelledEvents,
    totalRegistrations,
    activeStudents,
    capacityAgg,
  ] = await Promise.all([
    Event.countDocuments({}),
    Event.countDocuments({ status: "published" }),
    Event.countDocuments({ status: "cancelled" }),
    Registration.countDocuments({ status: { $ne: "cancelled" } }),
    User.countDocuments({ role: "student", isActive: true }),
    Event.aggregate([
      { $match: { status: "published", capacity: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgFill: {
            $avg: {
              $multiply: [
                { $divide: ["$registrationCount", "$capacity"] },
                100,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const avgCapacityFill = capacityAgg[0]
    ? `${Math.round(capacityAgg[0].avgFill)}%`
    : "—";

  return {
    totalEvents:        { value: totalEvents,        delta: null },
    totalRegistrations: { value: totalRegistrations, delta: null },
    activeStudents:     { value: activeStudents,     delta: null },
    publishedEvents:    { value: publishedEvents,    delta: null },
    cancelledEvents:    { value: cancelledEvents,    delta: null },
    avgCapacityFill:    { value: avgCapacityFill,    delta: null },
  };
};

// ─── Registration Trend (last 30 days) ───────────────────────────────────────

export const getRegistrationTrend = async () => {
  const since = daysAgo(29);

  const [regAgg, eventAgg] = await Promise.all([
    Registration.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Event.aggregate([
      { $match: { status: "published", createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const regMap   = Object.fromEntries(regAgg.map((r) => [r._id, r.count]));
  const eventMap = Object.fromEntries(eventAgg.map((r) => [r._id, r.count]));

  return Array.from({ length: 30 }, (_, i) => {
    const d   = daysAgo(29 - i);
    const key = isoDay(d);
    return {
      date:          fmtDay(d),
      registrations: regMap[key]   ?? 0,
      events:        eventMap[key] ?? 0,
    };
  });
};

// ─── Top Events by Registrations ─────────────────────────────────────────────

export const getTopEvents = async (limit = 8) => {
  const events = await Event.find({ capacity: { $gt: 0 } })
    .sort({ registrationCount: -1 })
    .limit(limit)
    .select("title registrationCount capacity category")
    .lean();

  return events.map((e) => ({
    name:     e.title.length > 22 ? `${e.title.slice(0, 20)}…` : e.title,
    count:    e.registrationCount ?? 0,
    capacity: e.capacity,
    category: e.category,
  }));
};

// ─── Events by Category ───────────────────────────────────────────────────────

export const getEventsByCategory = async () => {
  const agg = await Event.aggregate([
    { $group: { _id: "$category", value: { $sum: 1 } } },
    { $sort: { value: -1 } },
  ]);

  return agg.map((r) => ({
    name:  r._id.charAt(0).toUpperCase() + r._id.slice(1),
    value: r.value,
    color: CATEGORY_COLORS[r._id] ?? "#94a3b8",
  }));
};

// ─── Monthly Event Activity (last N months) ───────────────────────────────────

export const getMonthlyCreation = async (months = 12) => {
  const since = monthsAgo(months - 1);

  const [createdAgg, publishedAgg] = await Promise.all([
    Event.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Event.aggregate([
      { $match: { status: "published", createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const createdMap   = Object.fromEntries(createdAgg.map((r) => [r._id, r.count]));
  const publishedMap = Object.fromEntries(publishedAgg.map((r) => [r._id, r.count]));

  return Array.from({ length: months }, (_, i) => {
    const d   = monthsAgo(months - 1 - i);
    const key = isoMonth(d);
    return {
      month:     fmtMonth(d),
      created:   createdMap[key]   ?? 0,
      published: publishedMap[key] ?? 0,
    };
  });
};
