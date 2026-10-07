/** Extract UUID check-in token from a QR scan (URL or bare token). */
export const parseCheckInToken = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.trim().match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return match ? match[0].toLowerCase() : null;
};

/** Attendance summary for a registration row. */
export const getRegAttendance = (reg) => {
  if (reg.status !== "confirmed") {
    return { checkedIn: 0, total: 0, label: "—", complete: false };
  }

  if (reg.team?.members?.length) {
    const total = reg.team.members.length;
    const checkedIn = reg.team.members.filter((m) => m.checkedInAt).length;
    return {
      checkedIn,
      total,
      label: `${checkedIn}/${total}`,
      complete: checkedIn === total,
    };
  }

  return {
    checkedIn: reg.checkedInAt ? 1 : 0,
    total: 1,
    label: reg.checkedInAt ? "Present" : "Absent",
    complete: Boolean(reg.checkedInAt),
  };
};

/** Total attendance across all confirmed registrations for an event. */
export const countEventAttendance = (regs) => {
  let checkedIn = 0;
  let total = 0;

  for (const reg of regs) {
    if (reg.status !== "confirmed") continue;
    const att = getRegAttendance(reg);
    checkedIn += att.checkedIn;
    total += att.total;
  }

  return { checkedIn, total };
};

/** Build a sorted list of saved check-ins from registration documents (admin). */
export const collectCheckInsFromRegistrations = (regs, eventTitle = "") => {
  const items = [];

  for (const reg of regs ?? []) {
    if (reg.status !== "confirmed") continue;

    if (reg.team?.members?.length) {
      for (const m of reg.team.members) {
        if (!m.checkedInAt) continue;
        items.push({
          id: `${reg._id}-${m.role}`,
          name: m.fullName,
          event: eventTitle || reg.event?.title || "Event",
          teamName: reg.team.name,
          time: new Date(m.checkedInAt),
        });
      }
      continue;
    }

    if (reg.checkedInAt) {
      items.push({
        id: String(reg._id),
        name: reg.studentSnapshot?.fullName ?? reg.student?.fullName ?? "Attendee",
        event: eventTitle || reg.event?.title || "Event",
        time: new Date(reg.checkedInAt),
      });
    }
  }

  return items.sort((a, b) => b.time - a.time);
};

/**
 * All confirmed attendees for an event (present + absent) — for admin attendance roster.
 */
export const collectEventAttendees = (regs, eventTitle = "") => {
  const items = [];

  for (const reg of regs ?? []) {
    if (reg.status !== "confirmed") continue;

    const eventLabel =
      eventTitle || reg.event?.title || reg.eventSnapshot?.title || "Event";

    if (reg.team?.members?.length) {
      for (const m of reg.team.members) {
        items.push({
          id: `${reg._id}-${m.role}`,
          name: m.fullName,
          teamName: reg.team.name,
          event: eventLabel,
          checkedInAt: m.checkedInAt ? new Date(m.checkedInAt) : null,
          present: Boolean(m.checkedInAt),
        });
      }
      continue;
    }

    items.push({
      id: String(reg._id),
      name: reg.studentSnapshot?.fullName ?? reg.student?.fullName ?? "Attendee",
      event: eventLabel,
      checkedInAt: reg.checkedInAt ? new Date(reg.checkedInAt) : null,
      present: Boolean(reg.checkedInAt),
    });
  }

  return items.sort((a, b) => {
    if (a.present !== b.present) return a.present ? -1 : 1;
    if (a.present && b.present) return b.checkedInAt - a.checkedInAt;
    return a.name.localeCompare(b.name);
  });
};
