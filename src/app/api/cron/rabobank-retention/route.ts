import { NextRequest, NextResponse } from "next/server";
import { runRetention } from "@/lib/rabobank/retention";

/**
 * Daily: the Rabobank profile retention schedule, anchored to selection close.
 * Day 0 keep-or-delete email, day 21 one reminder, day 30 deletion of anything
 * not kept. Each step runs once, so repeat runs are harmless.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const report = await runRetention();
  return NextResponse.json(report);
}
