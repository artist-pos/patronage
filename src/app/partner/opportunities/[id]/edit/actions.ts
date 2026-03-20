"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getOpportunityForPartner(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, profile_id, status")
    .eq("id", id)
    .single();

  if (!opp) throw new Error("Listing not found");
  if (opp.profile_id !== user.id) throw new Error("Not authorised");

  return { supabase, user, opp };
}

export async function updateOpportunityPartner(
  id: string,
  data: {
    title?: string;
    organiser?: string;
    caption?: string | null;
    full_description?: string | null;
    url?: string | null;
    type?: string;
    country?: string;
    city?: string | null;
    featured_image_url?: string | null;
    sub_categories?: string[] | null;
    career_stage?: string[] | null;
    tags?: string[] | null;
    opens_at?: string | null;
    deadline?: string | null;
    funding_range?: string | null;
    entry_fee?: number | null;
    grant_type?: string | null;
    recipients_count?: number | null;
    artist_payment_type?: string | null;
    travel_support?: boolean | null;
    travel_support_details?: string | null;
    routing_type?: string | null;
    show_badges_in_submission?: boolean;
    pipeline_config?: object | null;
  }
) {
  const { supabase, opp } = await getOpportunityForPartner(id);

  // Partners cannot change status, is_active, is_featured, or recurring fields
  const { error } = await supabase
    .from("opportunities")
    .update(data)
    .eq("id", id)
    .eq("profile_id", (await supabase.auth.getUser()).data.user!.id);

  if (error) throw new Error(error.message);

  revalidatePath("/partner/dashboard");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);

  void opp; // suppress unused warning
}

export async function publishOpportunityPartner(id: string) {
  const { supabase, opp, user } = await getOpportunityForPartner(id);

  if (opp.status !== "draft") {
    throw new Error("Only draft listings can be published");
  }

  const { error } = await supabase
    .from("opportunities")
    .update({ status: "published", is_active: true })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/partner/dashboard");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
}
