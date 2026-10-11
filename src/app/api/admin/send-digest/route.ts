import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sendPartnerDigest, sendWeeklyDigest } from "@/lib/digest-send";

// Resend's per-recipient fallback is paced at ~2 a second, so allow the long run.
export const maxDuration = 300;

type Audience = "a" | "b" | "partner";

function parseAudience(value: string | null): Audience | null {
  return value === "a" || value === "b" || value === "partner" ? value : null;
}

async function run(audience: Audience, manual: boolean) {
  if (audience === "partner") return sendPartnerDigest(manual ? "manual" : "cron-partner");
  return sendWeeklyDigest(manual ? "manual" : audience === "a" ? "cron-a" : "cron-b", { half: audience });
}

// GET — Vercel cron job (Authorization: Bearer <CRON_SECRET>).
// ?half=a|b is one half of the artist list; ?half=partner is the organisations' digest.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new NextResponse("CRON_SECRET not configured", { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const audience = parseAudience(req.nextUrl.searchParams.get("half"));
  if (!audience) {
    return new NextResponse("half must be a, b or partner", { status: 400 });
  }
  return NextResponse.json(await run(audience, false));
}

// POST — manual trigger from admin UI (?audience=a|b|partner)
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const audience = parseAudience(req.nextUrl.searchParams.get("audience"));
  if (!audience) {
    return new NextResponse("audience must be a, b or partner", { status: 400 });
  }
  return NextResponse.json(await run(audience, true));
}
