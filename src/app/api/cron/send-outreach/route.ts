import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const FROM_OUTREACH = "Patronage <hello@patronage.nz>";

function buildHtmlEmail(body: string): string {
  const htmlBody = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 1em 0;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;font-size:15px">
      ${htmlBody}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:2em 0"/>
      <p style="font-size:12px;color:#888;margin:0">
        Patronage · <a href="mailto:hello@patronage.nz" style="color:#888">hello@patronage.nz</a> · <a href="https://patronage.nz" style="color:#888">patronage.nz</a> · Auckland, New Zealand
      </p>
    </div>
  `;
}

// Vercel cron: runs every 15 minutes
// vercel.json: { "path": "/api/cron/send-outreach", "schedule": "*/15 * * * *" }
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY!);

  // Fetch all scheduled emails due now
  const { data: due, error } = await admin
    .from("outreach_emails")
    .select("id, to_name, to_email, subject, body")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const results = await Promise.all(
    due.map(async (email) => {
      const { error: sendError } = await resend.emails.send({
        from: FROM_OUTREACH,
        to: [`${email.to_name} <${email.to_email}>`],
        replyTo: FROM_OUTREACH,
        subject: email.subject,
        html: buildHtmlEmail(email.body),
      });

      if (sendError) {
        await admin
          .from("outreach_emails")
          .update({ status: "failed" })
          .eq("id", email.id);
        return { id: email.id, ok: false };
      }

      await admin
        .from("outreach_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", email.id);

      return { id: email.id, ok: true };
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ sent, failed });
}
