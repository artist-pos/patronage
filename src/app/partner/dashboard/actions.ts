"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendHighResRequest } from "@/lib/email";

export async function updateApplicationStatus(
  applicationId: string,
  status: "pending" | "shortlisted" | "selected" | "approved_pending_assets" | "rejected"
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify partner owns this application's opportunity
  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("id, artist_id, opportunity_id")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Application not found" };

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, title, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  const opp = oppData as { id: string; title: string; profile_id: string | null } | null;
  if (!opp || opp.profile_id !== user.id) return { error: "Not authorised" };

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) return { error: error.message };

  // If approving (status = approved_pending_assets), email the artist
  if (status === "approved_pending_assets") {
    const admin = createAdminClient();
    const { data: { user: artistUser } } = await admin.auth.admin.getUserById(app.artist_id);
    if (artistUser?.email) {
      const { data: artistProfile } = await admin
        .from("profiles")
        .select("full_name, username")
        .eq("id", app.artist_id)
        .single();
      const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
      sendHighResRequest(
        artistUser.email,
        artistName,
        opp.title,
        `${siteUrl}/dashboard?tab=applications`
      ).catch(console.error);
    }
  }

  revalidatePath(`/partner/dashboard/${opp.id}`);
  revalidatePath("/partner/dashboard");
  return {};
}

export async function getSignedAssetUrl(applicationId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("highres_asset_url, opportunity_id")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Not found" };

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  if (!oppData || (oppData as { profile_id: string | null }).profile_id !== user.id) return { error: "Not authorised" };

  const assetPath = (app.highres_asset_url as string | null)
    ?.split("/production-assets/")
    .pop();

  if (!assetPath) return { error: "No asset uploaded" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("production-assets")
    .createSignedUrl(assetPath, 3600);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
