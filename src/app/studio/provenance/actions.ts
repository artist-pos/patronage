"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateDirectTransfer } from "@/app/dashboard/provenance-actions";
import type { EditionListingMode } from "@/types/database";
import type { ExtraEditionInput } from "@/app/studio/works/edition-actions";

export async function saveCertificateNote(
  artworkId: string,
  note: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("artworks")
    .update({ certificate_note: note.trim() || null })
    .eq("id", artworkId)
    .eq("creator_id", user.id);

  return error ? { error: error.message } : {};
}

export async function logSaleAndTransfer(data: {
  title: string;
  medium?: string | null;
  dimensions?: string | null;
  year?: number | null;
  imageUrl?: string | null;
  buyerName: string;
  buyerEmail: string;
  price?: number | null;
  notes?: string | null;
}): Promise<{ error?: string; ledgerId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    return { error: "Only artists can log a sale." };
  }

  const admin = createAdminClient();

  const { data: artwork, error: insertError } = await admin
    .from("artworks")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      title: data.title.trim(),
      caption: data.title.trim(),
      medium: data.medium ?? null,
      dimensions: data.dimensions ?? null,
      year: data.year ?? null,
      url: data.imageUrl ?? null,
      content_type: "image",
      is_available: true,
      hide_available: false,
      hide_price: false,
      price: null,
      price_currency: "NZD",
      position: 0,
    })
    .select("id")
    .single();

  if (insertError || !artwork) return { error: insertError?.message ?? "Failed to create artwork." };

  return initiateDirectTransfer(
    artwork.id,
    data.buyerName.trim(),
    data.buyerEmail.trim(),
    data.price ?? null,
    data.notes?.trim() || null,
  );
}

export async function createAndTransferWork(data: {
  url: string;
  title: string | null;
  year: number | null;
  medium: string | null;
  mediumCategory: string[] | null;
  surfaceOrSubstrate: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  dimensions: string | null;
  description: string | null;
  originalEdition: {
    price_cents: number | null;
    currency: string;
    poa: boolean;
    listing_mode: EditionListingMode;
  };
  extraEditions: ExtraEditionInput[];
  buyerName: string;
  buyerEmail: string;
  salePrice?: number | null;
  notes?: string | null;
}): Promise<{ workId?: string; ledgerId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    return { error: "Only artists can log a sale." };
  }

  const admin = createAdminClient();

  // 1. Create portfolio_images record
  const { data: portfolioImage, error: piError } = await admin
    .from("portfolio_images")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      url: data.url,
      caption: data.title,
      title: data.title,
      year: data.year,
      medium: data.medium,
      dimensions: data.dimensions,
      description: data.description,
      is_available: false,
      position: 9999,
    })
    .select("id")
    .single();

  if (piError || !portfolioImage) return { error: piError?.message ?? "Failed to create work." };

  // 2. Create artworks record (is_available: true so initiateDirectTransfer can pick it up)
  const { data: artwork, error: artworkError } = await admin
    .from("artworks")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      url: data.url,
      caption: data.title,
      title: data.title,
      year: data.year,
      medium: data.medium,
      medium_category: data.mediumCategory ?? null,
      surface_or_substrate: data.surfaceOrSubstrate || null,
      width_mm: data.widthMm ?? null,
      height_mm: data.heightMm ?? null,
      dimensions: data.dimensions,
      description: data.description,
      content_type: "image",
      is_available: true,
      hide_available: false,
      hide_price: false,
      price: null,
      price_currency: data.originalEdition.currency,
      position: 0,
    })
    .select("id")
    .single();

  if (artworkError || !artwork) return { error: artworkError?.message ?? "Failed to create artwork record." };

  // 3. Link portfolio_images → artworks
  await admin
    .from("portfolio_images")
    .update({ linked_artwork_id: artwork.id })
    .eq("id", portfolioImage.id);

  // 4. Create editions
  const editionRows = [
    {
      work_id: portfolioImage.id,
      type: "original" as const,
      label: "Original",
      price_cents: data.originalEdition.poa ? null : data.originalEdition.price_cents,
      currency: data.originalEdition.currency,
      poa: data.originalEdition.poa,
      listing_mode: data.originalEdition.listing_mode,
      listed: false,
      sort_order: 0,
    },
    ...data.extraEditions.map((e, i) => ({
      work_id: portfolioImage.id,
      type: e.type,
      label: e.label,
      price_cents: e.poa ? null : e.price_cents,
      currency: e.currency ?? "NZD",
      poa: e.poa ?? false,
      listing_mode: e.listing_mode ?? "enquire",
      listed: e.listed ?? false,
      sort_order: i + 1,
    })),
  ];

  const { error: editionError } = await admin.from("editions").insert(editionRows);
  if (editionError) return { error: editionError.message };

  // 5. Transfer ownership + send certificate
  const result = await initiateDirectTransfer(
    artwork.id,
    data.buyerName.trim(),
    data.buyerEmail.trim(),
    data.salePrice ?? null,
    data.notes?.trim() || null,
  );

  return { ...result, workId: portfolioImage.id };
}
