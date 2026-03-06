import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { getDigestData, buildDigestHtml } from "@/lib/digest";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

async function sendDigest(): Promise<{ sent: number; errors: number }> {
  const admin = createAdminClient();

  const { data: subscribers, error } = await admin
    .from("subscribers")
    .select("email");

  if (error || !subscribers?.length) {
    return { sent: 0, errors: 0 };
  }

  const data = await getDigestData();
  if (data.newOpps.length === 0 && data.closingSoon.length === 0) {
    return { sent: 0, errors: 0 };
  }

  let sent = 0;
  let errors = 0;

  // Resend supports batch sending up to 100 emails; send in chunks
  const emails = subscribers.map((s) => ({
    from: FROM,
    to: s.email,
    subject: "Patronage — weekly opportunities digest",
    html: buildDigestHtml(data, SITE_URL, s.email),
  }));

  const resend = getResend();
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    const { data: results, error: batchError } = await resend.batch.send(batch);
    if (batchError || !results) {
      errors += batch.length;
    } else {
      sent += batch.length;
    }
  }

  return { sent, errors };
}

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

  const result = await sendDigest();
  return NextResponse.json(result);
}

// POST — manual trigger from admin UI
export async function POST() {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const result = await sendDigest();
  return NextResponse.json(result);
}
