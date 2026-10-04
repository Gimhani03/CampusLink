/** Shared team registration constants and helpers. */

export const TEAM_SIZES = [2, 3, 4, 5];

export const ABSOLUTE_MIN_TEAM_SIZE = 2;
export const ABSOLUTE_MAX_TEAM_SIZE = 5;

export const DEFAULT_MIN_TEAM_SIZE = 2;
export const DEFAULT_MAX_TEAM_SIZE = 4;

/** Resolve effective min/max member limits for a team event. */
export const getTeamSizeBounds = (event) => {
  const rawMin = event?.minTeamSize ?? DEFAULT_MIN_TEAM_SIZE;
  const rawMax = event?.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE;
  let min = Math.min(Math.max(rawMin, ABSOLUTE_MIN_TEAM_SIZE), ABSOLUTE_MAX_TEAM_SIZE);
  let max = Math.min(Math.max(rawMax, ABSOLUTE_MIN_TEAM_SIZE), ABSOLUTE_MAX_TEAM_SIZE);
  if (min > max) [min, max] = [max, min];
  return { min, max };
};

/** Allowed team sizes for an event (subset of TEAM_SIZES). */
export const getAllowedTeamSizes = (event) => {
  const { min, max } = getTeamSizeBounds(event);
  return TEAM_SIZES.filter((n) => n >= min && n <= max);
};

/** Default team size shown in the registration form. */
export const getDefaultTeamSize = (event) => {
  const allowed = getAllowedTeamSizes(event);
  const preferred = event?.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE;
  if (allowed.includes(preferred)) return preferred;
  return allowed[allowed.length - 1] ?? DEFAULT_MAX_TEAM_SIZE;
};

export const normalizeTeamSizeLimits = (data) => {
  if (data.registrationMode !== "team") {
    return { ...data, minTeamSize: null, maxTeamSize: null };
  }

  const min = Number(data.minTeamSize ?? DEFAULT_MIN_TEAM_SIZE);
  const max = Number(data.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE);
  let minTeamSize = Math.min(Math.max(min, ABSOLUTE_MIN_TEAM_SIZE), ABSOLUTE_MAX_TEAM_SIZE);
  let maxTeamSize = Math.min(Math.max(max, ABSOLUTE_MIN_TEAM_SIZE), ABSOLUTE_MAX_TEAM_SIZE);
  if (minTeamSize > maxTeamSize) [minTeamSize, maxTeamSize] = [maxTeamSize, minTeamSize];

  return { ...data, minTeamSize, maxTeamSize };
};

export const TEAM_ROLES = ["leader", "member_1", "member_2", "member_3", "member_4"];

export const ROLE_LABELS = {
  leader:   "Team Leader",
  member_1: "Member 1",
  member_2: "Member 2",
  member_3: "Member 3",
  member_4: "Member 4",
};

/** Human-readable labels for all member slots up to size 5. */
export const POSITION_OPTIONS = Object.values(ROLE_LABELS);

/**
 * Registration questions that duplicate built-in team registration fields.
 * Team mode collects team name, university, and positions automatically.
 */
const LEGACY_TEAM_QUESTION_PATTERNS = [
  /role in (the )?team/i,
  /your (team )?role/i,
  /team name/i,
  /name of (your )?team/i,
  /position in (the )?team/i,
];

const SKILL_BASED_ROLE_PATTERN = /team lead|developer|designer|data analyst|project manager|presenter/i;

export const isLegacyTeamRegistrationQuestion = (question) => {
  const text = (question?.question ?? "").trim();
  if (LEGACY_TEAM_QUESTION_PATTERNS.some((p) => p.test(text))) return true;
  const options = question?.options ?? [];
  if (options.some((o) => SKILL_BASED_ROLE_PATTERN.test(String(o)))) return true;
  return false;
};

export const stripLegacyTeamQuestions = (questions = []) =>
  questions.filter((q) => !isLegacyTeamRegistrationQuestion(q));

const isUniversityRegistrationQuestion = (question) =>
  /which university|university are you from/i.test((question?.question ?? "").trim());

/** Normalise event payload — strips questions handled by built-in team registration. */
export const sanitizeTeamEventData = (data) => {
  const normalized = normalizeTeamSizeLimits(data);
  if (!Array.isArray(normalized.registrationQuestions)) return normalized;

  if (normalized.registrationMode === "team") {
    return {
      ...normalized,
      registrationQuestions: stripLegacyTeamQuestions(normalized.registrationQuestions),
    };
  }

  // Individual events: university belongs in team registration only.
  return {
    ...normalized,
    registrationQuestions: normalized.registrationQuestions.filter(
      (q) => !isUniversityRegistrationQuestion(q)
    ),
  };
};

/** Returns role keys for a given team size (leader + member_1 …). */
export const getRolesForSize = (size) => {
  const roles = ["leader"];
  for (let i = 1; i < size; i++) roles.push(`member_${i}`);
  return roles;
};

/** Normalise NIC for duplicate checks (uppercase, trim). */
export const normalizeNic = (nic) => String(nic ?? "").trim().toUpperCase();

/** Normalise email for duplicate checks. */
export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

/** Sri Lankan NIC — old (9 digits + V/X) or new (12 digits). */
export const NIC_PATTERN = /^(?:\d{9}[VvXx]|\d{12})$/;

/** E.164 phone format (same as user WhatsApp). */
export const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
