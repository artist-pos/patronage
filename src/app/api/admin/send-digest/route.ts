import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sendWeeklyDigest } from "@/lib/digest-send";

// GET — Vercel cron job (Authorization: Bearer <CRON_SECRET>)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new NextResponse("CRON_SECRET not configured", { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.json(await sendWeeklyDigest("cron"));
}

// POST — manual trigger from admin UI
export async function POST() {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.json(await sendWeeklyDigest("manual"));
}
