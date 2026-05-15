"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EditionType, EditionListingMode } from "@/types/database";

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
  listed?: boolean;
  inventory?: number | null;
  sort_order?: number;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getWork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workId: string,
  userId: string
) {
  const { data } = await supabase
    .from("portfolio_images")
    .select("id, url, caption, description, title, year, medium, dimensions, linked_artwork_id, creator_id, profile_id")
    .eq("id", workId)
    .eq("profile_id", userId)
    .single();
  return data;
}

type AcquisitionMode = 'buy_now' | 'make_offer' | 'enquire_first';

interface ArtworkExtra {
  acquisitionMode?: AcquisitionMode | null;
  mediumCategory?: string[] | null;
  surfaceOrSubstrate?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
}

// ── Artworks sync ─────────────────────────────────────────────────────────────
// Keeps the artworks table in sync with the original edition until steps 4–7
// migrate the display code to read from editions directly.

async function syncArtworks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  work: NonNullable<Awaited<ReturnType<typeof getWork>>>,
  edition: Pick<EditionInput, 'price_cents' | 'currency' | 'poa' | 'listing_mode' | 'listed'>,
  extra?: ArtworkExtra,
) {
  const admin = createAdminClient();
  const isListed = edition.listed ?? false;
  const mode = extra?.acquisitionMode ?? null;
  const artworkPayload: Record<string, unknown> = {
    price_cents: edition.poa ? null : (edition.price_cents ?? null),
    is_poa: edition.poa ?? false,
    price_currency: edition.currency ?? 'NZD',
    listing_mode: edition.listing_mode === 'direct' ? 'direct_sale' : 'enquire_first',
    acquisition_mode: mode ?? (edition.listing_mode === 'direct' ? 'buy_now' : 'enquire_first'),
    is_available: isListed,
  };

  if (work.linked_artwork_id) {
    await admin
      .from("artworks")
      .update(artworkPayload)
      .eq("id", work.linked_artwork_id)
      .eq("creator_id", work.creator_id);
  } else if (isListed) {
    const { data: newArtwork, error: insertError } = await admin
      .from("artworks")
      .insert({
        profile_id: work.creator_id,
        creator_id: work.creator_id,
        current_owner_id: work.creator_id,
        url: work.url,
        caption: work.caption,
        description: work.description,
        title: work.title,
        year: work.year,
        medium: work.medium,
        dimensions: work.dimensions,
        medium_category: extra?.mediumCategory ?? null,
        surface_or_substrate: extra?.surfaceOrSubstrate ?? null,
        width_mm: extra?.widthMm ?? null,
        height_mm: extra?.heightMm ?? null,
        ...artworkPayload,
        hide_available: false,
        hide_from_archive: false,
        hide_price: false,
        collection_visible: true,
        hidden_from_artist: false,
        position: 0,
      })
      .select("id")
      .single();

    if (insertError) console.error("[syncArtworks] insert failed:", insertError.message);

    if (newArtwork) {
      await admin
        .from("portfolio_images")
        .update({ linked_artwork_id: newArtwork.id })
        .eq("id", work.id)
        .eq("creator_id", work.creator_id);
    }
  }
}

// ── Create work with initial edition (used by NewWorkClient) ──────────────────

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

  const { data: work, error: workError } = await admin
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
      hide_from_archive: data.forSale ? true : false,
      position: 9999,
    })
    .select("id, url, caption, description, title, year, medium, dimensions, linked_artwork_id, creator_id, profile_id")
    .single();

  if (workError || !work) return { error: workError?.message ?? "Failed to create work" };

  const { error: editionError } = await admin.from("editions").insert({
    work_id: work.id,
    type: 'original',
    label: 'Original',
    price_cents: data.edition.poa ? null : data.edition.price_cents,
    currency: data.edition.currency,
    poa: data.edition.poa,
    listing_mode: data.edition.listing_mode,
    listed: data.edition.listed,
    edition_size: data.edition.edition_size ?? null,
    substrate: data.edition.substrate ?? null,
    inventory: data.edition.edition_size ?? null,
    sort_order: 0,
  });

  if (editionError) return { error: editionError.message };

  if (data.extraEditions && data.extraEditions.length > 0) {
    const { error: extrasError } = await admin.from("editions").insert(
      data.extraEditions.map((e, i) => ({
        work_id: work.id,
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

  // For sale mode: always create the artworks row using the first listed edition
  if (data.forSale) {
    const firstListed =
      (data.edition.listed ? data.edition : null) ??
      data.extraEditions?.find((e) => e.listed);

    if (firstListed) {
      const { data: newArtwork, error: artErr } = await admin
        .from("artworks")
        .insert({
          profile_id: user.id,
          creator_id: user.id,
          current_owner_id: user.id,
          url: work.url,
          caption: work.caption,
          description: work.description,
          title: work.title,
          year: work.year,
          medium: work.medium,
          dimensions: work.dimensions,
          medium_category: data.mediumCategory ?? null,
          surface_or_substrate: data.surfaceOrSubstrate ?? null,
          width_mm: data.widthMm ?? null,
          height_mm: data.heightMm ?? null,
          price_cents: firstListed.poa ? null : firstListed.price_cents,
          is_poa: firstListed.poa ?? false,
          price_currency: firstListed.currency ?? 'NZD',
          listing_mode: firstListed.listing_mode === 'direct' ? 'direct_sale' : 'enquire_first',
          acquisition_mode: data.acquisitionMode ?? (firstListed.listing_mode === 'direct' ? 'buy_now' : 'enquire_first'),
          is_available: true,
          hide_available: false,
          hide_from_archive: false,
          hide_price: false,
          collection_visible: true,
          hidden_from_artist: false,
          position: 0,
        })
        .select("id")
        .single();

      if (artErr) return { error: artErr.message };

      if (newArtwork) {
        await admin
          .from("portfolio_images")
          .update({ linked_artwork_id: newArtwork.id })
          .eq("id", work.id);
      }
    }
  } else {
    const meta = {
      acquisitionMode: data.acquisitionMode ?? null,
      mediumCategory: data.mediumCategory,
      surfaceOrSubstrate: data.surfaceOrSubstrate,
      widthMm: data.widthMm ?? null,
      heightMm: data.heightMm ?? null,
    };
    if (data.edition.listed) {
      await syncArtworks(supabase, work, data.edition, meta);
    }
  }

  revalidatePath("/studio");
  return { id: work.id };
}

// ── Save edition (create or update) ──────────────────────────────────────────

export async function saveEdition(
  workId: string,
  input: EditionInput
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const work = await getWork(supabase, workId, user.id);
  if (!work) return { error: "Work not found" };

  const payload = {
    work_id: workId,
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
    const { error } = await supabase
      .from("editions")
      .update(payload)
      .eq("id", id)
      .eq("work_id", workId);
    if (error) return { error: error.message };
  } else {
    const { data: row, error } = await supabase
      .from("editions")
      .insert(payload)
      .select("id")
      .single();
    if (error || !row) return { error: error?.message ?? "Insert failed" };
    id = row.id;
  }

  if (input.type === 'original') {
    await syncArtworks(supabase, work, payload);
  }

  revalidatePath("/studio");
  return { id };
}

// ── Toggle listed (immediate, no full form save) ──────────────────────────────

export async function toggleEditionListed(
  editionId: string,
  workId: string,
  listed: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const work = await getWork(supabase, workId, user.id);
  if (!work) return { error: "Work not found" };

  const { error } = await supabase
    .from("editions")
    .update({ listed })
    .eq("id", editionId)
    .eq("work_id", workId);

  if (error) return { error: error.message };

  const { data: edition } = await supabase
    .from("editions")
    .select("type, price_cents, currency, poa, listing_mode")
    .eq("id", editionId)
    .single();

  if (edition?.type === 'original') {
    await syncArtworks(supabase, work, { ...edition, listed });
  } else if (edition && listed && !work.linked_artwork_id) {
    // Non-original edition being listed for the first time — create the artworks row
    await syncArtworks(supabase, work, { ...edition, listed });
  }

  revalidatePath("/studio");
  return {};
}

// ── Delete edition ────────────────────────────────────────────────────────────

export async function deleteEdition(
  editionId: string,
  workId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const work = await getWork(supabase, workId, user.id);
  if (!work) return { error: "Work not found" };

  const { data: edition } = await supabase
    .from("editions")
    .select("type")
    .eq("id", editionId)
    .eq("work_id", workId)
    .single();

  if (!edition) return { error: "Edition not found" };

  const { error } = await supabase
    .from("editions")
    .delete()
    .eq("id", editionId)
    .eq("work_id", workId);

  if (error) return { error: error.message };

  // Unlist the artworks row when the original edition is deleted
  if (edition.type === 'original' && work.linked_artwork_id) {
    await supabase
      .from("artworks")
      .update({ is_available: false })
      .eq("id", work.linked_artwork_id)
      .eq("creator_id", work.creator_id);
  }

  revalidatePath("/studio");
  return {};
}

// ── Publish work to For Sale (bypasses RLS entirely via admin client) ──────────

export async function publishWorkToForSale(
  workId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: work } = await admin
    .from("portfolio_images")
    .select("id, url, caption, description, title, year, medium, dimensions, linked_artwork_id, creator_id, profile_id")
    .eq("id", workId)
    .eq("profile_id", user.id)
    .single();

  if (!work) return { error: "Work not found" };

  const { data: editions } = await admin
    .from("editions")
    .select("*")
    .eq("work_id", workId)
    .neq("type", "original")
    .order("sort_order", { ascending: true });

  const ed = editions?.[0];
  if (!ed) return { error: "No non-original editions found on this work." };

  if (work.linked_artwork_id) {
    const { error } = await admin
      .from("artworks")
      .update({ is_available: true })
      .eq("id", work.linked_artwork_id);
    if (error) return { error: error.message };
  } else {
    const { data: newArtwork, error: insertError } = await admin
      .from("artworks")
      .insert({
        profile_id: work.creator_id,
        creator_id: work.creator_id,
        current_owner_id: work.creator_id,
        url: work.url,
        caption: work.caption,
        description: work.description,
        title: work.title,
        year: work.year,
        medium: work.medium,
        dimensions: work.dimensions,
        price_cents: ed.poa ? null : ed.price_cents,
        is_poa: ed.poa ?? false,
        price_currency: ed.currency ?? 'NZD',
        listing_mode: ed.listing_mode === 'direct' ? 'direct_sale' : 'enquire_first',
        acquisition_mode: ed.listing_mode === 'direct' ? 'buy_now' : 'enquire_first',
        is_available: true,
        hide_available: false,
        hide_from_archive: false,
        hide_price: false,
        collection_visible: true,
        hidden_from_artist: false,
        position: 0,
      })
      .select("id")
      .single();

    if (insertError) return { error: insertError.message };

    if (newArtwork) {
      await admin
        .from("portfolio_images")
        .update({ linked_artwork_id: newArtwork.id })
        .eq("id", work.id);
    }
  }

  revalidatePath("/studio");
  return {};
}
