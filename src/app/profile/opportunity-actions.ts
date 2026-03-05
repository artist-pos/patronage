"use server";

import { createClient } from "@/lib/supabase/server";

export async function postOpportunity(formData: {
  title: string;
  type: string;
  budget: string;
  description: string;
  deadline: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("opportunities").insert({
    profile_id: user.id,
    title: formData.title.trim().slice(0, 140),
    organiser: "", // not required for profile opportunities
    type: formData.type,
    country: "Global",
    description: formData.description.trim().slice(0, 500) || null,
    caption: formData.budget.trim() || null,
    deadline: formData.deadline || null,
    is_active: true,
  });

  if (error) return { error: error.message };
  return {};
}

export async function postProfileOpportunity(formData: {
  title: string;
  organiser: string;
  type: string;
  grant_type?: string;
  country?: string;
  city?: string;
  opens_at?: string;
  deadline?: string;
  funding_range?: string;
  recipients_count?: number | null;
  entry_fee?: number | null;
  sub_categories?: string[];
  caption?: string;
  description?: string;
  featured_image_url?: string;
  routing_type?: string;
  url?: string | null;
  custom_fields?: Array<{ id: string; question: string; inputType: string }>;
  show_badges_in_submission?: boolean;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("opportunities").insert({
    profile_id: user.id,
    title: formData.title.trim().slice(0, 140),
    organiser: formData.organiser?.trim() || "",
    type: formData.type,
    grant_type: formData.grant_type?.trim() || null,
    country: (formData.country || "Global") as "NZ" | "AUS" | "Global",
    city: formData.city?.trim() || null,
    opens_at: formData.opens_at || null,
    description: formData.description?.trim().slice(0, 500) || null,
    caption: formData.caption?.trim().slice(0, 160) || null,
    deadline: formData.deadline || null,
    funding_range: formData.funding_range?.trim() || null,
    recipients_count: formData.recipients_count ?? null,
    entry_fee: formData.entry_fee ?? null,
    sub_categories: formData.sub_categories?.length ? formData.sub_categories : null,
    featured_image_url: formData.featured_image_url?.trim() || null,
    url: formData.url?.trim() || null,
    routing_type: formData.routing_type || "external",
    custom_fields: formData.custom_fields ?? [],
    show_badges_in_submission: formData.show_badges_in_submission ?? true,
    is_active: true,
  });

  if (error) return { error: error.message };
  return {};
}

export async function deleteOpportunity(oppId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", oppId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  return {};
}
