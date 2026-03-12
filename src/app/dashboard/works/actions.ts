"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWorkSlug } from "@/lib/slugify";

// ── Slug dedup ───────────────────────────────────────────────────────────────

async function resolveUniqueSlug(
  profileId: string,
  base: string,
  excludeId: string
): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_images")
    .select("slug")
    .eq("profile_id", profileId)
    .neq("id", excludeId)
    .like("slug", `${base}%`);

  const taken = new Set((data ?? []).map((r: { slug: string | null }) => r.slug).filter(Boolean));
  let candidate = base;
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${i}`;
    i++;
  }
  return candidate;
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createPortfolioWork(data: {
  url: string;
  orientation: "landscape" | "portrait" | "square";
  naturalWidth: number;
  naturalHeight: number;
  title: string | null;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  description: string | null;
  position: number;
}): Promise<{ id?: string; slug?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const baseSlug = generateWorkSlug(data.title, data.year);
  let slug: string | null = null;
  if (baseSlug) {
    // Temp placeholder ID for exclude — we use a fake ID; no conflict since work doesn't exist yet
    const { data: existing } = await supabase
      .from("portfolio_images")
      .select("slug")
      .eq("profile_id", user.id)
      .like("slug", `${baseSlug}%`);
    const taken = new Set((existing ?? []).map((r: { slug: string | null }) => r.slug).filter(Boolean));
    let candidate = baseSlug;
    let i = 2;
    while (taken.has(candidate)) { candidate = `${baseSlug}-${i}`; i++; }
    slug = candidate;
  }

  const { data: row, error } = await supabase
    .from("portfolio_images")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      url: data.url,
      orientation: data.orientation,
      natural_width: data.naturalWidth,
      natural_height: data.naturalHeight,
      position: data.position,
      title: data.title || null,
      year: data.year || null,
      medium: data.medium || null,
      dimensions: data.dimensions || null,
      description: data.description || null,
      slug,
    })
    .select("id, slug")
    .single();

  if (error || !row) return { error: error?.message ?? "Insert failed" };

  revalidatePath("/dashboard/works");
  return { id: row.id, slug: row.slug ?? undefined };
}

// ── Update metadata ──────────────────────────────────────────────────────────

export async function updateWorkMetadata(
  workId: string,
  table: "portfolio_images" | "artworks",
  data: {
    title?: string;
    year?: number | null;
    medium?: string;
    dimensions?: string;
    description?: string | null;
  }
): Promise<{ error?: string; slug?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = {
    title: data.title || null,
    year: data.year || null,
    medium: data.medium || null,
    dimensions: data.dimensions || null,
    ...(data.description !== undefined && { description: data.description || null }),
  };

  // Regenerate slug for portfolio_images when title changes
  let newSlug: string | undefined;
  if (table === "portfolio_images" && data.title !== undefined) {
    const base = generateWorkSlug(data.title, data.year ?? null);
    if (base) {
      newSlug = await resolveUniqueSlug(user.id, base, workId);
      updates.slug = newSlug;
    }
  }

  const { error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", workId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/works");
  return { slug: newSlug };
}

// ── Publish as available ─────────────────────────────────────────────────────

export async function publishPortfolioWorkAsAvailable(
  workId: string,
  data: { price: string; currency: "NZD" | "AUD"; poa: boolean; edition: string }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: portfolio, error: fetchError } = await supabase
    .from("portfolio_images")
    .select("id, url, caption, description, title, year, medium, dimensions, linked_artwork_id, creator_id")
    .eq("id", workId)
    .eq("creator_id", user.id)
    .single();

  if (fetchError || !portfolio) return { error: "Work not found" };

  const price = data.poa ? "POA" : data.price;

  if (portfolio.linked_artwork_id) {
    const { error: updateError } = await supabase
      .from("artworks")
      .update({ price, price_currency: data.currency, edition: data.edition || null, is_available: true })
      .eq("id", portfolio.linked_artwork_id)
      .eq("creator_id", user.id);
    if (updateError) return { error: updateError.message };
  } else {
    const { data: newArtwork, error: insertError } = await supabase
      .from("artworks")
      .insert({
        profile_id: portfolio.creator_id,
        creator_id: portfolio.creator_id,
        current_owner_id: portfolio.creator_id,
        url: portfolio.url,
        caption: portfolio.caption,
        description: portfolio.description,
        title: portfolio.title,
        year: portfolio.year,
        medium: portfolio.medium,
        dimensions: portfolio.dimensions,
        edition: data.edition || null,
        price,
        price_currency: data.currency,
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

    if (insertError || !newArtwork) return { error: insertError?.message ?? "Insert failed" };

    const { error: linkError } = await supabase
      .from("portfolio_images")
      .update({ linked_artwork_id: newArtwork.id })
      .eq("id", workId)
      .eq("creator_id", user.id);

    if (linkError) return { error: linkError.message };
  }

  revalidatePath("/dashboard/works");
  return {};
}

// ── Unpublish ────────────────────────────────────────────────────────────────

export async function unpublishPortfolioWork(workId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: portfolio } = await supabase
    .from("portfolio_images")
    .select("linked_artwork_id")
    .eq("id", workId)
    .eq("creator_id", user.id)
    .single();

  if (!portfolio?.linked_artwork_id) return {};

  const { error } = await supabase
    .from("artworks")
    .update({ is_available: false })
    .eq("id", portfolio.linked_artwork_id)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/works");
  return {};
}
