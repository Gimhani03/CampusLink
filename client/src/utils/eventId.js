/** Normalize MongoDB / API event ids for Select value matching. */
export const eventKey = (id) => (id == null || id === "" ? "" : String(id));
