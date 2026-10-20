import { NextResponse } from "next/server";
import Papa from "papaparse";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient()
    .from("rabobank_event_log")
    .select("*")
    .order("occurred_on", { ascending: true });
  const csv = Papa.unparse(
    (data ?? []).map((r) => ({
      date: r.occurred_on,
      stage: r.stage,
      minutes: r.minutes,
      hours: (r.minutes / 60).toFixed(2),
      note: r.note ?? "",
      logged_at: r.created_at,
    }))
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rabobank-event-log.csv"',
      "Cache-Control": "no-store",
    },
  });
}
