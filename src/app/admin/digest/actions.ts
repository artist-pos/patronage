"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getDigestData, buildDigestHtml } from "@/lib/digest";
import { Resend } from "resend";

export async function sendDigestAction(): Promise<{
  ok: boolean;
  sent: number;
  message: string;
}> {
  if (!(await isAdmin())) return { ok: false, sent: 0, message: "Not authorised." };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

  if (!apiKey || !from) {
    return {
      ok: false,
      sent: 0,
      message: "RESEND_API_KEY or RESEND_FROM not configured.",
    };
  }

  const supabase = await createClient();
  const { data: subs, error } = await supabase
    .from("subscribers")
    .select("email");

  if (error) return { ok: false, sent: 0, message: error.message };
  if (!subs || subs.length === 0)
    return { ok: false, sent: 0, message: "No subscribers." };

  const digestData = await getDigestData();

  if (digestData.newOpps.length === 0 && digestData.closingSoon.length === 0) {
    return { ok: false, sent: 0, message: "Nothing to send — digest is empty." };
  }

  const html = buildDigestHtml(digestData, siteUrl);
  const resend = new Resend(apiKey);

  const { error: sendError } = await resend.emails.send({
    from,
    to: subs.map((s) => s.email),
    subject: `Patronage — opportunities digest ${new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}`,
    html,
  });

  if (sendError) return { ok: false, sent: 0, message: sendError.message };
  return { ok: true, sent: subs.length, message: `Sent to ${subs.length} subscriber${subs.length !== 1 ? "s" : ""}.` };
}
