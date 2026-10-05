/** Team registration constants — mirrors server/utils/teamRegistration.js */

export const TEAM_SIZES = [2, 3, 4, 5];

export const ABSOLUTE_MIN_TEAM_SIZE = 2;
export const ABSOLUTE_MAX_TEAM_SIZE = 5;
export const DEFAULT_MIN_TEAM_SIZE = 2;
export const DEFAULT_MAX_TEAM_SIZE = 4;

export const getTeamSizeBounds = (event) => {
  const rawMin = event?.minTeamSize ?? DEFAULT_MIN_TEAM_SIZE;
  const rawMax = event?.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE;
  let min = Math.min(Math.max(rawMin, ABSOLUTE_MIN_TEAM_SIZE), ABSOLUTE_MAX_TEAM_SIZE);
  let max = Math.min(Math.max(rawMax, ABSOLUTE_MIN_TEAM_SIZE), ABSOLUTE_MAX_TEAM_SIZE);
  if (min > max) [min, max] = [max, min];
  return { min, max };
};

export const getAllowedTeamSizes = (event) => {
  const { min, max } = getTeamSizeBounds(event);
  return TEAM_SIZES.filter((n) => n >= min && n <= max);
};

export const getDefaultTeamSize = (event) => {
  const allowed = getAllowedTeamSizes(event);
  const preferred = event?.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE;
  if (allowed.includes(preferred)) return preferred;
  return allowed[allowed.length - 1] ?? DEFAULT_MAX_TEAM_SIZE;
};

export const ROLE_LABELS = {
  leader:   "Team Leader",
  member_1: "Member 1",
  member_2: "Member 2",
  member_3: "Member 3",
  member_4: "Member 4",
};

export const getRolesForSize = (size) => {
  const roles = ["leader"];
  for (let i = 1; i < size; i++) roles.push(`member_${i}`);
  return roles;
};

export const isExternalStudent = (student) => student?.studentType === "external";

/** Human-readable labels for all member slots up to size 5. */
export const POSITION_OPTIONS = Object.values(ROLE_LABELS);

/**
 * Registration questions that duplicate built-in team registration fields.
 * Team mode collects team name, university, and positions (Team Leader, Member 1…)
 * automatically — these custom questions must not be added separately.
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

export const emptyMember = () => ({
  studentId: "",
  lookupEmail: "",
  fullName: "",
  phone: "",
  personalEmail: "",
  nic: "",
  lookupStatus: "idle", // idle | loading | found | not_found | manual
  universityEmail: "",
});

export const buildMembersState = (size, registrantRole, student, prev = {}) => {
  const isExternal = isExternalStudent(student);
  const myStudentId = student?.studentId?.trim().toUpperCase() ?? "";
  const myEmail = student?.email?.trim().toLowerCase() ?? "";

  const isStaleSelfSlot = (role, member) => {
    if (role === registrantRole) return false;
    if (isExternal) {
      const email = (member?.lookupEmail || member?.personalEmail)?.trim().toLowerCase();
      return myEmail && email === myEmail;
    }
    if (!myStudentId || !member?.studentId) return false;
    return member.studentId.trim().toUpperCase() === myStudentId;
  };

  const members = {};
  for (const role of getRolesForSize(size)) {
    if (role === registrantRole && student) {
      if (isExternal) {
        members[role] = {
          studentId: "",
          lookupEmail: student.email ?? "",
          fullName: student.fullName ?? "",
          phone: student.whatsappNumber ?? "",
          personalEmail: student.email ?? "",
          nic: "",
          lookupStatus: "found",
          universityEmail: "",
        };
      } else {
        members[role] = {
          studentId: student.studentId ?? "",
          lookupEmail: "",
          fullName: student.fullName ?? "",
          phone: student.whatsappNumber ?? "",
          personalEmail: student.email ?? "",
          nic: "",
          lookupStatus: "found",
          universityEmail: student.email ?? "",
        };
      }
    } else if (prev[role] && !isStaleSelfSlot(role, prev[role])) {
      members[role] = prev[role];
    } else {
      members[role] = emptyMember();
    }
  }
  return members;
};
