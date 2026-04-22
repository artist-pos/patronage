"use server";

import { Resend } from "resend";
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
    .map((p) => `<p style="margin:0 0 1em 0;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;font-size:15px">
      ${htmlBody}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:2em 0"/>
      <p style="font-size:12px;color:#888;margin:0">
        Patronage · <a href="https://patronage.nz" style="color:#888">patronage.nz</a>
      </p>
    </div>
  `;
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
    await admin.from("outreach_emails").insert({
      sent_by: user.id,
      to_name: toName.trim(),
      to_email: toEmail.trim(),
      subject: subject.trim(),
      body: body.trim(),
      status: "scheduled",
      scheduled_at: scheduledUtc,
      sent_at: null,
    });
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

  await admin.from("outreach_emails").insert({
    sent_by: user.id,
    to_name: toName.trim(),
    to_email: toEmail.trim(),
    subject: subject.trim(),
    body: body.trim(),
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  return {};
}

export async function getOutreachHistory() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("outreach_emails")
    .select("id, to_name, to_email, subject, status, sent_at, scheduled_at")
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

  return error ? { error: error.message } : {};
}
