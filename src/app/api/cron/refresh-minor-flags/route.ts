import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Re-derives profiles.is_minor from year_of_birth (migration 202). The rule
// depends on the calendar year, so it has to run even when nobody edits a
// profile: someone unconfirmed in their 18th year becomes an adult the next.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refresh_minor_flags");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ changed: data });
}
