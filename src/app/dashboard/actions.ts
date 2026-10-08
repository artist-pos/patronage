"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function toggleSaveOpportunity(
  opportunityId: string
): Promise<{ saved: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "Not authenticated" };

  // Check if already saved
  const { data: existing } = await supabase
    .from("user_saved_opportunities")
    .select("id")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .single();

  if (existing) {
    await supabase
      .from("user_saved_opportunities")
      .delete()
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId);
    revalidatePath("/dashboard");
    revalidatePath("/opportunities");
    return { saved: false };
  } else {
    await supabase
      .from("user_saved_opportunities")
      .insert({ user_id: user.id, opportunity_id: opportunityId, status: "saved" });
    revalidatePath("/dashboard");
    revalidatePath("/opportunities");
    return { saved: true };
  }
}

export async function markApplied(opportunityId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_saved_opportunities")
    .upsert(
      { user_id: user.id, opportunity_id: opportunityId, status: "applied" },
      { onConflict: "user_id,opportunity_id" }
    );

  revalidatePath("/dashboard");
  revalidatePath("/studio/opportunities");
  return {};
}

export async function submitHighResAsset(
  applicationId: string,
  assetUrl: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the application belongs to this user
  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (!app || app.artist_id !== user.id) return { error: "Not authorised" };
  // Only once the organiser has asked for the file (and told them so).
  if ((app.status as string) !== "approved_pending_assets") return { error: "No file has been requested for this application." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("opportunity_applications")
    .update({ highres_asset_url: assetUrl, status: "production_ready", released_at: now })
    .eq("id", applicationId);
  if (error) return { error: error.message };

  // The artist has done their part: the organiser's working decision follows. They can't write
  // decisions themselves, so this goes through the server.
  const admin = createAdminClient();
  await admin
    .from("application_decisions")
    .upsert(
      { application_id: applicationId, opportunity_id: app.opportunity_id as string, status: "production_ready", updated_at: now },
      { onConflict: "application_id" },
    );

  revalidatePath("/dashboard");
  revalidatePath("/studio/opportunities");
  return {};
}

export async function verifyProvenanceLink(linkId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: link } = await supabase
    .from("provenance_links")
    .select("id, artwork_id, patron_id")
    .eq("id", linkId)
    .eq("patron_id", user.id)
    .single();

  if (!link) return { error: "Link not found." };

  const [{ error: linkErr }, { error: artworkErr }] = await Promise.all([
    supabase.from("provenance_links").update({ status: "verified" }).eq("id", linkId),
    supabase.from("artworks").update({ current_owner_id: user.id }).eq("id", link.artwork_id),
  ]);

  if (linkErr) return { error: linkErr.message };
  if (artworkErr) return { error: artworkErr.message };

  // Add to patron's acquired_works array
  const { data: profile } = await supabase
    .from("profiles")
    .select("acquired_works")
    .eq("id", user.id)
    .single();

  const current = (profile?.acquired_works ?? []) as string[];
  if (!current.includes(link.artwork_id)) {
    await supabase
      .from("profiles")
      .update({ acquired_works: [...current, link.artwork_id] })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard");
  return {};
}

export async function declineProvenanceLink(linkId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("provenance_links")
    .delete()
    .eq("id", linkId)
    .eq("patron_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}
