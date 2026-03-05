"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateGrantsAction(grants: string[]): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ received_grants: grants })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/profile/edit");
}
