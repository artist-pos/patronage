import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slugify";
import QRCode from "qrcode";
import { sendCampaignSelectedNotification } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function oppTypeToCampaignType(oppType: string): string {
  switch (oppType) {
    case "Display":
    case "Public Art":
      return "exhibition";
    default:
      return "other";
  }
}

/** Generate a unique campaign slug: <opp-slug>-<artist-username> */
async function generateCampaignSlug(
  admin: ReturnType<typeof createAdminClient>,
  baseTitle: string,
  artistProfileId: string
): Promise<string> {
  const base = slugify(baseTitle).slice(0, 60);
  let candidate = base;
  let attempt = 0;
  while (attempt < 10) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt}`;
    const { data } = await admin
      .from("campaigns")
      .select("id")
      .eq("slug", slug)
      .eq("artist_profile_id", artistProfileId)
      .maybeSingle();
    if (!data) return slug;
    attempt++;
  }
  // Fallback: append timestamp
  return `${base}-${Date.now()}`;
}

/**
 * Auto-create a campaign + QR code when an artist is selected for a pipeline opportunity.
 * Idempotent: if a campaign already exists for this artist + opportunity, returns its id.
 */
export async function createCampaignForSelection(opts: {
  artistProfileId: string;
  artistUsername: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityType: string;
  applicationId: string;
}): Promise<{ campaignId?: string; error?: string }> {
  const admin = createAdminClient();

  // Idempotency check
  const { data: existing } = await admin
    .from("campaigns")
    .select("id, qr_code_url")
    .eq("artist_profile_id", opts.artistProfileId)
    .eq("opportunity_id", opts.opportunityId)
    .maybeSingle();

  if (existing) return { campaignId: existing.id };

  const slug = await generateCampaignSlug(admin, opts.opportunityTitle, opts.artistProfileId);
  const landingUrl = `${SITE_URL}/live/${slug}/${opts.artistUsername}`;
  const campaignType = oppTypeToCampaignType(opts.opportunityType);

  // Insert campaign row (qr_code_url filled in after upload)
  const { data: campaign, error: insertErr } = await admin
    .from("campaigns")
    .insert({
      artist_profile_id: opts.artistProfileId,
      opportunity_id: opts.opportunityId,
      application_id: opts.applicationId,
      campaign_type: campaignType,
      title: opts.opportunityTitle,
      slug,
      landing_page_slug: slug,
      status: "configuring",
      production_status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !campaign) {
    return { error: insertErr?.message ?? "Failed to create campaign" };
  }

  // Generate QR code PNG buffer
  let qrCodeUrl: string | undefined;
  try {
    const pngBuffer: Buffer = await QRCode.toBuffer(landingUrl, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    const storagePath = `${opts.artistProfileId}/${campaign.id}.png`;
    const { error: uploadErr } = await admin.storage
      .from("qr-codes")
      .upload(storagePath, pngBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (!uploadErr) {
      const { data: urlData } = admin.storage
        .from("qr-codes")
        .getPublicUrl(storagePath);
      qrCodeUrl = urlData?.publicUrl;
    }
  } catch {
    // QR generation failed — campaign still created, qr_code_url stays null
  }

  if (qrCodeUrl) {
    await admin
      .from("campaigns")
      .update({ qr_code_url: qrCodeUrl })
      .eq("id", campaign.id);
  }

  // Notify the artist they've been selected
  try {
    const { data: { user: artistUser } } = await admin.auth.admin.getUserById(opts.artistProfileId);
    if (artistUser?.email) {
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
      sendCampaignSelectedNotification({
        artistEmail: artistUser.email,
        artistName: opts.artistUsername,
        opportunityTitle: opts.opportunityTitle,
        studioUrl: `${SITE_URL}/studio?tab=campaigns`,
      }).catch(console.error);
    }
  } catch {
    // email failure must not block campaign creation
  }

  return { campaignId: campaign.id };
}
