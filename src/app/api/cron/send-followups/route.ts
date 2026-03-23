import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";

// Schedule: run daily via GitHub Actions or Vercel cron
// Vercel cron config (vercel.json): { "path": "/api/cron/send-followups", "schedule": "0 9 * * *" }

export async function GET(req: NextRequest) {
  // Guard: only allow requests with the cron secret (or from localhost in dev)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const results = { processed: 0, sent: 0, errors: [] as string[] };

  for (const type of ["6_month", "12_month"] as const) {
    const monthsBack = type === "6_month" ? 6 : 12;

    // Window: ±7 days around the target date
    const targetDate = new Date(now);
    targetDate.setMonth(targetDate.getMonth() - monthsBack);
    const windowStart = new Date(targetDate);
    windowStart.setDate(windowStart.getDate() - 7);
    const windowEnd = new Date(targetDate);
    windowEnd.setDate(windowEnd.getDate() + 7);

    // Find applications selected in this window
    const { data: eligibleApps, error: appsError } = await admin
      .from("opportunity_applications")
      .select("id, artist_id, opportunity_id, selected_at")
      .in("status", ["selected", "approved_pending_assets", "production_ready"])
      .gte("selected_at", windowStart.toISOString())
      .lte("selected_at", windowEnd.toISOString());

    if (appsError) {
      results.errors.push(`Fetch ${type}: ${appsError.message}`);
      continue;
    }

    for (const app of eligibleApps ?? []) {
      results.processed++;

      // Check if this follow-up was already sent
      const { data: existing } = await admin
        .from("artist_followups")
        .select("id")
        .eq("application_id", app.id)
        .eq("followup_type", type)
        .maybeSingle();

      if (existing) continue; // already sent

      // Create the follow-up row
      const { data: followupRow, error: insertError } = await admin
        .from("artist_followups")
        .insert({
          profile_id: app.artist_id,
          opportunity_id: app.opportunity_id,
          application_id: app.id,
          followup_type: type,
          sent_at: now.toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !followupRow) {
        results.errors.push(`Insert ${type} for app ${app.id}: ${insertError?.message}`);
        continue;
      }

      // Fetch artist email and profile details
      const [{ data: authUser }, { data: profile }, { data: opp }] = await Promise.all([
        admin.auth.admin.getUserById(app.artist_id as string),
        admin.from("profiles").select("full_name, username").eq("id", app.artist_id as string).single(),
        admin.from("opportunities").select("title").eq("id", app.opportunity_id as string).single(),
      ]);

      const email = authUser?.user?.email;
      if (!email) continue;

      const artistName = (profile as { full_name?: string | null; username?: string } | null)?.full_name
        ?? (profile as { username?: string } | null)?.username
        ?? "Artist";
      const oppTitle = (opp as { title?: string } | null)?.title ?? "your selected opportunity";
      const monthLabel = type === "12_month" ? "12" : "6";
      const formUrl = `${SITE_URL}/followup/${followupRow.id}`;

      // Send email
      try {
        const resend = new Resend(process.env.RESEND_API_KEY ?? "");
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: `${monthLabel}-month update — ${oppTitle}`,
          html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
  <p>Kia ora ${artistName},</p>
  <p>${monthLabel === "6" ? "Six" : "Twelve"} months ago you were selected for <strong>${oppTitle}</strong>. We&rsquo;d love to hear how things have been going since then.</p>
  <p>We&rsquo;re putting together impact reporting for the programme, and a quick update from you helps us show the real effect this support has on artists&rsquo; careers.</p>
  <p style="margin: 24px 0;">
    <a href="${formUrl}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; display: inline-block;">
      Share your update →
    </a>
  </p>
  <p style="color: #666; font-size: 13px;">This takes about 2 minutes. Your responses are used in anonymised, aggregate reporting only (unless you opt in to sharing a testimonial).</p>
  <p>Ngā mihi,<br>Patronage</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 11px;">You&rsquo;re receiving this because you were selected for a programme managed through Patronage. <a href="${SITE_URL}" style="color: #999;">${SITE_URL}</a></p>
</body>
</html>`,
        });
        results.sent++;
      } catch (err) {
        results.errors.push(`Email ${type} for app ${app.id}: ${String(err)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
