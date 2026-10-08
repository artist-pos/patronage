"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RubricCriterion, PartnerDocument } from "@/types/database";
import type { LocalCriterion } from "@/components/partner/wizard/RubricBuilder";

export async function savePartnerDocument(
  opportunityId: string,
  label: string,
  storagePath: string,
  fileSizeKb: number,
): Promise<{ doc?: PartnerDocument; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("partner_documents")
    .insert({
      opportunity_id: opportunityId,
      label,
      storage_path: storagePath,
      file_size_kb: fileSizeKb,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "Upload failed" };
  return { doc: data as PartnerDocument };
}

export async function deletePartnerDocument(documentId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("partner_documents")
    .delete()
    .eq("id", documentId);

  if (error) return { error: error.message };
  return {};
}

export async function saveRubricCriteria(
  opportunityId: string,
  criteria: LocalCriterion[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: opp } = await supabase
    .from("opportunities")
    .select("profile_id")
    .eq("id", opportunityId)
    .single();

  if (!opp || opp.profile_id !== user.id) return { error: "Not authorised" };

  // Delete existing non-locked criteria, then upsert
  await supabase
    .from("rubric_criteria")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("locked", false);

  // Locked criteria belong to scoring that has started. They are never rewritten here.
  const open = criteria.filter((c) => !c.locked);
  if (open.length === 0) return {};

  const rows = open.map((c, i) => ({
    id: c.id,
    opportunity_id: opportunityId,
    label: c.label,
    helper: c.helper,
    weight: c.weight,
    scale_max: c.scale_max,
    position: i,
    locked: false,
  }));

  const { error } = await supabase
    .from("rubric_criteria")
    .upsert(rows, { onConflict: "id" });

  if (error) return { error: error.message };
  return {};
}

/**
 * Fix the wording of a criterion after scoring has started. Only the label and
 * helper text can change: weight, scale and the list itself stay fixed, because
 * changing those would change what earlier scores mean.
 */
export async function updateCriterionWording(
  opportunityId: string,
  criterionId: string,
  label: string,
  helper: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: opp } = await supabase.from("opportunities").select("profile_id").eq("id", opportunityId).single();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdminUser = profile?.role === "admin" || profile?.role === "owner";
  if (!opp || (opp.profile_id !== user.id && !isAdminUser)) return { error: "Not authorised" };

  const trimmed = label.trim();
  if (!trimmed) return { error: "A criterion needs a name." };

  // RLS blocks edits to locked rows, so this goes through the server once ownership is checked.
  const { error } = await createAdminClient()
    .from("rubric_criteria")
    .update({ label: trimmed.slice(0, 120), helper: helper?.trim() ? helper.trim().slice(0, 300) : null })
    .eq("id", criterionId)
    .eq("opportunity_id", opportunityId);
  return error ? { error: error.message } : {};
}

export async function getRubricCriteria(opportunityId: string): Promise<RubricCriterion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rubric_criteria")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("position");
  return (data ?? []) as RubricCriterion[];
}

export async function getPartnerDocuments(opportunityId: string): Promise<PartnerDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_documents")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at");
  return (data ?? []) as PartnerDocument[];
}
