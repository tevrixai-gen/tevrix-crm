// Working-hours guard — campaigns may only dial inside the tenant's calling
// window (NDNC guideline default 10:00–19:00 IST). All checks are done in the
// tenant's timezone, never the server's.

export interface CallingWindow {
  start: string; // "10:00"
  end: string;   // "19:00"
  timezone: string; // IANA, e.g. "Asia/Kolkata"
}

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Current minutes-since-midnight in the given IANA timezone. */
export function minutesNowInZone(timezone: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function isWithinCallingWindow(window: CallingWindow, now: Date = new Date()): boolean {
  const start = parseHHMM(window.start);
  const end = parseHHMM(window.end);
  if (start === null || end === null) return false;

  const current = minutesNowInZone(window.timezone, now);

  if (start === end) return false; // zero-width window: never callable
  if (start < end) {
    return current >= start && current < end;
  }
  // Midnight-crossing window (e.g. 22:00–06:00)
  return current >= start || current < end;
}

/** Validation used by campaign builder: window must parse and be non-zero width. */
export function validateCallingWindow(start: string, end: string): string | null {
  if (parseHHMM(start) === null) return "Invalid start time";
  if (parseHHMM(end) === null) return "Invalid end time";
  if (start === end) return "Start and end cannot be the same";
  return null;
}
