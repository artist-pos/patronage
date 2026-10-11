"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "portfolio";
const SUBJECTS = ["art", "design", "photography", "other"] as const;
const MAX_IMAGES = 12;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "");
}

/** Public URL prefix of this user's own folder in the bucket. Uploads go
 *  straight from the browser, so the URLs we are handed are checked to be ones
 *  that user could have created, not arbitrary addresses. */
function ownFolderPrefix(userId: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${userId}/`;
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export interface FolioInput {
  title: string;
  subject: (typeof SUBJECTS)[number];
  year: number | null;
  coverUrl: string;
  panelUrls: string[];
  detailUrls: string[];
  identifiersCleared: boolean;
  peopleConsent: boolean;
}

export async function createFolio(input: FolioInput): Promise<{ seriesId?: string; slug?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, username").eq("id", user.id).single();
  const p = profile as { role: string; username: string } | null;
  if (!p || (p.role !== "artist" && p.role !== "owner")) return { error: "Only artists can add a folio." };

  // The two confirmations are the point: a folio is never saved without them.
  if (!input.identifiersCleared) {
    return { error: "Confirm that candidate numbers, school names and grades are covered or cropped out." };
  }
  if (!input.peopleConsent) {
    return { error: "Confirm that nobody identifiable is shown unless they have agreed to it being shared." };
  }

  const title = input.title.trim().slice(0, 120);
  if (!title) return { error: "Give the folio a title." };
  if (!SUBJECTS.includes(input.subject)) return { error: "Choose a subject." };
  const year = input.year && input.year >= 1990 && input.year <= 2100 ? Math.trunc(input.year) : null;

  const prefix = ownFolderPrefix(user.id);
  const panelUrls = input.panelUrls.filter(Boolean);
  const detailUrls = input.detailUrls.filter(Boolean);
  const all = [input.coverUrl, ...panelUrls, ...detailUrls];
  if (!input.coverUrl) return { error: "Add a photo of the whole folio as the cover." };
  if (panelUrls.length === 0) return { error: "Add at least one panel." };
  if (panelUrls.length + detailUrls.length > MAX_IMAGES) return { error: `A folio can have up to ${MAX_IMAGES} images.` };
  if (all.some((u) => !u.startsWith(prefix))) return { error: "One of the images did not upload properly. Try again." };

  const base = slugify(title) || "folio";
  let slug = base;
  for (let n = 2; ; n++) {
    const { data } = await admin.from("series").select("id").eq("artist_id", user.id).eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${n}`;
  }

  const { data: series, error: seriesError } = await admin
    .from("series")
    .insert({
      artist_id: user.id,
      title,
      slug,
      hero_image_url: input.coverUrl,
      series_type: "folio",
      folio_subject: input.subject,
      year,
      identifiers_cleared: true,
      people_consent: true,
    })
    .select("id")
    .single();
  if (seriesError || !series) return { error: seriesError?.message ?? "Could not create the folio." };

  const rows = [
    ...panelUrls.map((url, i) => ({ series_id: series.id, url, kind: "panel", position: i })),
    ...detailUrls.map((url, i) => ({ series_id: series.id, url, kind: "detail", position: panelUrls.length + i })),
  ];
  const { error: imagesError } = await admin.from("series_folio_images").insert(rows);
  if (imagesError) {
    await admin.from("series").delete().eq("id", series.id);
    return { error: "Could not save the folio images. Try again." };
  }

  revalidatePath("/studio");
  revalidatePath(`/${p.username}`);
  return { seriesId: series.id, slug };
}

/** Removes the folio and every file it used: cover, panels and detail shots. */
export async function deleteFolio(seriesId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: series } = await admin
    .from("series")
    .select("id, hero_image_url, series_type")
    .eq("id", seriesId)
    .eq("artist_id", user.id)
    .maybeSingle();
  const s = series as { id: string; hero_image_url: string | null; series_type: string } | null;
  if (!s || s.series_type !== "folio") return { error: "Folio not found." };

  const { data: imageRows } = await admin.from("series_folio_images").select("url").eq("series_id", seriesId);
  const urls = [s.hero_image_url, ...((imageRows ?? []) as { url: string }[]).map((r) => r.url)];
  const paths = urls
    .map((u) => (u ? storagePathFromUrl(u) : null))
    .filter((path): path is string => !!path && path.startsWith(`${user.id}/`));

  if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths);

  const { error } = await admin.from("series").delete().eq("id", seriesId).eq("artist_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio");
  return {};
}
