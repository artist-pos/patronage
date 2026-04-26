"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inferYear, type PriorHistoryType } from "@/lib/artwork-prior-history";
import type { DocPhotoType } from "@/lib/artwork-documentation";

const BUCKET = "artwork-documentation";
const VALID_DOC_TYPES: DocPhotoType[] = ["verso", "signature", "scale", "detail", "other"];
const VALID_PRIOR_TYPES: PriorHistoryType[] =
  ["exhibited", "sold", "gifted", "commissioned", "published", "other"];

// Common gate: caller must be authed and own the artwork.
async function assertCreator(artworkId: string): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const admin = createAdminClient();
  const { data: artwork } = await admin
    .from("artworks")
    .select("creator_id")
    .eq("id", artworkId)
    .maybeSingle();
  if (!artwork) return { error: "Artwork not found." };
  if (artwork.creator_id !== user.id) return { error: "You are not the creator of this work." };
  return { userId: user.id };
}

// ── Documentation photos ────────────────────────────────────────────────────

export async function uploadDocumentationPhoto(form: FormData): Promise<{ error?: string }> {
  const artworkId = String(form.get("artworkId") ?? "");
  const type = String(form.get("type") ?? "");
  const caption = String(form.get("caption") ?? "").trim() || null;
  const file = form.get("file");

  if (!artworkId) return { error: "Missing artwork ID." };
  if (!VALID_DOC_TYPES.includes(type as DocPhotoType)) return { error: "Invalid photo type." };
  if (!(file instanceof File)) return { error: "No file uploaded." };
  if (file.size > 10 * 1024 * 1024) return { error: "File must be under 10 MB." };
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };

  const gate = await assertCreator(artworkId);
  if ("error" in gate) return { error: gate.error };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const id = randomBytes(8).toString("hex");
  const path = `${gate.userId}/${artworkId}/${type}-${id}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  // Position = next available within type
  const { data: existing } = await admin
    .from("artwork_documentation_photos")
    .select("position")
    .eq("artwork_id", artworkId)
    .eq("type", type)
    .order("position", { ascending: false })
    .limit(1);
  const position = existing?.[0]?.position != null ? existing[0].position + 1 : 0;

  const { error: insertError } = await admin
    .from("artwork_documentation_photos")
    .insert({ artwork_id: artworkId, type, storage_path: path, caption, position });

  if (insertError) {
    // Roll back the file so we don't leak orphaned objects.
    await admin.storage.from(BUCKET).remove([path]);
    return { error: insertError.message };
  }

  revalidatePath(`/studio/artworks/${artworkId}`);
  return {};
}

export async function deleteDocumentationPhoto(photoId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("artwork_documentation_photos")
    .select("id, artwork_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { error: "Photo not found." };

  const gate = await assertCreator(photo.artwork_id);
  if ("error" in gate) return { error: gate.error };

  await admin.storage.from(BUCKET).remove([photo.storage_path]);
  await admin.from("artwork_documentation_photos").delete().eq("id", photoId);

  revalidatePath(`/studio/artworks/${photo.artwork_id}`);
  return {};
}

// ── Artwork details (medium / dimensions / year / edition / title) ──────────

export async function updateArtworkDetails(data: {
  artworkId: string;
  title?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  year?: number | null;
  edition?: string | null;
}): Promise<{ error?: string }> {
  const gate = await assertCreator(data.artworkId);
  if ("error" in gate) return { error: gate.error };

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined)      patch.title      = data.title?.trim() || null;
  if (data.medium !== undefined)     patch.medium     = data.medium?.trim() || null;
  if (data.dimensions !== undefined) patch.dimensions = data.dimensions?.trim() || null;
  if (data.edition !== undefined)    patch.edition    = data.edition?.trim() || null;
  if (data.year !== undefined) {
    if (data.year === null || Number.isNaN(data.year)) {
      patch.year = null;
    } else {
      const y = Math.floor(data.year);
      const max = new Date().getFullYear() + 1;
      if (y < 1500 || y > max) return { error: `Year must be between 1500 and ${max}.` };
      patch.year = y;
    }
  }

  if (Object.keys(patch).length === 0) return {};

  const { error } = await admin
    .from("artworks")
    .update(patch)
    .eq("id", data.artworkId);
  if (error) return { error: error.message };

  revalidatePath(`/studio/artworks/${data.artworkId}`);
  revalidatePath(`/studio/provenance`);
  return {};
}

// ── Prior history ───────────────────────────────────────────────────────────

export async function addPriorHistoryEntry(data: {
  artworkId: string;
  type: PriorHistoryType;
  description: string;
  dateText: string | null;
  yearOverride?: number | null;
}): Promise<{ error?: string }> {
  if (!VALID_PRIOR_TYPES.includes(data.type)) return { error: "Invalid type." };
  const description = data.description.trim();
  if (!description) return { error: "Description is required." };

  const gate = await assertCreator(data.artworkId);
  if ("error" in gate) return { error: gate.error };

  const admin = createAdminClient();
  const yearInt = data.yearOverride ?? inferYear(data.dateText);

  const { data: existing } = await admin
    .from("artwork_prior_history")
    .select("position")
    .eq("artwork_id", data.artworkId)
    .order("position", { ascending: false })
    .limit(1);
  const position = existing?.[0]?.position != null ? existing[0].position + 1 : 0;

  const { error } = await admin
    .from("artwork_prior_history")
    .insert({
      artwork_id: data.artworkId,
      type: data.type,
      description,
      date_text: data.dateText?.trim() || null,
      year_int: yearInt,
      position,
    });
  if (error) return { error: error.message };

  revalidatePath(`/studio/artworks/${data.artworkId}`);
  return {};
}

export async function deletePriorHistoryEntry(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("artwork_prior_history")
    .select("artwork_id")
    .eq("id", id)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };

  const gate = await assertCreator(entry.artwork_id);
  if ("error" in gate) return { error: gate.error };

  await admin.from("artwork_prior_history").delete().eq("id", id);
  revalidatePath(`/studio/artworks/${entry.artwork_id}`);
  return {};
}
