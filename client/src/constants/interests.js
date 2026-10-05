/**
 * Canonical interest tags — single source of truth.
 *
 * Used by:
 *   • RegisterPage  (step 3 — interests selector)
 *   • ProfilePage   (interests picker)
 *   • Recommendation engine (matches against event tags)
 *
 * `value` is what gets stored in the database (lowercase, URL-safe).
 * `label` is the display text.
 * `emoji` adds visual affordance.
 * `group` is used to visually cluster related tags.
 */

export const INTERESTS = [
  // ── Technology ────────────────────────────────────────────────────────────
  { value: "technology",    label: "Technology",    emoji: "💻", group: "Technology" },
  { value: "ai-ml",         label: "AI / ML",       emoji: "🤖", group: "Technology" },
  { value: "web-dev",       label: "Web Dev",        emoji: "🌐", group: "Technology" },
  { value: "cybersecurity", label: "Cybersecurity",  emoji: "🔒", group: "Technology" },
  { value: "data-science",  label: "Data Science",   emoji: "📊", group: "Technology" },

  // ── Career & Academic ─────────────────────────────────────────────────────
  { value: "career",        label: "Career",         emoji: "💼", group: "Career & Academic" },
  { value: "networking",    label: "Networking",     emoji: "🤝", group: "Career & Academic" },
  { value: "research",      label: "Research",       emoji: "🔬", group: "Career & Academic" },
  { value: "academic",      label: "Academic",       emoji: "📚", group: "Career & Academic" },
  { value: "leadership",    label: "Leadership",     emoji: "🌟", group: "Career & Academic" },

  // ── Competition ───────────────────────────────────────────────────────────
  { value: "competition",   label: "Competition",    emoji: "🏆", group: "Competition" },
  { value: "hackathon",     label: "Hackathon",      emoji: "⚡", group: "Competition" },
  { value: "debate",        label: "Debate",         emoji: "🎤", group: "Competition" },

  // ── Arts & Culture ────────────────────────────────────────────────────────
  { value: "cultural",      label: "Cultural",       emoji: "🎭", group: "Arts & Culture" },
  { value: "music",         label: "Music",          emoji: "🎵", group: "Arts & Culture" },
  { value: "art",           label: "Art",            emoji: "🎨", group: "Arts & Culture" },
  { value: "drama",         label: "Drama",          emoji: "🎬", group: "Arts & Culture" },
  { value: "literature",    label: "Literature",     emoji: "📖", group: "Arts & Culture" },
  { value: "photography",   label: "Photography",    emoji: "📷", group: "Arts & Culture" },

  // ── Sports ────────────────────────────────────────────────────────────────
  { value: "sports",        label: "Sports",         emoji: "⚽", group: "Sports" },
  { value: "cricket",       label: "Cricket",        emoji: "🏏", group: "Sports" },
  { value: "badminton",     label: "Badminton",      emoji: "🏸", group: "Sports" },

  // ── Lifestyle & Social ────────────────────────────────────────────────────
  { value: "social",        label: "Social",         emoji: "🎉", group: "Lifestyle" },
  { value: "health",        label: "Health",         emoji: "🏥", group: "Lifestyle" },
  { value: "environment",   label: "Environment",    emoji: "🌱", group: "Lifestyle" },
  { value: "gaming",        label: "Gaming",         emoji: "🎮", group: "Lifestyle" },
  { value: "writing",       label: "Writing",        emoji: "✍️",  group: "Lifestyle" },
];

/** Flat array of value strings — used for validation. */
export const INTEREST_VALUES = INTERESTS.map((i) => i.value);

/** Quick lookup map by value → interest object. */
export const INTEREST_MAP = Object.fromEntries(INTERESTS.map((i) => [i.value, i]));
