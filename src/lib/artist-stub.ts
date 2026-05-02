import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PendingArtist } from "@/types/database";

/**
 * Normalise an artist name for stub matching: lowercase, trim, fold accents.
 * Two stubs with the same normalised name + email are treated as the same
 * artist; with different emails (or no email) they stay separate, because
 * common names collide and false merges are worse than duplicates.
 */
export function normaliseArtistName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

interface FindOrCreateInput {
  name: string;
  email: string | null;
  createdByHolderId: string;
}

/**
 * Returns the pending_artists row that matches (name_normalised, email),
 * creating one if none exists. Email-keyed dedup only — name-only stubs
 * always create a fresh row so unrelated artists with the same name don't
 * silently merge.
 */
export async function findOrCreatePendingArtist(
  admin: SupabaseClient,
  input: FindOrCreateInput,
): Promise<PendingArtist | null> {
  const nameNormalised = normaliseArtistName(input.name);
  if (!nameNormalised) return null;
  const email = input.email?.trim().toLowerCase() || null;

  if (email) {
    const { data: existing } = await admin
      .from("pending_artists")
      .select("*")
      .eq("name_normalised", nameNormalised)
      .eq("email", email)
      .maybeSingle();
    if (existing) return existing as PendingArtist;
  }

  const { data: created, error } = await admin
    .from("pending_artists")
    .insert({
      name: input.name.trim(),
      name_normalised: nameNormalised,
      email,
      created_by_holder_id: input.createdByHolderId,
    })
    .select("*")
    .single();
  if (error || !created) return null;
  return created as PendingArtist;
}

/**
 * Stubs whose normalised name matches the artist's display name. We don't
 * auto-claim — the artist confirms manually via /claim/artist/[token]. Common
 * names will collide; the artist's job is to say which stubs are theirs.
 */
export async function findMatchingStubsForName(
  fullName: string,
): Promise<PendingArtist[]> {
  const normalised = normaliseArtistName(fullName);
  if (!normalised) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("pending_artists")
    .select("*")
    .eq("name_normalised", normalised)
    .is("claimed_by_profile_id", null);
  return (data ?? []) as PendingArtist[];
}
