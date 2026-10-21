// All dates are stored in UTC and shown in Pacific/Auckland.
const TZ = "Pacific/Auckland";

/** Offset of Pacific/Auckland from UTC, in ms, at the given instant. */
function nzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-10-30T17:00" (a wall-clock time in Auckland) to a UTC ISO string. */
export function nzLocalToUtcIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settles the offset across a DST boundary.
  let guess = wall - nzOffsetMs(new Date(wall));
  guess = wall - nzOffsetMs(new Date(guess));
  const d = new Date(guess);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A UTC instant to the "YYYY-MM-DDTHH:mm" value a datetime-local input expects, in Auckland. */
export function utcToNzLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + nzOffsetMs(d)).toISOString().slice(0, 16);
}

export function formatNz(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "not set";
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  }).format(new Date(iso));
}

export function formatNzDate(iso: string | null): string {
  // en-NZ puts a comma after the weekday; "Friday 30 October" reads better.
  return formatNz(iso, { hour: undefined, minute: undefined }).replace(",", "");
}

export type Window = "before" | "open" | "closed";

export function windowState(openAt: string | null, closeAt: string | null, now = new Date()): Window {
  if (openAt && now < new Date(openAt)) return "before";
  if (closeAt && now >= new Date(closeAt)) return "closed";
  return "open";
}
