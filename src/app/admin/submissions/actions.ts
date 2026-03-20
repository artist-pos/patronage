"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function approveSubmission(submissionId: string) {
  await guard();
  const supabase = await createClient();

  // Fetch the submission
  const { data: sub, error: fetchErr } = await supabase
    .from("opportunity_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (fetchErr || !sub) throw new Error("Submission not found");

  // Insert into live opportunities table — copy all relevant fields
  const { error: insertErr } = await supabase.from("opportunities").insert({
    title: sub.title,
    organiser: sub.organiser,
    caption: sub.caption ?? null,
    full_description: sub.full_description ?? null,
    type: sub.type,
    country: sub.country,
    city: sub.city ?? null,
    opens_at: sub.opens_at ?? null,
    deadline: sub.deadline ?? null,
    url: sub.url ?? null,
    featured_image_url: sub.featured_image_url ?? null,
    funding_amount: sub.funding_amount ?? null,
    funding_range: sub.funding_range ?? null,
    sub_categories: sub.sub_categories ?? null,
    grant_type: sub.grant_type ?? null,
    recipients_count: sub.recipients_count ?? null,
    entry_fee: sub.entry_fee ?? null,
    artist_payment_type: sub.artist_payment_type ?? null,
    travel_support: sub.travel_support ?? null,
    travel_support_details: sub.travel_support_details ?? null,
    routing_type: sub.routing_type ?? "external",
    custom_fields: sub.custom_fields ?? [],
    pipeline_config: sub.pipeline_config ?? null,
    show_badges_in_submission: sub.show_badges_in_submission ?? true,
    profile_id: sub.profile_id ?? null,
    is_active: true,
    status: "published",
  });

  if (insertErr) throw new Error(insertErr.message);

  // Mark submission as approved
  await supabase
    .from("opportunity_submissions")
    .update({ status: "approved" })
    .eq("id", submissionId);

  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
}

export async function rejectSubmission(submissionId: string) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("opportunity_submissions")
    .update({ status: "rejected" })
    .eq("id", submissionId);
  revalidatePath("/admin/submissions");
}
