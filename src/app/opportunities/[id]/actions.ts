"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

export async function updateOpportunityAdmin(
  id: string,
  data: {
    caption?: string | null;
    url?: string | null;
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
