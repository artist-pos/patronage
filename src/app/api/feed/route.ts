import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestUpdates } from "@/lib/feed";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const audience = searchParams.get("audience") ?? "everyone";

  try {
    let artistIds: string[] | undefined;

    if (audience === "subscribed") {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: subs } = await supabase
          .from("support_subscriptions")
          .select("recipient_id")
          .eq("supporter_id", user.id)
          .in("status", ["active", "one_off_paid"]);
        artistIds = (subs ?? []).map((s: { recipient_id: string }) => s.recipient_id).filter(Boolean);
      } else {
        artistIds = [];
      }
    }

    if (audience === "following") {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        artistIds = (follows ?? []).map((f: { following_id: string }) => f.following_id).filter(Boolean);
      } else {
        artistIds = [];
      }
    }

    const updates = await getLatestUpdates(PAGE_SIZE, offset, artistIds);
    return NextResponse.json(
      { updates, hasMore: updates.length === PAGE_SIZE },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load updates" }, { status: 500 });
  }
}
