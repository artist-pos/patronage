import { NextRequest, NextResponse } from "next/server";
import { runActivationNudges } from "@/lib/activation-nudges";

// Daily via vercel.json. `?dry=1` lists who would be emailed without sending.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const result = await runActivationNudges({ dryRun });
  return NextResponse.json(result);
}
