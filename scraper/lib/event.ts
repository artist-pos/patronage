/**
 * Keep an extracted event only if it is believable: a real future date (NZ time,
 * within two years), not the same day as the deadline or open date (the usual way
 * the model mixes them up), and tidy time/venue/label. Anything else becomes all
 * nulls, so a bad guess never reaches Explore > Events. Pure.
 */
export function cleanEvent(
    o: { event_date?: unknown; event_time?: unknown; event_venue?: unknown; event_label?: unknown; deadline?: string | null; opens_at?: string | null },
    now: Date = new Date(),
): { event_date: string | null; event_time: string | null; event_venue: string | null; event_label: string | null } {
    const none = { event_date: null, event_time: null, event_venue: null, event_label: null };
    const date = typeof o.event_date === "string" ? o.event_date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return none;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return none;

    const today = now.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
    const limit = new Date(now.getTime() + 730 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
    if (date < today || date > limit) return none;
    if (date === o.deadline || date === o.opens_at) return none;

    const t = typeof o.event_time === "string" ? o.event_time.trim().match(/^(\d{1,2}):(\d{2})/) : null;
    const time = t && +t[1] < 24 && +t[2] < 60 ? `${t[1].padStart(2, "0")}:${t[2]}` : null;
    const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
    return { event_date: date, event_time: time, event_venue: clip(o.event_venue, 200), event_label: clip(o.event_label, 60) };
}
