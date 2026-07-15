import { createClient } from "@/lib/supabase/server";
import type { ArtworkForGrid, EditionOption } from "@/components/feed/WorksJustifiedGrid";

const WORK_SELECT =
  "id, url, thumb_url, title, caption, description, year, dimensions, ledger_id, price_cents, is_poa, price_currency, medium, hide_price, listing_mode, acquisition_mode, location_text, show_location_publicly, created_at, profile:profiles!profile_id(id, username, full_name, avatar_url)";

export type WorksSort = "recent" | "price_asc" | "price_desc";

/**
 * Fetch available marketplace works for the justified grid plus the list of
 * medium facets. Shared by the /works browse page and the Explore "works" tab
 * so the query lives in one place.
 */
export async function getAvailableWorksForGrid(opts: {
  medium?: string;
  sort?: WorksSort;
}): Promise<{ artworks: ArtworkForGrid[]; mediumOptions: string[] }> {
  const { medium, sort = "recent" } = opts;
  const supabase = await createClient();

  let q = supabase
    .from("artworks")
    .select(WORK_SELECT)
    .eq("is_available", true)
    .eq("hide_available", false);

  if (medium) q = (q as typeof q).contains("medium_category", [medium]);

  if (sort === "price_asc") {
    q = (q as typeof q)
      .order("price_cents", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  } else if (sort === "price_desc") {
    q = (q as typeof q)
      .order("price_cents", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  } else {
    q = (q as typeof q).order("created_at", { ascending: false });
  }

  const [artworksRes, mediumsRes] = await Promise.all([
    q,
    supabase
      .from("artworks")
      .select("medium_category")
      .eq("is_available", true)
      .eq("hide_available", false)
      .not("medium_category", "is", null),
  ]);

  const artworkRows = artworksRes.data ?? [];
  const artworkIds = artworkRows.map((a: { id: string }) => a.id);

  const editionsRes =
    artworkIds.length > 0
      ? await supabase
          .from("editions")
          .select("id, work_id, label, type, price_cents, currency, poa, listing_mode, listed, sort_order, dimensions")
          .in("work_id", artworkIds)
          .eq("listed", true)
      : { data: [] };

  const editionsByWork = new Map<string, EditionOption[]>();
  for (const ed of editionsRes.data ?? []) {
    const key = (ed as { work_id: string }).work_id;
    if (!editionsByWork.has(key)) editionsByWork.set(key, []);
    editionsByWork.get(key)!.push({
      id: (ed as { id: string }).id,
      label: (ed as { label: string | null }).label ?? "",
      type: (ed as { type: string | null }).type ?? "",
      price_cents: (ed as { price_cents: number | null }).price_cents,
      currency: ((ed as { currency: string | null }).currency) ?? "NZD",
      poa: (ed as { poa: boolean | null }).poa ?? false,
      listing_mode: (ed as { listing_mode: string | null }).listing_mode ?? "",
      listed: (ed as { listed: boolean | null }).listed ?? false,
      sort_order: (ed as { sort_order: number | null }).sort_order ?? 0,
      dimensions: (ed as { dimensions: string | null }).dimensions,
    });
  }

  const artworks = artworkRows.map((a: Record<string, unknown>) => ({
    ...a,
    editions: editionsByWork.get(a.id as string) ?? [],
  })) as unknown as ArtworkForGrid[];

  const mediumOptions = [
    ...new Set(
      (mediumsRes.data ?? [])
        .flatMap((r: { medium_category: string[] | null }) => r.medium_category ?? [])
        .filter(Boolean)
    ),
  ].sort() as string[];

  return { artworks, mediumOptions };
}
