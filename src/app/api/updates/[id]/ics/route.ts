import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/** Escapes text for an iCalendar property value. */
function ics(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * "Add to calendar" for an event on a studio update (227): a one-event .ics
 * file in NZ time. Two hours long when only a start time is known; all day
 * when there's no time. Private to the person downloading it; nothing is counted.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = createPublicClient();
  const { data: u } = await supabase
    .from("project_updates")
    .select("id, title, caption, text_content, event_date, event_time, event_venue, profiles!project_updates_artist_id_fkey (full_name, username)")
    .eq("id", id)
    .maybeSingle();
  if (!u?.event_date) return new NextResponse("Not found", { status: 404 });

  const artist = u.profiles as unknown as { full_name: string | null; username: string } | null;
  const name = artist?.full_name ?? artist?.username ?? "An artist";
  const summary = (u.title ?? u.caption ?? u.text_content ?? "Event").split("\n")[0].slice(0, 120);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const date = u.event_date.replace(/-/g, "");

  let when: string[];
  if (u.event_time) {
    const [h, m] = u.event_time.split(":").map(Number);
    const start = `${date}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    const end = h + 2 > 23
      ? `${date}T235900`
      : `${date}T${String(h + 2).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    when = [`DTSTART;TZID=Pacific/Auckland:${start}`, `DTEND;TZID=Pacific/Auckland:${end}`];
  } else {
    const [y, mo, d] = u.event_date.split("-").map(Number);
    const next = new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
    when = [`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${next}`];
  }

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Patronage//Studio events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${u.id}@patronage.nz`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`,
    ...when,
    `SUMMARY:${ics(`${summary} · ${name}`)}`,
    u.event_venue ? `LOCATION:${ics(u.event_venue)}` : null,
    `URL:${site}/projects/${u.id}`,
    `DESCRIPTION:${ics(`${name} on Patronage: ${site}/projects/${u.id}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="patronage-event.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
