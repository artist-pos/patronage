"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { ALL_COUNTRIES } from "@/lib/constants/countries";
import type { CountryEnum } from "@/types/database";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

// Country drives the Artists page tiers (NZ/AUS = directory, everything else =
// International) — admins set it by hand when an artist never picked one.
export async function setArtistCountry(id: string, country: string | null) {
  await guard();
  const value = country && (ALL_COUNTRIES as readonly string[]).includes(country)
    ? (country as CountryEnum)
    : null;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ country: value }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/artists");
  revalidatePath("/artists");
  revalidatePath("/[username]", "page");
  return {};
}

export type ArtistLocationTarget =
  | { type: "city"; cityId: string }
  | { type: "region"; regionId: string }
  | null;

// Sets the structured location (migration 182) by hand. A town carries its own
// region; a region alone places someone who lives somewhere the taxonomy does
// not list. The freeform text the artist typed is left alone unless a town is
// chosen, in which case it follows the town like the artist-facing picker does.
export async function setArtistLocation(id: string, target: ArtistLocationTarget) {
  await guard();
  const supabase = await createClient();

  let patch: { city_id: string | null; region_id: string | null; city?: string; location_needs_review: boolean };
  if (!target) {
    patch = { city_id: null, region_id: null, location_needs_review: false };
  } else if (target.type === "city") {
    const { data: city } = await supabase
      .from("cities")
      .select("id, name, region_id")
      .eq("id", target.cityId)
      .maybeSingle();
    if (!city) return { error: "Town not found." };
    patch = { city_id: city.id, region_id: city.region_id, city: city.name, location_needs_review: false };
  } else {
    const { data: region } = await supabase
      .from("regions")
      .select("id")
      .eq("id", target.regionId)
      .maybeSingle();
    if (!region) return { error: "Region not found." };
    patch = { city_id: null, region_id: region.id, location_needs_review: false };
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/artists");
  revalidatePath("/artists");
  revalidatePath("/artists/[slug]", "page");
  revalidatePath("/[username]", "page");
  return {};
}

export async function toggleArtistActive(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: !current }).eq("id", id);
  revalidatePath("/admin/artists");
}

export async function togglePatronageSupported(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ is_patronage_supported: !current })
    .eq("id", id);
  revalidatePath("/admin/artists");
}

export async function deleteArtist(id: string) {
  await guard();
  const supabase = await createClient();
  // Delete artwork images from storage first
  const { data: imgs } = await supabase
    .from("artworks")
    .select("url")
    .eq("profile_id", id);
  if (imgs && imgs.length > 0) {
    const paths = imgs.map((i: { url: string }) => {
      const parts = i.url.split("/portfolio/");
      return parts[1] ?? "";
    }).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("portfolio").remove(paths);
    }
  }
  await supabase.from("profiles").delete().eq("id", id);
  revalidatePath("/admin/artists");
}
