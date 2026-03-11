import { NextRequest, NextResponse } from "next/server";
import { getLatestUpdates } from "@/lib/feed";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);

  try {
    const updates = await getLatestUpdates(PAGE_SIZE, offset);
    return NextResponse.json(
      { updates, hasMore: updates.length === PAGE_SIZE },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load updates" }, { status: 500 });
  }
}
