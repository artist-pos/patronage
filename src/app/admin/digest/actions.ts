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

  const subject = `Patronage — opportunities digest ${new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}`;
  const resend = new Resend(apiKey);

  const emails = subs.map((s) => ({
    from,
    to: s.email,
    subject,
    html: buildDigestHtml(digestData, siteUrl, s.email),
  }));

  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    const { data, error: batchError } = await resend.batch.send(batch);
    if (!batchError && data) sent += batch.length;
  }

  if (sent === 0) return { ok: false, sent: 0, message: "Failed to send." };
  return { ok: true, sent, message: `Sent to ${sent} subscriber${sent !== 1 ? "s" : ""}.` };
}
