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
    .from("artworks")
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
  contentType?: string;
  audioUrl?: string;
  videoUrl?: string;
  textContent?: string;
  embedUrl?: string;
  embedProvider?: string;
  collaboratorIds?: string[];
}): Promise<{ id?: string; slug?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const baseSlug = generateWorkSlug(data.title, data.year);
  let slug: string | null = null;
  if (baseSlug) {
    const { data: existing } = await supabase
      .from("artworks")
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
    .from("artworks")
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
      is_available: false,
      hide_from_archive: false,
      hide_available: false,
      hide_price: false,
      collection_visible: true,
      source: 'self_registered',
      ...(data.contentType && data.contentType !== "image" && { content_type: data.contentType }),
      ...(data.audioUrl && { audio_url: data.audioUrl }),
      ...(data.videoUrl && { video_url: data.videoUrl }),
      ...(data.textContent && { text_content: data.textContent }),
      ...(data.embedUrl && { embed_url: data.embedUrl }),
      ...(data.embedProvider && { embed_provider: data.embedProvider }),
      ...(data.collaboratorIds?.length && { collaborator_ids: data.collaboratorIds }),
    })
    .select("id, slug")
    .single();

  if (error || !row) return { error: error?.message ?? "Insert failed" };

  revalidatePath("/studio");
  return { id: row.id, slug: row.slug ?? undefined };
}

// ── Update metadata ──────────────────────────────────────────────────────────

export async function updateWorkMetadata(
  workId: string,
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

  let newSlug: string | undefined;
  if (data.title !== undefined) {
    const base = generateWorkSlug(data.title, data.year ?? null);
    if (base) {
      newSlug = await resolveUniqueSlug(user.id, base, workId);
      updates.slug = newSlug;
    }
  }

  const { error } = await supabase
    .from("artworks")
    .update(updates)
    .eq("id", workId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  return { slug: newSlug };
}

// ── Publish as available ─────────────────────────────────────────────────────

export async function publishPortfolioWorkAsAvailable(
  workId: string,
  data: { price_cents: number | null; currency: "NZD" | "AUD"; is_poa: boolean; edition: string; listingMode?: "direct_sale" | "enquire_first" }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updatePayload: Record<string, unknown> = {
    price_cents: data.is_poa ? null : data.price_cents,
    is_poa: data.is_poa,
    price_currency: data.currency,
    is_available: true,
  };
  if (data.listingMode) updatePayload.listing_mode = data.listingMode;

  const { error } = await supabase
    .from("artworks")
    .update(updatePayload)
    .eq("id", workId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  return {};
}

// ── Set primary image ─────────────────────────────────────────────────────────

export async function setPrimaryWorkImageUrl(
  artworkId: string,
  newPrimaryUrl: string,
  dimensions?: { naturalWidth: number; naturalHeight: number },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [updateResult, profileResult] = await Promise.all([
    supabase
      .from("artworks")
      .update({
        url: newPrimaryUrl,
        ...(dimensions && {
          natural_width: dimensions.naturalWidth,
          natural_height: dimensions.naturalHeight,
        }),
      })
      .eq("id", artworkId)
      .eq("creator_id", user.id),
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single(),
  ]);

  if (updateResult.error) return { error: updateResult.error.message };

  revalidatePath("/studio");
  if (profileResult.data?.username) {
    revalidatePath(`/${profileResult.data.username}`);
  }
  return {};
}

// ── Unpublish ────────────────────────────────────────────────────────────────

export async function unpublishPortfolioWork(workId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("artworks")
    .update({ is_available: false })
    .eq("id", workId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  return {};
}
