"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normaliseOpportunityWrite } from "@/lib/opportunity-fields";
import type { OpportunityPayload } from "@/lib/opportunity-payload";
import { validPartnerProfileId } from "@/lib/organiser-link";
import { isAdmin } from "@/lib/admin";
import { isOrgMember } from "@/lib/partner-org";

// The only columns a listing owner may write. Anything else in the payload is
// dropped, so status, payment and featured flags can't be set from the client.
const PARTNER_EDITABLE = new Set([
  "title", "organiser", "organiser_profile_id", "caption", "full_description", "url",
  "application_links", "contact_email", "type", "country", "city", "featured_image_url",
  "secondary_image_url", "sub_categories", "career_stage", "tags", "opens_at", "deadline",
  "funding_range", "entry_fee", "entry_fee_currency", "entry_fee_local", "grant_type",
  "recipients_count", "artist_payment_type", "travel_support", "travel_support_details",
  "routing_type", "source", "source_url", "show_badges_in_submission", "pipeline_config",
]);

async function getOpportunityForPartner(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, profile_id, status, routing_type, title, organiser, deadline, slug, pipeline_paid_at")
    .eq("id", id)
    .single();

  if (!opp) throw new Error("Listing not found");
  if (!(await isOrgMember(supabase, user.id, opp.profile_id))) throw new Error("Not authorised");

  return { supabase, user, opp };
}

export async function updateOpportunityPartner(
  id: string,
  data: Partial<Omit<OpportunityPayload, "is_featured" | "is_recurring" | "recurrence_pattern" | "recurrence_open_day" | "recurrence_close_day" | "recurrence_end_date">> & {
    entry_fee_local?: number | null;
  }
) {
  const { supabase, opp } = await getOpportunityForPartner(id);

  // Partners can only change the fields in PARTNER_EDITABLE.
  const picked = Object.fromEntries(
    Object.entries(data).filter(([key]) => PARTNER_EDITABLE.has(key))
  );

  // Same normalisation as every other editor: link rows, source, contact email
  // and foreign-currency entry fees.
  const updateData: Record<string, unknown> = await normaliseOpportunityWrite(picked);

  // A partner can only attribute their own listing to their own account;
  // admins (listing on behalf of an organisation, including shadow accounts)
  // can link any partner account.
  if ("organiser_profile_id" in updateData) {
    const wanted = updateData.organiser_profile_id as string | null | undefined;
    const allowed = !!wanted && (wanted === opp.profile_id || (await isAdmin()));
    const resolvedPid = allowed ? await validPartnerProfileId(wanted) : null;
    updateData.organiser_profile_id = resolvedPid;
    if (resolvedPid && (await isAdmin())) {
      updateData.profile_id = resolvedPid;
    }
  }
  // Partners cannot publish: status, is_active, is_featured and recurring fields
  // are not in PARTNER_EDITABLE, and the protect_opportunity_columns trigger
  // refuses an owner's draft -> published change. Only an admin approves.
  const { error } = await supabase
    .from("opportunities")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", opp.profile_id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
  // The public page is served by slug when one exists — revalidating only the
  // id path left it stale (e.g. a newly-uploaded T&C PDF not showing up).
  if (opp.slug) revalidatePath(`/opportunities/${opp.slug}`);
}
