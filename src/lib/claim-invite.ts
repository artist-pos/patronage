import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export const CLAIM_FROM = "Blake Aitken <blake@patronage.nz>";

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

/** Where an organiser goes to say "don't email me again". Keyed by the listing's claim token. */
export function buildDeclineUrl(token: string): string {
  return `${SITE_URL}/claim-listing/${token}/decline`;
}

/** The sentence every claim invite ends with: who we are and how to stop them. */
export function buildOptOutFooter(token: string): string {
  return `Not the right person, or not interested? Let me know here and I won't email you again: ${buildDeclineUrl(token)}\n\nPatronage · Auckland, New Zealand`;
}

export async function isEmailOptedOut(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("claim_invite_optouts")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return !!data;
}

// ── Next 9am NZST helper ──────────────────────────────────────────────────────

export function getNext9amNZST(): string {
  const now = new Date();
  const nzTime = new Date(now.toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  const nzHour = nzTime.getHours();
  const target = new Date(nzTime);
  if (nzHour >= 9) {
    target.setDate(target.getDate() + 1);
  }
  target.setHours(9, 0, 0, 0);
  const offset = nzTime.getTime() - now.getTime();
  const utcTarget = new Date(target.getTime() - offset);
  return utcTarget.toISOString();
}

// ── Plain-text → HTML conversion ─────────────────────────────────────────────

export function bodyToHtml(text: string, claimUrl?: string, listingUrl?: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Replace the bare claim URL line with a styled CTA button
  let processed = escaped;
  if (claimUrl) {
    const escapedUrl = claimUrl.replace(/&/g, "&amp;");
    const button = `<div style="margin:24px 0"><a href="${escapedUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;font-family:sans-serif;letter-spacing:0.01em">Claim listing →</a></div>`;
    processed = processed.replace(escapedUrl, button);
  }

  // Auto-link any remaining URLs
  const linked = processed.replace(
    /(https?:\/\/[^\s<"]+)/g,
    (url) => `<a href="${url}" style="color:#000;text-decoration:underline">${url}</a>`
  );

  const footer = listingUrl
    ? `<br><p style="margin:16px 0 0;font-size:12px;color:#888"><a href="${listingUrl}" style="color:#888;text-decoration:underline">View listing on Patronage →</a></p>`
    : "";

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;font-size:14px;line-height:1.7">${linked.replace(/\n/g, "<br>")}${footer}</body></html>`;
}

// ── CRM log ──────────────────────────────────────────────────────────────────

export async function logClaimInviteToCRM(
  email: string,
  organiserName: string,
  opportunityTitle: string
): Promise<void> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("outreach_contacts")
    .select("id, status")
    .eq("email", email.trim())
    .maybeSingle();

  if (existing) {
    await Promise.all([
      admin.from("outreach_activity").insert({
        contact_id: existing.id,
        activity_type: "email_sent",
        description: `Claim invite sent for opportunity: ${opportunityTitle}`,
      }),
      admin.from("outreach_contacts").update({
        last_activity_date: today,
        ...(existing.status === "not_started" ? { status: "contacted" } : {}),
      }).eq("id", existing.id),
    ]);
  } else {
    const { data: newContact } = await admin
      .from("outreach_contacts")
      .insert({
        company: organiserName || email.split("@")[1] || "Unknown",
        email: email.trim(),
        status: "contacted",
        channel: "intro_email",
        sent_from: "patronage",
        last_activity_date: today,
        first_contact_date: today,
        category: "other",
      })
      .select("id")
      .single();

    if (newContact) {
      await admin.from("outreach_activity").insert({
        contact_id: newContact.id,
        activity_type: "email_sent",
        description: `Claim invite sent for opportunity: ${opportunityTitle}`,
      });
    }
  }
}
