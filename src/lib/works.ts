import { createClient } from "@/lib/supabase/server";
import type { ArtworkForGrid, EditionOption } from "@/components/feed/WorksJustifiedGrid";
import { getSellableSellerIds } from "@/lib/commerce/eligibility";

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

  // Only works whose seller can actually be paid (Verified + Stripe enabled);
  // anything else would dead-end at checkout.
  // Both lookups need only the fetched ids, so they run side by side; editions
  // for works that get filtered out are simply never read.
  const allRows = (artworksRes.data ?? []) as unknown as { id: string; profile: { id: string } | null }[];
  const allIds = allRows.map((a) => a.id);
  const [sellable, editionsRes] = await Promise.all([
    getSellableSellerIds(allRows.map((a) => a.profile?.id ?? "")),
    allIds.length > 0
      ? supabase
          .from("editions")
          .select("id, work_id, label, type, price_cents, currency, poa, listing_mode, listed, sort_order, dimensions")
          .in("work_id", allIds)
          .eq("listed", true)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const artworkRows = allRows.filter((a) => a.profile && sellable.has(a.profile.id));

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

  const artworks = artworkRows.map((a) => ({
    ...a,
    editions: editionsByWork.get(a.id) ?? [],
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
