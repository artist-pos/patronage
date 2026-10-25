"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import {
  CLAIM_FROM,
  bodyToHtml,
  buildOptOutFooter,
  getNext9amNZST,
  getResend,
  isEmailOptedOut,
  logClaimInviteToCRM,
} from "@/lib/claim-invite";
import {
  buildClaimOnlyBody,
  buildClaimPipelineBody,
  buildTemplateSubject,
  buildClaimUrl,
  type TemplateVars,
} from "./claim-templates";

// ── Track claim link open ─────────────────────────────────────────────────────

export async function trackClaimOpen(token: string): Promise<void> {
  const admin = createAdminClient();
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

  if (await isEmailOptedOut(input.recipientEmail)) {
    return { error: "This address has opted out of claim invites." };
  }

  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, claim_token, claim_token_expires_at")
    .eq("id", input.opportunityId)
    .single();

  if (!opp) return { error: "Opportunity not found." };

  let claimToken = opp.claim_token;
  if (!claimToken || !opp.claim_token_expires_at || new Date(opp.claim_token_expires_at) < new Date()) {
    claimToken = crypto.randomUUID();
    await supabase
      .from("opportunities")
      .update({
        claim_token: claimToken,
        claim_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", opp.id);
  }

  const claimUrl = buildClaimUrl(claimToken);
  const listingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/opportunities/${opp.id}`;

  const resend = getResend();
  const scheduledAt = input.scheduleFor9am ? getNext9amNZST() : undefined;

  const { error: sendError } = await resend.emails.send({
    from: CLAIM_FROM,
    to: input.recipientEmail,
    subject: input.subject,
    html: bodyToHtml(`${input.body}\n\n${buildOptOutFooter(claimToken)}`, claimUrl, listingUrl),
    ...(scheduledAt ? { scheduledAt } : {}),
  });

  if (sendError) return { error: (sendError as { message?: string }).message ?? "Send failed." };

  await supabase
    .from("opportunities")
    .update({
      claim_invite_sent_at: new Date().toISOString(),
      claim_invite_email: input.recipientEmail,
      claim_invite_scheduled_for: scheduledAt ?? null,
      claim_invite_template: input.template,
    })
    .eq("id", opp.id);

  // Log to CRM (fire-and-forget — don't block the response)
  logClaimInviteToCRM(input.recipientEmail, input.recipientName, input.subject).catch(console.error);

  revalidatePath("/admin/opportunities");
  return { scheduledFor: scheduledAt };
}

// ── Bulk send (individual item, called client-side in loop) ───────────────────

export interface BulkSendItem {
  opportunityId: string;
  recipientEmail: string;
  recipientName: string;
  organiserName: string;
  opportunityTitle: string;
  claimToken: string | null;
  claimTokenExpiresAt: string | null;
  alreadySent: boolean;
}

export async function sendSingleBulkInvite(
  item: BulkSendItem,
  template: "claim_only" | "claim_pipeline",
  scheduleFor9am: boolean
): Promise<{ error?: string }> {
  if (!item.recipientEmail.trim()) return { error: "No email" };
  if (await isEmailOptedOut(item.recipientEmail)) return { error: "Opted out" };

  const supabase = await createClient();

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
  const listingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/opportunities/${item.opportunityId}`;
  const vars: TemplateVars = {
    recipientName: item.recipientName || item.organiserName || item.recipientEmail.split("@")[0],
    organiserName: item.organiserName || item.opportunityTitle,
    opportunityTitle: item.opportunityTitle,
    claimUrl,
  };

  const body = template === "claim_only" ? buildClaimOnlyBody(vars) : buildClaimPipelineBody(vars);
  const subject = buildTemplateSubject(template, item.opportunityTitle);
  const scheduledAt = scheduleFor9am ? getNext9amNZST() : undefined;

  const resend = getResend();
  const { error: sendError } = await resend.emails.send({
    from: CLAIM_FROM,
    to: item.recipientEmail,
    subject,
    html: bodyToHtml(`${body}\n\n${buildOptOutFooter(claimToken)}`, claimUrl, listingUrl),
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

  // Log to CRM (fire-and-forget)
  logClaimInviteToCRM(item.recipientEmail, item.organiserName, item.opportunityTitle).catch(console.error);

  revalidatePath("/admin/opportunities");
  return {};
}
