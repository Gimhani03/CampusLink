/** Event audience scope — who can browse and register. */

export const AUDIENCE_SCOPES = ["campus", "inter_university"];

export const AUDIENCE_SCOPE_LABELS = {
  campus: "NSBM campus only",
  inter_university: "Inter-university (guest students)",
};

export const isExternalStudent = (user) =>
  user?.role === "student" && user?.studentType === "external";

/**
 * Restricts event list filters for external/guest students.
 * NSBM students, anonymous visitors, and admins are unchanged.
 */
export const applyAudienceScopeToFilter = (filter, user, isAdmin = false) => {
  if (isAdmin || !isExternalStudent(user)) return filter;
  return { ...filter, audienceScope: "inter_university" };
};

/** Whether a user may view a published event detail. */
export const canUserViewEvent = (event, user, isAdmin = false) => {
  if (!event) return false;
  if (isAdmin) return true;
  if (event.status !== "published") return false;
  if (isExternalStudent(user) && event.audienceScope !== "inter_university") return false;
  return true;
};

/** Whether a student may register for an event. */
export const canUserRegisterForEvent = (event, user) => {
  if (!event || event.status !== "published") return false;
  if (isExternalStudent(user) && event.audienceScope !== "inter_university") return false;
  return true;
};

export const audienceScopeDeniedMessage =
  "This event is for NSBM campus students only.";
