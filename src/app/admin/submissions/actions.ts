"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerFeeRequest, sendPartnerListingDecision } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { toSlug, isSlugBad } from "@/lib/opportunity-slug";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

/** Email and in-app notice to whoever owns the listing. Never blocks the decision. */
async function tellPartner(id: string, approved: boolean, reason?: string | null) {
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
      await sendPartnerListingDecision({ partnerEmail: email, opportunityTitle: title, approved, reason, url });
    }
    await createNotification(
      opp.profile_id as string,
      "note",
      approved ? `${title} is now live` : `${title} was not approved`,
      approved ? "Your listing has been approved and published." : reason?.trim() || "Open the listing to see what to change.",
      approved ? `/partner/dashboard/${opp.id}` : `/partner/opportunities/${opp.id}/manage`,
    );
  } catch (err) {
    console.error("[submissions] could not notify partner:", err);
  }
}

export async function approveSubmission(submissionId: string, options: { waiveFee?: boolean } = {}) {
  await guard();
  const supabase = await createClient();

  // Fetch current state so we can fix bad slugs generated when the title was blank at submit time.
  const { data: opp } = await supabase
    .from("opportunities")
    .select("slug, title, organiser, deadline, routing_type, pipeline_paid_at")
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  // Pipeline listings must have the activation fee paid before they can go live —
  // the partner is routed to /activate when they submit, but that doesn't block
  // the row from sitting in this queue unpaid, so enforce it here too.
  if (opp?.routing_type === "pipeline" && !opp.pipeline_paid_at) {
    if (!options.waiveFee) {
      throw new Error("This open call hasn't paid the publishing fee. Approve with the fee waived, or request payment.");
    }
    // Waiving is an admin decision, recorded the same way a payment is.
    const { error: waiveError } = await createAdminClient()
      .from("opportunities")
      .update({ pipeline_paid_at: new Date().toISOString() })
      .eq("id", submissionId);
    if (waiveError) throw new Error(waiveError.message);
  }

  const updates: Record<string, unknown> = { status: "published", is_active: true };
  if (opp && isSlugBad(opp.slug)) {
    updates.slug = toSlug(opp.title ?? "", opp.organiser ?? null, opp.deadline ?? null);
  }

  const { error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  await tellPartner(submissionId, true);

  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${submissionId}`);
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

export async function rejectSubmission(submissionId: string, reason?: string) {
  await guard();
  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({ status: "rejected" })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);

  await tellPartner(submissionId, false, reason);
  revalidatePath("/admin/submissions");
}
