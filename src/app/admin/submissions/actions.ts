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

  const { error } = await supabase
    .from("opportunities")
    .update({ status: "published", is_active: true })
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  revalidatePath("/admin/submissions");
  revalidatePath("/opportunities");
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
