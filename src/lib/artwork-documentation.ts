import { createAdminClient } from "@/lib/supabase/admin";

export type DocPhotoType = "verso" | "signature" | "scale" | "detail" | "other";

export const DOC_PHOTO_TYPES: { id: DocPhotoType; label: string; hint: string }[] = [
  { id: "verso",     label: "Verso",     hint: "Back of the work — labels, signatures, gallery stickers." },
  { id: "signature", label: "Signature", hint: "Close-up of the artist's signature on the work itself." },
  { id: "scale",     label: "Scale",     hint: "The work photographed with a person, ruler, or in situ." },
  { id: "detail",    label: "Detail",    hint: "Close-up of texture, brushwork, or a distinguishing feature." },
  { id: "other",     label: "Other",     hint: "Anything else that documents the physical work." },
];

export interface DocPhoto {
  id: string;
  artwork_id: string;
  type: DocPhotoType;
  storage_path: string;
  caption: string | null;
  position: number;
  created_at: string;
}

export interface DocPhotoWithUrl extends DocPhoto {
  signedUrl: string | null;
}

const BUCKET = "artwork-documentation";

export async function listDocPhotos(artworkId: string): Promise<DocPhoto[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("artwork_documentation_photos")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("type", { ascending: true })
    .order("position", { ascending: true });
  return (data ?? []) as DocPhoto[];
}

export async function listDocPhotosWithUrls(artworkId: string): Promise<DocPhotoWithUrl[]> {
  const photos = await listDocPhotos(artworkId);
  if (photos.length === 0) return [];
  const admin = createAdminClient();
  const paths = photos.map(p => p.storage_path);
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600);
  const urlMap = new Map<string, string | null>();
  for (const s of signed ?? []) {
    if (s.path) urlMap.set(s.path, s.signedUrl ?? null);
  }
  return photos.map(p => ({ ...p, signedUrl: urlMap.get(p.storage_path) ?? null }));
}

export async function viewerCanSeeDocPhotos(
  artworkId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("artworks")
    .select("creator_id, current_owner_id")
    .eq("id", artworkId)
    .maybeSingle();
  if (!data) return false;
  return data.creator_id === userId || data.current_owner_id === userId;
}
