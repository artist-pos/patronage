"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { toSlug, isSlugBad } from "@/lib/opportunity-slug";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function approveSubmission(submissionId: string) {
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
    throw new Error("This pipeline listing hasn't paid the activation fee yet — it can't be published until payment is confirmed.");
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

  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${submissionId}`);
}

export async function rejectSubmission(submissionId: string) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("opportunities")
    .update({ status: "rejected" })
    .eq("id", submissionId);
  revalidatePath("/admin/submissions");
}
