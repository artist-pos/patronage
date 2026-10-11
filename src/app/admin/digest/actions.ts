"use server";

import { isAdmin } from "@/lib/admin";
import { sendPartnerDigest, sendWeeklyDigest } from "@/lib/digest-send";

export type DigestAudience = "a" | "b" | "partner";

export async function sendDigestAction(audience: DigestAudience): Promise<{
  ok: boolean;
  sent: number;
  message: string;
}> {
  if (!(await isAdmin())) return { ok: false, sent: 0, message: "Not authorised." };

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    return {
      ok: false,
      sent: 0,
      message: "RESEND_API_KEY or RESEND_FROM not configured.",
    };
  }

  const { sent, skipped, errors, deferred, queryError } =
    audience === "partner"
      ? await sendPartnerDigest("manual")
      : await sendWeeklyDigest("manual", { half: audience });

  if (queryError) {
    return { ok: false, sent: 0, message: `Query failed: ${queryError}` };
  }

  if (sent === 0) {
    // Skipped is not a failure. It means everyone on the list has already been
    // shown all but a couple of the live listings, which is the suppression
    // rule working rather than something to retry.
    if (skipped > 0) {
      return {
        ok: false,
        sent: 0,
        message: `Nothing sent. ${skipped} recipient${skipped !== 1 ? "s" : ""} had fewer than three listings they had not already seen.`,
      };
    }
    return { ok: false, sent: 0, message: "Nothing to send." };
  }

  const parts = [`Sent to ${sent} recipient${sent !== 1 ? "s" : ""}.`];
  if (skipped > 0) parts.push(`${skipped} skipped as too thin.`);
  if (errors > 0) parts.push(`${errors} failed.`);
  if (deferred) parts.push(`${deferred} held back by the daily email limit; send this audience again tomorrow.`);

  return { ok: true, sent, message: parts.join(" ") };
}
