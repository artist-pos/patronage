import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";

// One-off backfill: generates a ~800px thumbnail for existing rows whose
// thumb_url is still null, and stores it. Admin-only, idempotent (only touches
// rows missing a thumb), and batched so it never times out — call it repeatedly
// (or with ?limit=) until `remaining` reaches 0.
//
//   POST /api/admin/backfill-thumbs?limit=50
//
// Maximum runtime is bounded by `limit`; each row downloads the original,
// resizes it, uploads `<path>-thumb.webp`, and sets thumb_url.

export const maxDuration = 300;

const PUBLIC_MARKER = "/storage/v1/object/public/";

/** Split a public storage URL into { bucket, objectPath }. */
function parseStorageUrl(url: string): { bucket: string; objectPath: string } | null {
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return null;
  const rest = url.slice(idx + PUBLIC_MARKER.length); // "<bucket>/<path...>"
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { bucket: rest.slice(0, slash), objectPath: rest.slice(slash + 1) };
}

async function backfillRow(
  admin: ReturnType<typeof createAdminClient>,
  table: "artworks" | "project_updates",
  id: string,
  sourceUrl: string
): Promise<boolean> {
  const parsed = parseStorageUrl(sourceUrl);
  if (!parsed) return false;
  const { bucket, objectPath } = parsed;

  const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(objectPath);
  if (dlErr || !blob) return false;

  const buffer = Buffer.from(await blob.arrayBuffer());
  const thumb = await processImage(buffer, { maxWidth: 800, quality: 75 }).catch(() => null);
  if (!thumb) return false;

  const thumbObjectPath = objectPath.replace(/\.[^.]+$/, "") + "-thumb.webp";
  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(thumbObjectPath, thumb.data, { contentType: "image/webp", upsert: true });
  if (upErr) return false;

  const thumbUrl = admin.storage.from(bucket).getPublicUrl(thumbObjectPath).data.publicUrl;
  const { error: updErr } = await admin.from(table).update({ thumb_url: thumbUrl }).eq("id", id);
  return !updErr;
}

export async function POST(req: NextRequest) {
  // Auth: admins/owners only.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
  const admin = createAdminClient();

  let processed = 0;
  let failed = 0;

  // artworks (portfolio + available works)
  const { data: artworks } = await admin
    .from("artworks")
    .select("id, url")
    .is("thumb_url", null)
    .not("url", "is", null)
    .like("url", `%${PUBLIC_MARKER}%`)
    .limit(limit);

  for (const a of artworks ?? []) {
    const ok = await backfillRow(admin, "artworks", a.id as string, a.url as string);
    ok ? processed++ : failed++;
  }

  // project_updates (studio feed) — image content only
  const remainingBudget = limit - (artworks?.length ?? 0);
  if (remainingBudget > 0) {
    const { data: updates } = await admin
      .from("project_updates")
      .select("id, image_url")
      .is("thumb_url", null)
      .not("image_url", "is", null)
      .like("image_url", `%${PUBLIC_MARKER}%`)
      .limit(remainingBudget);

    for (const u of updates ?? []) {
      const ok = await backfillRow(admin, "project_updates", u.id as string, u.image_url as string);
      ok ? processed++ : failed++;
    }
  }

  // How many still need doing (so the caller knows whether to run again).
  const [{ count: artworksLeft }, { count: updatesLeft }] = await Promise.all([
    admin.from("artworks").select("id", { count: "exact", head: true }).is("thumb_url", null).like("url", `%${PUBLIC_MARKER}%`),
    admin.from("project_updates").select("id", { count: "exact", head: true }).is("thumb_url", null).not("image_url", "is", null).like("image_url", `%${PUBLIC_MARKER}%`),
  ]);

  const remaining = (artworksLeft ?? 0) + (updatesLeft ?? 0);
  return NextResponse.json({ processed, failed, remaining });
}
