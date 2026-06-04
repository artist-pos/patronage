"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function submitCustomCampaignEnquiry(data: {
  message: string;
}): Promise<{ error?: string }> {
  if (!data.message.trim()) {
    return { error: "Please describe what you're planning." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single();

  // Get email from auth.users via admin client
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const email = authUser?.user?.email ?? user.email ?? "unknown";
  const name = profile?.full_name ?? profile?.username ?? email;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    await getResend().emails.send({
      from: "Patronage <noreply@patronage.nz>",
      to: "hello@patronage.nz",
      replyTo: email,
      subject: `Campaign enquiry from ${name}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <p style="color:#888;font-size:13px;margin:0 0 24px;">Patronage · Custom Campaign Enquiry</p>
      <p style="margin:0 0 8px;font-size:15px;"><strong>${esc(name)}</strong> &lt;${esc(email)}&gt; is enquiring about a custom or live experience campaign:</p>
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
