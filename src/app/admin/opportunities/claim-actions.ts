"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const FROM = "Blake Aitken <blake@patronage.nz>";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

// ── Next 9am NZST helper ──────────────────────────────────────────────────────

function getNext9amNZST(): string {
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

function bodyToHtml(text: string): string {
  // Escape HTML, then linkify URLs, then convert newlines
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" style="color:#000;text-decoration:underline;">${url}</a>`
  );

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;font-size:14px;line-height:1.7;">${linked.replace(/\n/g, "<br>")}</body></html>`;
}

// ── Track claim link open ─────────────────────────────────────────────────────

export async function trackClaimOpen(token: string): Promise<void> {
  const admin = createAdminClient();
  // Fetch current values
  const { data: opp } = await admin
    .from("opportunities")
    .select("id, claim_link_opened_at, claim_link_open_count")
    .eq("claim_token", token)
    .single();
  if (!opp) return;

  await admin
    .from("opportunities")
    .update({
      claim_link_opened_at: opp.claim_link_opened_at ?? new Date().toISOString(),
      claim_link_open_count: (opp.claim_link_open_count ?? 0) + 1,
    })
    .eq("id", opp.id);
}

// ── Send a single claim invite ────────────────────────────────────────────────

export interface SendClaimInviteInput {
  opportunityId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  template: "claim_only" | "claim_pipeline";
  scheduleFor9am: boolean;
}

export async function sendClaimInvite(
  input: SendClaimInviteInput
): Promise<{ error?: string; scheduledFor?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };

  const supabase = await createClient();

  // Ensure the opportunity has a claim token; generate one if missing
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, claim_token, claim_token_expires_at")
    .eq("id", input.opportunityId)
    .single();

  if (!opp) return { error: "Opportunity not found." };

  let claimToken = opp.claim_token;
  if (!claimToken || !opp.claim_token_expires_at || new Date(opp.claim_token_expires_at) < new Date()) {
    // Generate a fresh token (14-day expiry)
    claimToken = crypto.randomUUID();
    await supabase
      .from("opportunities")
      .update({
        claim_token: claimToken,
        claim_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", opp.id);
  }

  const resend = getResend();
  const scheduledAt = input.scheduleFor9am ? getNext9amNZST() : undefined;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: input.recipientEmail,
    subject: input.subject,
    html: bodyToHtml(input.body),
    ...(scheduledAt ? { scheduledAt } : {}),
  });

  if (sendError) return { error: (sendError as { message?: string }).message ?? "Send failed." };

  // Record the send
  await supabase
    .from("opportunities")
    .update({
      claim_invite_sent_at: new Date().toISOString(),
      claim_invite_email: input.recipientEmail,
      claim_invite_scheduled_for: scheduledAt ?? null,
      claim_invite_template: input.template,
    })
    .eq("id", opp.id);

  revalidatePath("/admin/opportunities");
  return { scheduledFor: scheduledAt };
}

// ── Build template text (with all placeholders replaced) ─────────────────────

export interface TemplateVars {
  recipientName: string;
  opportunityTitle: string;
  claimUrl: string;
}

export function buildClaimOnlyBody(vars: TemplateVars): string {
  return `Kia ora ${vars.recipientName},

My name's Blake. I'm an artist and the founder of Patronage, a career infrastructure platform for New Zealand creatives.

Your ${vars.opportunityTitle} is already live on our directory to help drive visibility. Listing opportunities on Patronage is always completely free.

Claim your listing here:
${vars.claimUrl}

Feel free to get in touch if you have any questions.

patronage.nz/partners
Blake Aitken · patronage.nz/blakeaitken · +64 27 536 4850`;
}

export function buildClaimPipelineBody(vars: TemplateVars): string {
  return `Kia ora ${vars.recipientName},

My name's Blake. I'm an artist and the founder of Patronage, a career infrastructure platform for New Zealand creatives.

Your ${vars.opportunityTitle} is already live on our directory to help drive visibility. Listing opportunities on Patronage is always completely free. Claim your listing and open your free Partner account here:

${vars.claimUrl}

I noticed your submission process currently runs through manual channels. That administrative friction — downloading forms, organising folders, matching emails to applications — is exactly what our Pipeline tool was built to address.

For now, all you need to do is claim your listing. But when you're ready to streamline applications, you can run your next round through our Pipeline dashboard completely free of charge. Artists apply with one click — CVs, portfolios, and answers to your questions arrive standardised in one secure dashboard.

Feel free to claim the listing today, and keep us in mind for your next round.

patronage.nz/partners
Blake Aitken · patronage.nz/blakeaitken · +64 27 536 4850`;
}

export function buildTemplateSubject(
  template: "claim_only" | "claim_pipeline",
  opportunityTitle: string
): string {
  if (template === "claim_only") {
    return `${opportunityTitle} is live on Patronage`;
  }
  return `${opportunityTitle} is live on Patronage — streamline your next round`;
}

export function buildClaimUrl(token: string): string {
  return `${SITE_URL}/claim-listing/${token}`;
}

// ── Bulk send claim invites ───────────────────────────────────────────────────

export interface BulkSendItem {
  opportunityId: string;
  recipientEmail: string;
  recipientName: string;
  opportunityTitle: string;
  claimToken: string | null;
  claimTokenExpiresAt: string | null;
  alreadySent: boolean;
}

export interface BulkSendInput {
  items: BulkSendItem[];
  template: "claim_only" | "claim_pipeline";
  scheduleFor9am: boolean;
  includeAlreadySent: boolean;
}

export interface BulkSendResult {
  sent: number;
  scheduled: number;
  skippedAlreadySent: number;
  skippedNoEmail: number;
  failed: number;
  errors: string[];
}

// Individual item send for bulk (called client-side in a loop with delay)
export async function sendSingleBulkInvite(
  item: BulkSendItem,
  template: "claim_only" | "claim_pipeline",
  scheduleFor9am: boolean
): Promise<{ error?: string }> {
  if (!item.recipientEmail.trim()) return { error: "No email" };

  const supabase = await createClient();

  // Ensure token exists
  let claimToken = item.claimToken;
  if (!claimToken || !item.claimTokenExpiresAt || new Date(item.claimTokenExpiresAt) < new Date()) {
    claimToken = crypto.randomUUID();
    await supabase
      .from("opportunities")
      .update({
        claim_token: claimToken,
        claim_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", item.opportunityId);
  }

  const claimUrl = buildClaimUrl(claimToken);
  const vars: TemplateVars = {
    recipientName: item.recipientName || item.recipientEmail.split("@")[0],
    opportunityTitle: item.opportunityTitle,
    claimUrl,
  };

  const body = template === "claim_only" ? buildClaimOnlyBody(vars) : buildClaimPipelineBody(vars);
  const subject = buildTemplateSubject(template, item.opportunityTitle);
  const scheduledAt = scheduleFor9am ? getNext9amNZST() : undefined;

  const resend = getResend();
  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: item.recipientEmail,
    subject,
    html: bodyToHtml(body),
    ...(scheduledAt ? { scheduledAt } : {}),
  });

  if (sendError) return { error: (sendError as { message?: string }).message ?? "Send failed" };

  await supabase
    .from("opportunities")
    .update({
      claim_invite_sent_at: new Date().toISOString(),
      claim_invite_email: item.recipientEmail,
      claim_invite_scheduled_for: scheduledAt ?? null,
      claim_invite_template: template,
    })
    .eq("id", item.opportunityId);

  revalidatePath("/admin/opportunities");
  return {};
}
