/** Display name in emails, passes, and server logs. Override with PLATFORM_NAME in .env */
export const PLATFORM_NAME = process.env.PLATFORM_NAME?.trim() || "CampusLink";

export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL?.trim() || "admin@campuslink.lk";

export const ADMIN_DEFAULT_PASSWORD =
  process.env.ADMIN_PASSWORD || "Admin@campuslink1";
