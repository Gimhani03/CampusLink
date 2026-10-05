/** NSBM Green University — student account email domain. */
export const NSBM_STUDENT_EMAIL_DOMAIN = "students.nsbm.ac.lk";

export const NSBM_STUDENT_EMAIL_SUFFIX = `@${NSBM_STUDENT_EMAIL_DOMAIN}`;

export const isNsbmStudentEmail = (email) => {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  return normalized.endsWith(NSBM_STUDENT_EMAIL_SUFFIX);
};
