/** Nav paths hidden from guest / external-university students. */

export const GUEST_HIDDEN_PATHS = new Set(["/channels", "/community"]);

export const filterNavForGuest = (items, isGuest) =>
  isGuest ? items.filter(({ href }) => !GUEST_HIDDEN_PATHS.has(href)) : items;
