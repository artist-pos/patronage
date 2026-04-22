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

export async function sendOutreachEmail(data: {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { toName, toEmail, subject, body } = data;
  if (!toName.trim() || !toEmail.trim() || !subject.trim() || !body.trim()) {
    return { error: "All fields are required." };
  }

  const resend = getResend();

  // Convert plain-text line breaks to HTML paragraphs
  const htmlBody = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 1em 0;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;font-size:15px">
      ${htmlBody}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:2em 0"/>
      <p style="font-size:12px;color:#888;margin:0">
        Patronage · <a href="https://patronage.nz" style="color:#888">patronage.nz</a>
      </p>
    </div>
  `;

  const { error: sendError } = await resend.emails.send({
    from: FROM_OUTREACH,
    to: [`${toName} <${toEmail}>`],
    replyTo: FROM_OUTREACH,
    subject,
    html,
  });

  if (sendError) return { error: sendError.message };

  // Log to DB
  const admin = createAdminClient();
  await admin.from("outreach_emails").insert({
    sent_by: user.id,
    to_name: toName.trim(),
    to_email: toEmail.trim(),
    subject: subject.trim(),
    body: body.trim(),
  });

  return {};
}

export async function getOutreachHistory() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("outreach_emails")
    .select("id, to_name, to_email, subject, sent_at")
    .order("sent_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
