import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage, readImageSize } from "@/lib/image-processing";

// One-off backfill, two passes. Admin-only, idempotent (only touches rows that
// are actually missing something), and batched so it never times out — call it
// repeatedly (or with ?limit=) until `remaining` reaches 0.
//
//   POST /api/admin/backfill-thumbs?limit=50
//
// Pass 1 — thumbnails: generates a ~800px thumb for rows whose thumb_url is
// null, uploads `<path>-thumb.webp`, sets thumb_url.
//
// Pass 2 — dimensions: fills image_width/image_height on project_updates rows
// that lack them. FeedCard reserves an aspect-ratio box from those two columns;
// without them the tile has no height until the image decodes, so every late
// image shoves the masonry down. That is the feed's layout shift.

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

/** Pass 2 — record the original's intrinsic size so the feed can reserve space. */
async function backfillDimensions(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  sourceUrl: string
): Promise<boolean> {
  const parsed = parseStorageUrl(sourceUrl);
  if (!parsed) return false;

  const { data: blob, error: dlErr } = await admin.storage
    .from(parsed.bucket)
    .download(parsed.objectPath);
  if (dlErr || !blob) return false;

  const size = await readImageSize(Buffer.from(await blob.arrayBuffer()));
  if (!size) return false;

  const { error } = await admin
    .from("project_updates")
    .update({ image_width: size.width, image_height: size.height })
    .eq("id", id);
  return !error;
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

  // ── Pass 2: dimensions on feed rows that have an image but no width/height ──
  let dimensionsFilled = 0;
  const dimBudget = limit - processed - failed;
  if (dimBudget > 0) {
    const { data: sizeless } = await admin
      .from("project_updates")
      .select("id, image_url")
      .is("image_width", null)
      .not("image_url", "is", null)
      .like("image_url", `%${PUBLIC_MARKER}%`)
      .limit(dimBudget);

    for (const u of sizeless ?? []) {
      const ok = await backfillDimensions(admin, u.id as string, u.image_url as string);
      ok ? dimensionsFilled++ : failed++;
    }
  }

  // How many still need doing (so the caller knows whether to run again).
  const [{ count: artworksLeft }, { count: updatesLeft }, { count: dimensionsLeft }] = await Promise.all([
    admin.from("artworks").select("id", { count: "exact", head: true }).is("thumb_url", null).like("url", `%${PUBLIC_MARKER}%`),
    admin.from("project_updates").select("id", { count: "exact", head: true }).is("thumb_url", null).not("image_url", "is", null).like("image_url", `%${PUBLIC_MARKER}%`),
    admin.from("project_updates").select("id", { count: "exact", head: true }).is("image_width", null).not("image_url", "is", null).like("image_url", `%${PUBLIC_MARKER}%`),
  ]);

  const remaining = (artworksLeft ?? 0) + (updatesLeft ?? 0) + (dimensionsLeft ?? 0);
  return NextResponse.json({ processed, dimensionsFilled, failed, remaining });
}
