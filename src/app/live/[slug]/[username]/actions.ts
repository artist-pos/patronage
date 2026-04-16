"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignEnquiryNotification } from "@/lib/email";

export async function sendCampaignEnquiry(opts: {
  campaignId: string;
  visitorName: string;
  visitorEmail: string;
  message: string;
  workTitle: string | null;
}): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("title, artist_profile_id, slug")
    .eq("id", opts.campaignId)
    .single();

  if (!campaign) return { error: "Campaign not found" };

  // Fetch artist email from auth
  let artistEmail: string | undefined;
  let artistName = "Artist";
  try {
    const { data: { user } } = await admin.auth.admin.getUserById(
      (campaign as { artist_profile_id: string }).artist_profile_id
    );
    artistEmail = user?.email;
    const { data: artistProfile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", (campaign as { artist_profile_id: string }).artist_profile_id)
      .single();
    artistName = (artistProfile as { full_name?: string | null; username?: string } | null)?.full_name
      ?? (artistProfile as { full_name?: string | null; username?: string } | null)?.username
      ?? "Artist";
  } catch {
    // continue without email
  }

  if (artistEmail) {
    sendCampaignEnquiryNotification({
      artistEmail,
      artistName,
      workTitle: opts.workTitle ?? "their campaign",
      visitorName: opts.visitorName,
      visitorEmail: opts.visitorEmail,
      message: opts.message,
      campaignTitle: (campaign as { title: string }).title,
    }).catch(console.error);
  }

  return {};
}
