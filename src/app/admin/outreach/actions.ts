"use server";

import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM_OUTREACH = "Patronage <hello@patronage.nz>";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function buildHtmlEmail(body: string): string {
  const htmlBody = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 1.4em 0;font-size:15px;line-height:1.75;color:#1a1a1a">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:48px 24px 64px;">
    <tr><td>
      <div style="font-family:system-ui,sans-serif;">
        ${htmlBody}
      </div>
      <div style="border-top:1px solid #e8e8e8;margin-top:40px;padding-top:20px;">
        <p style="margin:0;font-family:system-ui,sans-serif;font-size:11px;color:#aaa;">
          Patronage &middot; <a href="mailto:hello@patronage.nz" style="color:#aaa;text-decoration:none;">hello@patronage.nz</a> &middot; <a href="https://patronage.nz" style="color:#aaa;text-decoration:none;">patronage.nz</a> &middot; Auckland, New Zealand
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

// NZ-local datetime string → UTC ISO string (same logic as blog scheduler)
function nzLocalToUtc(localStr: string): string {
  const candidate = new Date(`${localStr}:00+12:00`);
  const check = candidate.toLocaleString("sv", { timeZone: "Pacific/Auckland" });
  const expected = localStr.replace("T", " ");
  if (check.startsWith(expected)) return candidate.toISOString();
  return new Date(`${localStr}:00+13:00`).toISOString();
}

export async function sendOutreachEmail(data: {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt?: string; // NZ local datetime string "YYYY-MM-DDTHH:mm"
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { toName, toEmail, subject, body, scheduledAt } = data;
  if (!toName.trim() || !toEmail.trim() || !subject.trim() || !body.trim()) {
    return { error: "All fields are required." };
  }

  const admin = createAdminClient();

  // Schedule for later — just persist, don't send now
  if (scheduledAt) {
    const scheduledUtc = nzLocalToUtc(scheduledAt);
    const { error: scheduleError } = await admin.from("outreach_emails").insert({
      sent_by: user.id,
      to_name: toName.trim(),
      to_email: toEmail.trim(),
      subject: subject.trim(),
      body: body.trim(),
      status: "scheduled",
      scheduled_at: scheduledUtc,
      sent_at: null,
    });
    if (scheduleError) {
      console.error("outreach schedule error:", scheduleError.message);
      return { error: scheduleError.message };
    }
    revalidatePath("/admin/outreach");
    return {};
  }

  // Send immediately
  const resend = getResend();
  const { error: sendError } = await resend.emails.send({
    from: FROM_OUTREACH,
    to: [`${toName} <${toEmail}>`],
    replyTo: FROM_OUTREACH,
    subject,
    html: buildHtmlEmail(body),
  });

  if (sendError) return { error: sendError.message };

  const { error: insertError } = await admin.from("outreach_emails").insert({
    sent_by: user.id,
    to_name: toName.trim(),
    to_email: toEmail.trim(),
    subject: subject.trim(),
    body: body.trim(),
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  if (insertError) console.error("outreach insert error:", insertError.message);

  revalidatePath("/admin/outreach");
  return {};
}

export async function getOutreachHistory() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("outreach_emails")
    .select("id, to_name, to_email, subject, body, status, sent_at, scheduled_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function cancelScheduledEmail(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("outreach_emails")
    .delete()
    .eq("id", id)
    .eq("status", "scheduled");

  if (error) return { error: error.message };
  revalidatePath("/admin/outreach");
  return {};
}
