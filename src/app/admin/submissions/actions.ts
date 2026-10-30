"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerFeeRequest, sendPartnerListingDecision } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { slugForPublish } from "@/lib/opportunity-publish";
import { isAggregated, missingOutreachDetails } from "@/lib/claim-outreach";
import type { Opportunity } from "@/types/database";
import { resolveRejectionReasons, summariseRejection, type RejectionReason } from "@/lib/listing-rejection";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

/** Email and in-app notice to whoever owns the listing. Never blocks the decision. */
async function tellPartner(
  id: string,
  approved: boolean,
  rejection?: { reasons: RejectionReason[]; message?: string | null },
) {
  try {
    const admin = createAdminClient();
    const { data: opp } = await admin
      .from("opportunities")
      .select("id, title, profile_id")
      .eq("id", id)
      .maybeSingle();
    if (!opp?.profile_id) return;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
    const title = (opp.title as string) || "your listing";
    const { data: auth } = await admin.auth.admin.getUserById(opp.profile_id as string);
    const email = auth?.user?.email;
    const url = approved ? `${siteUrl}/partner/dashboard/${opp.id}` : `${siteUrl}/partner/opportunities/${opp.id}/manage`;
    if (email) {
      await sendPartnerListingDecision({
        partnerEmail: email,
        opportunityTitle: title,
        approved,
        reasons: rejection?.reasons,
        message: rejection?.message,
        url,
      });
    }
    const summary = rejection ? summariseRejection(rejection.reasons, rejection.message) : "";
    await createNotification(
      opp.profile_id as string,
      "note",
      approved ? `${title} is now live` : `${title} was not approved`,
      approved ? "Your listing has been approved and published." : summary || "Open the listing to see what to change.",
      approved ? `/partner/dashboard/${opp.id}` : `/partner/opportunities/${opp.id}/manage`,
    );
  } catch (err) {
    console.error("[submissions] could not notify partner:", err);
  }
}

export async function approveSubmission(submissionId: string, options: { waiveFee?: boolean } = {}): Promise<{ error?: string }> {
  await guard();
  const supabase = await createClient();

  // Fetch current state so the slug can be rebuilt from the edited details.
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, slug, title, organiser, deadline, status, routing_type, pipeline_paid_at, origin, profile_id, claim_email, claim_contact_name, claim_current_tool")
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  // Tips and admin listings have nobody behind them yet: the claim email needs
  // someone to write to before they go live.
  if (opp && isAggregated(opp as Pick<Opportunity, "origin" | "profile_id">)) {
    const missing = missingOutreachDetails({
      email: opp.claim_email ?? "",
      contactName: opp.claim_contact_name ?? "",
      currentTool: opp.claim_current_tool ?? "",
    });
    if (missing.length > 0) return { error: `Add the ${missing.join(", ")} before approving.` };
  }

  // Pipeline listings must have the activation fee paid before they can go live —
  // the partner is routed to /activate when they submit, but that doesn't block
  // the row from sitting in this queue unpaid, so enforce it here too.
  if (opp?.routing_type === "pipeline" && !opp.pipeline_paid_at) {
    if (!options.waiveFee) {
      return { error: "This open call hasn't paid the publishing fee. Approve with the fee waived, or request payment." };
    }
    // Waiving is an admin decision, recorded the same way a payment is.
    const { error: waiveError } = await createAdminClient()
      .from("opportunities")
      .update({ pipeline_paid_at: new Date().toISOString() })
      .eq("id", submissionId);
    if (waiveError) return { error: waiveError.message };
  }

  const updates: Record<string, unknown> = { status: "published", is_active: true };
  const slug = opp ? await slugForPublish(createAdminClient(), opp) : null;
  if (slug) updates.slug = slug;

  const { error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  await tellPartner(submissionId, true);

  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${submissionId}`);
  return {};
}

/** Ask the organiser to pay the publishing fee. The listing stays in review until they do. */
export async function requestPipelineFee(submissionId: string) {
  await guard();
  const admin = createAdminClient();
  const { data: opp } = await admin
    .from("opportunities")
    .select("id, title, profile_id, pipeline_paid_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!opp?.profile_id) throw new Error("This listing has no owner to ask.");
  if (opp.pipeline_paid_at) throw new Error("The fee has already been paid or waived.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const title = (opp.title as string) || "your open call";
  const { data: auth } = await admin.auth.admin.getUserById(opp.profile_id as string);
  const email = auth?.user?.email;
  if (!email) throw new Error("No email address on file for the organiser.");

  await sendPartnerFeeRequest({
    partnerEmail: email,
    opportunityTitle: title,
    url: `${siteUrl}/partner/opportunities/${opp.id}/activate`,
  });
  await createNotification(
    opp.profile_id as string,
    "note",
    `Publishing fee for ${title}`,
    "Your listing is ready. Pay the publishing fee to go live.",
    `/partner/opportunities/${opp.id}/activate`,
  );
}

/**
 * Decline a listing. Pick any of the preset reasons and/or write your own
 * message; the organiser gets both in one email. Also works on a listing that
 * is already live, which takes it offline.
 */
export async function rejectSubmission(
  submissionId: string,
  input: { reasonKeys?: string[]; message?: string } = {},
) {
  await guard();
  const reasons = resolveRejectionReasons(input.reasonKeys);
  const message = input.message?.trim() || null;
  if (reasons.length === 0 && !message) {
    throw new Error("Pick at least one reason or write a message for the organiser.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);

  await tellPartner(submissionId, false, { reasons, message });
  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${submissionId}`);
}
