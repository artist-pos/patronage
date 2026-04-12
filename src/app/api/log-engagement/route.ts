import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { work_id, event_type } = await request.json();

    if (!work_id || !event_type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const validTypes = ["view", "play", "enquiry", "share"];
    if (!validTypes.includes(event_type)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }

    const supabase = await createClient();
    await supabase.from("engagement_logs").insert({ work_id, event_type });

    return NextResponse.json({ ok: true });
  } catch {
    // Fire-and-forget — always return 200 so client doesn't retry
    return NextResponse.json({ ok: true });
  }
}
