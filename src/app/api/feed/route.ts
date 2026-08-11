import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getLatestUpdates } from "@/lib/feed";

// Larger than the page's INITIAL_COUNT of 10. The first ten are what the user
// waits on, so keep those tight; every page after that is fetched ahead of the
// scroll, where the ~250ms round-trip matters more than the payload (a page of
// 20 is ~28KB). Halving the number of round-trips halves the chances of
// stalling at the bottom of the feed.
const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const audience = searchParams.get("audience") ?? "everyone";

  try {
    // Auth is now needed for every audience, not just following/subscribed: the
    // admin_hidden filter (migration 177) applies to signed-out viewers only, so
    // page 2+ of the public feed must be filtered the same way page 1 was.
    const { supabase, user } = await getServerUser();
    let artistIds: string[] | undefined;

    if (audience === "subscribed") {
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

    const updates = await getLatestUpdates(PAGE_SIZE, offset, artistIds, !!user);
    return NextResponse.json(
      { updates, hasMore: updates.length === PAGE_SIZE },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load updates" }, { status: 500 });
  }
}
