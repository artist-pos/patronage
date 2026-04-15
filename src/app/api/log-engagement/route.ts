import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = new Set([
  "view", "play", "enquiry", "share",
  "scan", "commerce_click", "email_capture",
  "follow_click", "profile_click", "work_click",
]);

export async function POST(request: NextRequest) {
  try {
    const { work_id, event_type, campaign_id } = await request.json();

    if (!event_type) {
      return NextResponse.json({ error: "Missing event_type" }, { status: 400 });
    }

    if (!VALID_TYPES.has(event_type)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }

    const supabase = await createClient();
    await supabase.from("engagement_logs").insert({
      work_id: work_id ?? null,
      event_type,
      campaign_id: campaign_id ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Fire-and-forget — always return 200 so client doesn't retry
    return NextResponse.json({ ok: true });
  }
}
