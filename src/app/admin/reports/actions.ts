"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Close a report (227). "hide" also takes the item down: a note is hidden
 * from everyone but its artist, a notice comes off the board, a reply is
 * hidden. "keep" closes the report and leaves the item as it is.
 */
export async function resolveReport(reportId: string, action: "hide" | "keep"): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("content_reports")
    .select("item_type, item_id")
    .eq("id", reportId)
    .single();
  if (!report) return { error: "Report not found." };

  if (action === "hide") {
    const { error } =
      report.item_type === "note"
        ? await admin.from("project_notes").update({ is_visible: false }).eq("id", report.item_id)
        : report.item_type === "notice"
          ? await admin.from("notices").update({ admin_hidden: true }).eq("id", report.item_id)
          : await admin.from("notice_replies").update({ hidden: true }).eq("id", report.item_id);
    if (error) return { error: error.message };
  }

  // Every open report on the same item closes together.
  const { error } = await admin
    .from("content_reports")
    .update({ resolved_at: new Date().toISOString() })
    .eq("item_type", report.item_type)
    .eq("item_id", report.item_id)
    .is("resolved_at", null);
  if (error) return { error: error.message };

  revalidatePath("/admin/reports");
  revalidatePath("/noticeboard");
  return {};
}
