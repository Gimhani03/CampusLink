import { format, formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";

/**
 * Format a date as "Fri, Jan 10" or "Fri, Jan 10 · 2:00 PM"
 */
export const formatEventDate = (date, includeTime = false) => {
  const d = new Date(date);
  if (includeTime) return format(d, "EEE, MMM d · h:mm a");
  return format(d, "EEE, MMM d");
};

/**
 * Format a date range for an event.
 */
export const formatDateRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  if (format(s, "MMM d") === format(e, "MMM d")) {
    return format(s, "EEE, MMM d, yyyy");
  }
  return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
};

/**
 * Returns urgency metadata for a deadline.
 * Used to colour-code deadline widgets.
 */
export const getDeadlineUrgency = (deadline) => {
  const hoursLeft = differenceInHours(new Date(deadline), new Date());
  const daysLeft = differenceInDays(new Date(deadline), new Date());

  if (hoursLeft <= 0) return { label: "Closed", color: "#64748b", bg: "rgba(100,116,139,0.12)", urgent: false };
  if (hoursLeft <= 24) return { label: `${hoursLeft}h left`, color: "#f87171", bg: "rgba(248,113,113,0.12)", urgent: true };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, color: "#fb923c", bg: "rgba(251,146,60,0.12)", urgent: true };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: "#fbbf24", bg: "rgba(251,191,36,0.12)", urgent: false };
  return { label: `${daysLeft}d left`, color: "#34d399", bg: "rgba(52,211,153,0.12)", urgent: false };
};

/**
 * Returns "2 hours ago", "yesterday", etc.
 */
export const timeAgo = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

/**
 * Capacity fill percentage (0-100).
 */
export const capacityPercent = (count, capacity) => {
  if (!capacity) return 0;
  return Math.min(Math.round((count / capacity) * 100), 100);
};

/**
 * Spots remaining label with urgency.
 */
export const spotsLabel = (count, capacity, teamMode = false) => {
  if (!capacity) return null;
  const remaining = capacity - count;
  const unit = teamMode ? "teams" : "spots";
  if (remaining <= 0) return { text: "Full", urgent: true };
  if (remaining <= 5) return { text: `${remaining} ${unit} left`, urgent: true };
  if (remaining <= 20) return { text: `${remaining} ${unit} left`, urgent: false };
  return null;
};

/**
 * Format large numbers: 1243 → "1.2k"
 */
export const formatCount = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};
