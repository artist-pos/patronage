/**
 * Event dates on studio updates (227) are NZ local calendar dates with an
 * optional local time, stored without a zone. Everything here reads them as
 * Pacific/Auckland so "today" and "past" match what the artist meant.
 */

/** Today's date in NZ, as YYYY-MM-DD. */
export function nzToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

/** A YYYY-MM-DD date as a Date at local midnight, for display only. */
function asLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "5.30pm" from "17:30:00". */
export function formatEventTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `.${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export function eventDateParts(date: string) {
  const d = asLocalDate(date);
  return {
    month: d.toLocaleDateString("en-NZ", { month: "short" }).replace(".", "").slice(0, 3).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString("en-NZ", { weekday: "short" }).replace(".", ""),
    long: d.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" }),
    year: d.getFullYear(),
  };
}

/** True once the event's day is over in NZ. */
export function isEventPast(date: string | null | undefined): boolean {
  return !!date && date < nzToday();
}

/** "Fri 21 Nov · 5.30pm" for one-line use. */
export function eventLine(date: string, time: string | null | undefined): string {
  const p = eventDateParts(date);
  const t = formatEventTime(time);
  return `${p.weekday} ${p.day} ${p.month.charAt(0)}${p.month.slice(1).toLowerCase()}${t ? ` · ${t}` : ""}`;
}
