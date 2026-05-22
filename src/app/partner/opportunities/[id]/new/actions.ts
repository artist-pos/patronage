"use server";

import { createClient } from "@/lib/supabase/server";
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

  if (criteria.length === 0) return {};

  const rows = criteria.map((c, i) => ({
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
