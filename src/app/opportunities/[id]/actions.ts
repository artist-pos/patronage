"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateOpportunityAdmin(
  id: string,
  data: {
    caption?: string | null;
    url?: string | null;
    type?: string;
    country?: string;
    featured_image_url?: string | null;
    sub_categories?: string[] | null;
    deadline?: string | null;
    funding_range?: string | null;
  }
) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();
  const { error } = await admin.from("opportunities").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
}

export async function rejectOpportunityAdmin(id: string) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .eq("id", id);
  revalidatePath("/opportunities");
  redirect("/opportunities");
}
