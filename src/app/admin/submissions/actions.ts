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

  // Insert into live opportunities table
  const { error: insertErr } = await supabase.from("opportunities").insert({
    title: sub.title,
    organiser: sub.organiser,
    caption: sub.caption ?? null,
    full_description: sub.full_description ?? null,
    type: sub.type,
    country: sub.country,
    city: sub.city ?? null,
    deadline: sub.deadline ?? null,
    url: sub.url ?? null,
    featured_image_url: sub.featured_image_url ?? null,
    funding_amount: sub.funding_amount ?? null,
    funding_range: sub.funding_range ?? null,
    sub_categories: sub.sub_categories ?? null,
    grant_type: sub.grant_type ?? null,
    recipients_count: sub.recipients_count ?? null,
    is_active: true,
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
