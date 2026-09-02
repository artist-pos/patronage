"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveWorksLayout(rowH: number, hGap: number, vGap: number, lastRowAlign: "left" | "center" | "right" = "left") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return { error: "Not authorised" };
  }

  // Use admin client so RLS doesn't silently block the update.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ works_row_height: rowH, works_h_gap: hGap, works_v_gap: vGap, works_last_row_align: lastRowAlign })
    .eq("id", user.id)
    .select("works_row_height, works_h_gap, works_v_gap, works_last_row_align")
    .single();

  if (error) return { error: error.message };
  if (!data) return { error: "Update returned no data. Check columns exist in DB" };

  return {};
}
