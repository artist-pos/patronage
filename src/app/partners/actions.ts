"use server";

import { createClient } from "@/lib/supabase/server";

export interface SubmissionState {
  success?: boolean;
  error?: string;
}

export async function submitOpportunityAction(
  _prev: SubmissionState,
  formData: FormData
): Promise<SubmissionState> {
  const supabase = await createClient();

  const title = (formData.get("title") as string)?.trim();
  const organiser = (formData.get("organiser") as string)?.trim();
  if (!title || !organiser) return { error: "Title and organiser are required." };

  const deadline = (formData.get("deadline") as string) || null;
  const recipientsRaw = formData.get("recipients_count") as string;
  const subCatsRaw = (formData.get("sub_categories") as string)?.trim();
  const subCategories = subCatsRaw
    ? subCatsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const captionRaw = (formData.get("caption") as string)?.trim();

  const { error } = await supabase.from("opportunity_submissions").insert({
    title,
    organiser,
    caption: captionRaw ? captionRaw.slice(0, 160) : null,
    full_description: (formData.get("full_description") as string)?.trim() || null,
    type: (formData.get("type") as string) || "Grant",
    country: (formData.get("country") as string) || "NZ",
    city: (formData.get("city") as string)?.trim() || null,
    deadline: deadline || null,
    url: (formData.get("url") as string)?.trim() || null,
    funding_range: (formData.get("funding_range") as string)?.trim() || null,
    sub_categories: subCategories,
    featured_image_url: (formData.get("featured_image_url") as string)?.trim() || null,
    grant_type: (formData.get("grant_type") as string)?.trim() || null,
    recipients_count: recipientsRaw ? parseInt(recipientsRaw) : null,
    submitter_email: (formData.get("submitter_email") as string)?.trim() || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}
