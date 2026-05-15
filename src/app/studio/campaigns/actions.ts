"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createCampaignForSelection } from "@/lib/campaigns";
import { slugify } from "@/lib/slugify";
import QRCode from "qrcode";
import {
  sendCampaignSubmittedToAdmin,
  sendCampaignLiveNotification,
} from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export async function createSelfManagedCampaign(formData: {
  title: string;
  campaign_type: string;
  partner_name?: string;
  campaign_start_date?: string;
  campaign_end_date?: string;
  location_address?: string;
  production_specs?: string;
}): Promise<{ campaignId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    return { error: "Not authorised" };
  }

  // Generate unique slug
  const admin = createAdminClient();
  const base = slugify(formData.title).slice(0, 60) || "campaign";
  let slug = base;
  let attempt = 0;
  while (attempt < 10) {
    const candidate = attempt === 0 ? slug : `${base}-${attempt}`;
    const { data: existing } = await admin
      .from("campaigns")
      .select("id")
      .eq("slug", candidate)
      .eq("artist_profile_id", user.id)
      .maybeSingle();
    if (!existing) { slug = candidate; break; }
    attempt++;
  }
  if (attempt === 10) slug = `${base}-${Date.now()}`;

  const landingUrl = `${SITE_URL}/live/${slug}/${profile.username}`;

  const { data: campaign, error: insertErr } = await admin
    .from("campaigns")
    .insert({
      artist_profile_id: user.id,
      campaign_type: formData.campaign_type,
      title: formData.title,
      slug,
      landing_page_slug: slug,
      partner_name: formData.partner_name || null,
      campaign_start_date: formData.campaign_start_date || null,
      campaign_end_date: formData.campaign_end_date || null,
      location_address: formData.location_address || null,
      production_specs: formData.production_specs || null,
      status: "configuring",
      production_status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !campaign) return { error: insertErr?.message ?? "Failed to create campaign" };

  // Generate QR
  try {
    const pngBuffer: Buffer = await QRCode.toBuffer(landingUrl, {
      type: "png", width: 512, margin: 2, errorCorrectionLevel: "H",
    });
    const storagePath = `${user.id}/${campaign.id}.png`;
    const { error: uploadErr } = await admin.storage
      .from("qr-codes")
      .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });
    if (!uploadErr) {
      const { data: urlData } = admin.storage.from("qr-codes").getPublicUrl(storagePath);
      if (urlData?.publicUrl) {
        await admin.from("campaigns").update({ qr_code_url: urlData.publicUrl }).eq("id", campaign.id);
      }
    }
  } catch {
    // QR generation failed — campaign still created
  }

  revalidatePath("/studio?section=campaigns");
  return { campaignId: campaign.id };
}

export async function updateCampaignConfig(
  campaignId: string,
  updates: {
    title?: string;
    partner_name?: string | null;
    campaign_start_date?: string | null;
    campaign_end_date?: string | null;
    location_address?: string | null;
    venue_contact_name?: string | null;
    venue_contact_email?: string | null;
    venue_contact_phone?: string | null;
    production_specs?: string | null;
    landing_page_config?: Record<string, unknown>;
    status?: string;
    production_status?: string;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("artist_profile_id, status")
    .eq("id", campaignId)
    .single();

  if (!campaign) return { error: "Campaign not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  if ((campaign as { artist_profile_id: string }).artist_profile_id !== user.id && !isAdmin) {
    return { error: "Not authorised" };
  }

  // Detect status transitions to fire email notifications
  const prevStatus = (campaign as { artist_profile_id: string; status?: string }).status;

  const { error } = await supabase
    .from("campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  if (error) return { error: error.message };

  // Fire emails on significant status transitions
  if (updates.status && updates.status !== prevStatus) {
    const admin = createAdminClient();
    const { data: artistAuth } = await admin.auth.admin.getUserById(
      (campaign as { artist_profile_id: string }).artist_profile_id
    );
    const artistEmail = artistAuth?.user?.email;

    if (updates.status === "awaiting_approval" || updates.status === "live") {
      const { data: artistProfile } = await admin
        .from("profiles")
        .select("full_name, username")
        .eq("id", (campaign as { artist_profile_id: string }).artist_profile_id)
        .single();
      const artistName = (artistProfile as { full_name?: string; username?: string } | null)?.full_name
        ?? (artistProfile as { full_name?: string; username?: string } | null)?.username
        ?? "Artist";
      const { data: fullCampaign } = await admin
        .from("campaigns")
        .select("title, slug, landing_page_slug")
        .eq("id", campaignId)
        .single();
      const campaignTitle = (fullCampaign as { title?: string } | null)?.title ?? "your campaign";
      const campaignSlug = (fullCampaign as { slug?: string } | null)?.slug ?? "";
      const artistUsername = (artistProfile as { username?: string } | null)?.username ?? "";
      const landingUrl = `${SITE_URL}/live/${campaignSlug}/${artistUsername}`;

      if (updates.status === "awaiting_approval") {
        sendCampaignSubmittedToAdmin({ artistName, campaignTitle, reviewUrl: `${SITE_URL}/admin/campaigns` }).catch(console.error);
      }
      if (updates.status === "live" && artistEmail) {
        sendCampaignLiveNotification({ artistEmail, artistName, campaignTitle, landingUrl }).catch(console.error);
      }
    }
  }

  revalidatePath(`/studio/campaigns/${campaignId}`);
  revalidatePath("/studio?section=campaigns");
  return {};
}

export async function regenerateCampaignQr(campaignId: string): Promise<{ qrCodeUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("artist_profile_id, slug")
    .eq("id", campaignId)
    .single();

  if (!campaign) return { error: "Campaign not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  const c = campaign as { artist_profile_id: string; slug: string };
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  if (c.artist_profile_id !== user.id && !isAdmin) return { error: "Not authorised" };

  const landingUrl = `${SITE_URL}/live/${c.slug}/${profile?.username}`;
  const admin = createAdminClient();

  try {
    const pngBuffer: Buffer = await QRCode.toBuffer(landingUrl, {
      type: "png", width: 512, margin: 2, errorCorrectionLevel: "H",
    });
    const storagePath = `${user.id}/${campaignId}.png`;
    const { error: uploadErr } = await admin.storage
      .from("qr-codes")
      .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });
    if (uploadErr) return { error: uploadErr.message };
    const { data: urlData } = admin.storage.from("qr-codes").getPublicUrl(storagePath);
    const qrCodeUrl = urlData?.publicUrl;
    if (qrCodeUrl) {
      await admin.from("campaigns").update({ qr_code_url: qrCodeUrl }).eq("id", campaignId);
    }
    revalidatePath(`/studio/campaigns/${campaignId}`);
    return { qrCodeUrl };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Production file tracking ─────────────────────────────────────────────────
// Files are uploaded client-side to the `campaign-files` storage bucket.
// This action records the metadata row in campaign_files.
export async function recordCampaignFile(
  campaignId: string,
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("artist_profile_id")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { error: "Campaign not found" };
  if ((campaign as { artist_profile_id: string }).artist_profile_id !== user.id) {
    return { error: "Not authorised" };
  }

  const { error } = await supabase.from("campaign_files").insert({
    campaign_id: campaignId,
    uploaded_by: user.id,
    file_url: fileUrl,
    file_name: fileName,
    file_type: fileType,
    file_size_bytes: fileSizeBytes,
  });

  if (error) return { error: error.message };
  revalidatePath(`/studio/campaigns/${campaignId}`);
  return {};
}

export async function deleteCampaignFile(
  fileId: string,
  campaignId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("campaign_files")
    .delete()
    .eq("id", fileId)
    .eq("campaign_id", campaignId);

  if (error) return { error: error.message };
  revalidatePath(`/studio/campaigns/${campaignId}`);
  return {};
}

// ── Storefront publish / submit ──────────────────────────────────────────────
export async function publishStorefront(campaignId: string): Promise<{ error?: string }> {
  return updateCampaignConfig(campaignId, { status: "live" });
}

export async function submitForApproval(campaignId: string): Promise<{ error?: string }> {
  return updateCampaignConfig(campaignId, { status: "awaiting_approval" });
}

export async function deleteCampaign(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("artist_profile_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) return { error: "Campaign not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  if ((campaign as { artist_profile_id: string }).artist_profile_id !== user.id && !isAdmin) {
    return { error: "Not authorised" };
  }

  const admin = createAdminClient();

  // Remove QR code from storage (best-effort)
  await admin.storage.from("qr-codes").remove([`${user.id}/${campaignId}.png`]).catch(() => {});

  // Delete campaign (DB cascade handles campaign_files)
  const { error } = await admin.from("campaigns").delete().eq("id", campaignId);
  if (error) return { error: error.message };

  revalidatePath("/studio?section=campaigns");
  return {};
}
