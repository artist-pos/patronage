"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type OutcomeResult = "selected" | "shortlisted" | "unsuccessful" | "no_response";
const RESULTS: OutcomeResult[] = ["selected", "shortlisted", "unsuccessful", "no_response"];

export interface OutcomeInput {
  applied: boolean;
  result: OutcomeResult | null;
  responseWeeks: number | null;
  tip: string;
  privateNote: string;
}

/** Save the viewer's report on how an opportunity went (226). One per person. */
export async function saveOutcome(opportunityId: string, input: OutcomeInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = input.applied && input.result && RESULTS.includes(input.result) ? input.result : null;
  const weeks =
    input.applied && result && result !== "no_response" && input.responseWeeks != null
      ? Math.max(0, Math.min(52, Math.round(input.responseWeeks)))
      : null;
  const tip = input.tip.trim().slice(0, 280) || null;
  const privateNote = input.privateNote.trim().slice(0, 1000) || null;

  const { error } = await supabase.from("opportunity_outcomes").upsert(
    {
      opportunity_id: opportunityId,
      user_id: user.id,
      applied: input.applied,
      result,
      response_weeks: weeks,
      tip,
      private_note: privateNote,
    },
    { onConflict: "opportunity_id,user_id" },
  );
  if (error) return { error: "Couldn't save your report." };
  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

/** Admin: approve or hide a pending tip. */
export async function reviewTip(
  opportunityId: string,
  userId: string,
  status: "approved" | "hidden",
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("opportunity_outcomes")
    .update({ tip_status: status })
    .eq("opportunity_id", opportunityId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/outcome-tips");
  return {};
}
