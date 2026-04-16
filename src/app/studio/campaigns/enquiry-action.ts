"use server";

import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function submitCustomCampaignEnquiry(data: {
  name: string;
  email: string;
  message: string;
}): Promise<{ error?: string }> {
  if (!data.name.trim() || !data.email.trim() || !data.message.trim()) {
    return { error: "All fields are required." };
  }

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    await getResend().emails.send({
      from: "Patronage <noreply@patronage.nz>",
      to: "hello@patronage.nz",
      replyTo: data.email,
      subject: `Campaign enquiry from ${data.name}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <p style="color:#888;font-size:13px;margin:0 0 24px;">Patronage · Custom Campaign Enquiry</p>
      <p style="margin:0 0 8px;font-size:15px;"><strong>${esc(data.name)}</strong> &lt;${esc(data.email)}&gt; is enquiring about a custom or live experience campaign:</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #000;background:#f9f9f9;font-size:14px;color:#333;white-space:pre-wrap;">${esc(data.message)}</blockquote>
      <p style="color:#888;font-size:12px;margin:32px 0 0;">Reply directly to this email to respond.</p>
    </td></tr>
  </table>
</body>
</html>`,
    });
    return {};
  } catch (err) {
    return { error: String(err) };
  }
}
