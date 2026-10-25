"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendGenericEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isSubmittedTooFast } from "@/lib/form-timing";
import { isTorExit, recordBlocked } from "@/lib/bot-guard";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";
import { nzDatePlus } from "@/lib/deadline-reminders";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function remindMeAction(input: {
  opportunityId: string;
  email: string;
  alsoDigest: boolean;
  turnstileToken?: string;
  loadedAt?: number;
  [HONEYPOT_FIELD]?: string;
}): Promise<{ error?: string; deadline?: string; alreadyMember?: boolean }> {
  // Bots that fill every field get a quiet success.
  if (input[HONEYPOT_FIELD] || isSubmittedTooFast(input.loadedAt)) return {};

  const email = input.email?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { error: "Enter a valid email address." };
  }

  const ip = await getClientIp();
  if (await isTorExit(ip)) {
    await recordBlocked("form_blocked", { reason: "tor", form: "remind_me" });
    return {};
  }
  if (!(await checkRateLimit(`remind-me:${ip}`, 6, 3600))) {
    return { error: "Too many requests from this network. Please try again later." };
  }
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return { error: "Verification failed. Please refresh and try again." };
  }

  const admin = createAdminClient();

  const { data: opp } = await admin
    .from("opportunities")
    .select("id, title, slug, deadline, is_active, status")
    .eq("id", input.opportunityId)
    .maybeSingle();

  if (!opp || !opp.is_active || opp.status !== "published" || !opp.deadline) {
    return { error: "This opportunity isn't taking reminders." };
  }
  if (opp.deadline < nzDatePlus(0)) return { error: "This opportunity has already closed." };

  // Someone with an account: save it for them, and the account reminders take over.
  const { data: member } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (member) {
    await admin
      .from("user_saved_opportunities")
      .upsert(
        { user_id: (member as { id: string }).id, opportunity_id: opp.id, status: "saved" },
        { onConflict: "user_id,opportunity_id", ignoreDuplicates: true }
      );
    return { deadline: opp.deadline, alreadyMember: true };
  }

  const { data: reminder, error } = await admin
    .from("email_reminders")
    .upsert({ email, opportunity_id: opp.id }, { onConflict: "email,opportunity_id" })
    .select("unsubscribe_token")
    .single();
  if (error || !reminder) return { error: "Something went wrong. Please try again." };

  // The weekly digest, only if they asked for it. Duplicate = already on the list.
  let digestToken: string | null = null;
  if (input.alsoDigest) {
    const { data: sub } = await admin
      .from("subscribers")
      .upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
      .select("unsubscribe_token")
      .maybeSingle();
    digestToken = (sub as { unsubscribe_token?: string } | null)?.unsubscribe_token ?? null;
    if (!digestToken) {
      const { data: existing } = await admin
        .from("subscribers")
        .select("unsubscribe_token")
        .eq("email", email)
        .maybeSingle();
      digestToken = (existing as { unsubscribe_token?: string } | null)?.unsubscribe_token ?? null;
    }
  }

  const closes = new Date(`${opp.deadline}T00:00:00Z`).toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const url = `${SITE_URL}/opportunities/${opp.slug ?? opp.id}?utm_source=reminder&utm_medium=email&utm_campaign=confirmation`;
  const stopReminders = `${SITE_URL}/unsubscribe?token=${reminder.unsubscribe_token}&list=reminders`;
  const stopDigest = digestToken ? `${SITE_URL}/unsubscribe?token=${digestToken}` : null;

  // Best-effort: the reminder is saved either way.
  sendGenericEmail({
    to: email,
    subject: `Reminder set: ${opp.title}`,
    html: `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#fff;color:#000;max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px;">Patronage</h1>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">You're set. <a href="${url}" style="color:#000;">${esc(opp.title)}</a> closes on <strong>${esc(closes)}</strong>, and we'll email you a week before and again two days before.</p>
  ${stopDigest ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">You also asked for Patronage Weekly: the best new grants, residencies and open calls for New Zealand and Australian artists, once a week.</p>` : ""}
  <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5;">
    Wrong address? <a href="${stopReminders}" style="color:#888;">Cancel these reminders</a>${stopDigest ? ` · <a href="${stopDigest}" style="color:#888;">Stop the weekly digest</a>` : ""}.
  </p>
</body></html>`,
  }).catch(console.error);

  return { deadline: opp.deadline };
}
