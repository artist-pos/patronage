"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EditionType, EditionListingMode } from "@/types/database";
import { mintUniqueLedgerId } from "@/lib/ledger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditionInput {
  id?: string;
  type: EditionType;
  label: string;
  edition_size?: number | null;
  dimensions?: string | null;
  substrate?: string | null;
  price_cents?: number | null;
  currency?: string;
  poa?: boolean;
  listing_mode?: EditionListingMode;
  acquisitionMode?: AcquisitionMode | null;
  listed?: boolean;
  inventory?: number | null;
  sort_order?: number;
}

export interface ExtraEditionInput {
  type: EditionType;
  label: string;
  price_cents: number | null;
  currency: string;
  poa: boolean;
  listing_mode: EditionListingMode;
  listed: boolean;
  edition_size?: number | null;
  dimensions?: string | null;
  substrate?: string | null;
}

type AcquisitionMode = 'buy_now' | 'make_offer' | 'enquire_first';

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getArtwork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  artworkId: string,
  userId: string
) {
  const { data } = await supabase
    .from("artworks")
    .select("id, url, caption, description, title, year, medium, dimensions, creator_id, profile_id, is_available, acquisition_mode")
    .eq("id", artworkId)
    .eq("profile_id", userId)
    .single();
  return data;
}

// Re-sync the artworks row from ALL listed editions.
// is_available = true if any edition is listed.
// price_cents = minimum price across listed editions (for "From X" display).
// listing_mode / acquisition_mode taken from original edition if listed, else first listed.
async function resyncArtworkFromAllEditions(artworkId: string, creatorId: string) {
  const admin = createAdminClient();
  const { data: listedEditions } = await admin
    .from("editions")
    .select("type, price_cents, currency, poa, listing_mode")
    .eq("work_id", artworkId)
    .eq("listed", true)
    .order("sort_order", { ascending: true });

  if (!listedEditions?.length) {
    await admin.from("artworks")
      .update({ is_available: false })
      .eq("id", artworkId)
      .eq("creator_id", creatorId);
    return;
  }

  const prices = listedEditions
    .filter(e => !e.poa && e.price_cents != null)
    .map(e => e.price_cents as number);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const leadEdition = listedEditions.find(e => e.type === 'original') ?? listedEditions[0];
  const mode = leadEdition.listing_mode === 'direct' ? 'buy_now' : 'enquire_first';

  await admin.from("artworks").update({
    is_available: true,
    price_cents: minPrice,
    is_poa: minPrice == null && listedEditions.some(e => e.poa),
    price_currency: (leadEdition.currency ?? 'NZD') as 'NZD' | 'AUD',
    listing_mode: leadEdition.listing_mode === 'direct' ? 'direct_sale' : 'enquire_first',
    acquisition_mode: mode,
  }).eq("id", artworkId).eq("creator_id", creatorId);
}

// Kept for backward compat — delegates to the full re-sync.
async function syncArtworkFromEdition(
  artworkId: string,
  creatorId: string,
  _edition: unknown,
  _extra?: unknown,
) {
  await resyncArtworkFromAllEditions(artworkId, creatorId);
}

// ── Create work with initial edition ─────────────────────────────────────────

export async function createWorkWithEdition(data: {
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
  acquisitionMode?: AcquisitionMode | null;
  forSale?: boolean;
  // Alternative media (video file, audio file, or embed URL)
  video_url?: string | null;
  audio_url?: string | null;
  embed_url?: string | null;
  embed_provider?: string | null;
  edition: {
    price_cents: number | null;
    currency: string;
    poa: boolean;
    listing_mode: EditionListingMode;
    listed: boolean;
    edition_size?: number | null;
    substrate?: string | null;
    inventory?: number | null;
  };
  extraEditions?: ExtraEditionInput[];
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const firstEd = data.edition;
  const isListed = firstEd.listed || (data.extraEditions?.some(e => e.listed) ?? false);
  const mode = data.acquisitionMode
    ?? (firstEd.listing_mode === 'direct' ? 'buy_now' : 'enquire_first');

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
      dimensions: data.dimensions,
      description: data.description,
      medium_category: data.mediumCategory ?? null,
      surface_or_substrate: data.surfaceOrSubstrate ?? null,
      width_mm: data.widthMm ?? null,
      height_mm: data.heightMm ?? null,
      price_cents: firstEd.poa ? null : firstEd.price_cents,
      is_poa: firstEd.poa ?? false,
      price_currency: firstEd.currency ?? 'NZD',
      listing_mode: firstEd.listing_mode === 'direct' ? 'direct_sale' : 'enquire_first',
      acquisition_mode: mode,
      is_available: data.forSale ? isListed : false,
      hide_available: false,
      hide_from_archive: false,
      hide_price: false,
      collection_visible: true,
      hidden_from_artist: false,
      position: 9999,
      source: 'self_registered',
      video_url: data.video_url ?? null,
      audio_url: data.audio_url ?? null,
      embed_url: data.embed_url ?? null,
      embed_provider: data.embed_provider ?? null,
    })
    .select("id, creator_id")
    .single();

  if (artworkError || !artwork) return { error: artworkError?.message ?? "Failed to create work" };

  // Mint ledger ID immediately so edition-provenance cloning has a base ID at sale time
  const ledgerId = await mintUniqueLedgerId(admin);
  await admin.from("artworks").update({ ledger_id: ledgerId }).eq("id", artwork.id);

  const { error: editionError } = await admin.from("editions").insert({
    work_id: artwork.id,
    type: 'original',
    label: 'Original',
    price_cents: firstEd.poa ? null : firstEd.price_cents,
    currency: firstEd.currency,
    poa: firstEd.poa,
    listing_mode: firstEd.listing_mode,
    listed: firstEd.listed,
    edition_size: firstEd.edition_size ?? null,
    substrate: firstEd.substrate ?? null,
    inventory: firstEd.edition_size ?? null,
    sort_order: 0,
  });

  if (editionError) return { error: editionError.message };

  if (data.extraEditions && data.extraEditions.length > 0) {
    const { error: extrasError } = await admin.from("editions").insert(
      data.extraEditions.map((e, i) => ({
        work_id: artwork.id,
        type: e.type,
        label: e.label,
        price_cents: e.poa ? null : e.price_cents,
        currency: e.currency,
        poa: e.poa,
        listing_mode: e.listing_mode,
        listed: e.listed,
        edition_size: e.edition_size ?? null,
        dimensions: e.dimensions ?? null,
        substrate: e.substrate ?? null,
        inventory: e.edition_size ?? null,
        sort_order: i + 1,
      }))
    );
    if (extrasError) return { error: extrasError.message };
  }

  revalidatePath("/studio");
  return { id: artwork.id };
}

// ── Save edition (create or update) ──────────────────────────────────────────

export async function saveEdition(
  artworkId: string,
  input: EditionInput
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const artwork = await getArtwork(supabase, artworkId, user.id);
  if (!artwork) return { error: "Work not found" };

  const admin = createAdminClient();
  const payload = {
    work_id: artworkId,
    type: input.type,
    label: input.label,
    edition_size: input.edition_size ?? null,
    dimensions: input.dimensions ?? null,
    substrate: input.substrate ?? null,
    price_cents: input.poa ? null : (input.price_cents ?? null),
    currency: input.currency ?? 'NZD',
    poa: input.poa ?? false,
    listing_mode: input.listing_mode ?? 'enquire',
    listed: input.listed ?? false,
    inventory: input.inventory ?? null,
    sort_order: input.sort_order ?? 0,
  };

  let id = input.id;

  if (id) {
    const { error } = await admin
      .from("editions")
      .update(payload)
      .eq("id", id)
      .eq("work_id", artworkId);
    if (error) return { error: error.message };
  } else {
    const { data: row, error } = await admin
      .from("editions")
      .insert(payload)
      .select("id")
      .single();
    if (error || !row) return { error: error?.message ?? "Insert failed" };
    id = row.id;
  }

  // Re-sync artwork availability/price from all listed editions
  await resyncArtworkFromAllEditions(artworkId, artwork.creator_id);

  revalidatePath("/studio");
  return { id };
}

// ── Toggle listed ─────────────────────────────────────────────────────────────

export async function toggleEditionListed(
  editionId: string,
  artworkId: string,
  listed: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const artwork = await getArtwork(supabase, artworkId, user.id);
  if (!artwork) return { error: "Work not found" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("editions")
    .update({ listed })
    .eq("id", editionId)
    .eq("work_id", artworkId);

  if (error) return { error: error.message };

  const { data: edition } = await admin
    .from("editions")
    .select("type, price_cents, currency, poa, listing_mode")
    .eq("id", editionId)
    .single();

  await resyncArtworkFromAllEditions(artworkId, artwork.creator_id);

  revalidatePath("/studio");
  return {};
}

// ── Delete edition ────────────────────────────────────────────────────────────

export async function deleteEdition(
  editionId: string,
  artworkId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const artwork = await getArtwork(supabase, artworkId, user.id);
  if (!artwork) return { error: "Work not found" };

  const admin = createAdminClient();
  const { data: edition } = await admin
    .from("editions")
    .select("type")
    .eq("id", editionId)
    .eq("work_id", artworkId)
    .single();

  if (!edition) return { error: "Edition not found" };

  const { error } = await admin
    .from("editions")
    .delete()
    .eq("id", editionId)
    .eq("work_id", artworkId);

  if (error) return { error: error.message };

  // Unlist the artwork when its original edition is deleted
  if (edition.type === 'original') {
    await admin
      .from("artworks")
      .update({ is_available: false })
      .eq("id", artworkId)
      .eq("creator_id", artwork.creator_id);
  }

  revalidatePath("/studio");
  return {};
}

// ── Publish work to For Sale ──────────────────────────────────────────────────

export async function publishWorkToForSale(
  artworkId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: artwork } = await admin
    .from("artworks")
    .select("id, creator_id, profile_id")
    .eq("id", artworkId)
    .eq("profile_id", user.id)
    .single();

  if (!artwork) return { error: "Work not found" };

  const { data: editions } = await admin
    .from("editions")
    .select("*")
    .eq("work_id", artworkId)
    .neq("type", "original")
    .order("sort_order", { ascending: true });

  const ed = editions?.[0];
  if (!ed) return { error: "No non-original editions found on this work." };

  const { error } = await admin
    .from("artworks")
    .update({
      is_available: true,
      price_cents: ed.poa ? null : ed.price_cents,
      is_poa: ed.poa ?? false,
      price_currency: ed.currency ?? 'NZD',
      listing_mode: ed.listing_mode === 'direct' ? 'direct_sale' : 'enquire_first',
      acquisition_mode: ed.listing_mode === 'direct' ? 'buy_now' : 'enquire_first',
    })
    .eq("id", artworkId);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  return {};
}
