/** Event audience scope labels — mirrors server/utils/eventAudience.js */

export const AUDIENCE_SCOPE_LABELS = {
  campus: "NSBM campus only",
  inter_university: "Inter-university (guest students)",
};

export const isExternalStudent = (user) =>
  user?.role === "student" && user?.studentType === "external";
