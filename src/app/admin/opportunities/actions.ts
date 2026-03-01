"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function toggleOpportunityActive(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("opportunities")
    .update({ is_active: !current })
    .eq("id", id);
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
}

export async function deleteOpportunity(id: string) {
  await guard();
  const supabase = await createClient();
  await supabase.from("opportunities").delete().eq("id", id);
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
}
