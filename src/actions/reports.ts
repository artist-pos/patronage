"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * File a report on a note, notice or notice reply (227). One per person per
 * item; reporting twice is quietly accepted. Admins read them at /admin/reports.
 */
export async function reportContent(
  itemType: "note" | "notice" | "notice_reply",
  itemId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to report something." };
  const { error } = await supabase
    .from("content_reports")
    .upsert(
      { reporter_id: user.id, item_type: itemType, item_id: itemId },
      { onConflict: "reporter_id,item_type,item_id", ignoreDuplicates: true },
    );
  if (error) return { error: "We couldn't send that report. Try again." };
  return {};
}
