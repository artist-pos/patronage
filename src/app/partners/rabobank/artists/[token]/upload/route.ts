import { NextResponse, type NextRequest } from "next/server";
import { createHmac, randomUUID } from "crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/rabobank/settings";
import { getInviteByToken, touch, windowsFor } from "@/lib/rabobank/invites";
import { ensureArtist } from "@/lib/rabobank/artist-data";
import { WORKS } from "@/lib/rabobank/artist-profile";

export const runtime = "nodejs";

const BUCKET = "rabobank-pilot";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
type Kind = "work" | "photo" | "quote_existing";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Upload for an invited artist, authorised by their link token alone.
 * Images are auto-rotated, then re-encoded to WebP, which drops all EXIF
 * (including GPS location). Types are checked by header and by decoding.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) return fail("This link is no longer active.", 404);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipKey = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "rabobank").update(ip).digest("hex").slice(0, 16);
  if (!(await checkRateLimit(`rabobank_artist_upload:${invite.id}:${ipKey}`, 60, 3600))) {
    return fail("Too many uploads in a short time. Please try again in a little while.", 429);
  }

  const fd = await req.formData();
  const kind = String(fd.get("kind")) as Kind;
  const file = fd.get("file");
  if (!["work", "photo", "quote_existing"].includes(kind)) return fail("Unknown upload.");
  if (!(file instanceof File) || !file.size) return fail("Choose an image first.");
  if (file.size > MAX_BYTES) return fail("That image is over 10 MB.");
  if (file.type && !TYPES.has(file.type)) return fail("Please use a JPG, PNG, WebP or HEIC image.");

  const open = windowsFor(await getSettings());
  if (kind === "quote_existing" ? !open.partOneOpen : !open.partTwoOpen) return fail("This part has closed.", 403);

  let oriented: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.format || !FORMATS.has(meta.format)) return fail("Please use a JPG, PNG, WebP or HEIC image.");
    oriented = await sharp(input).rotate().toBuffer();
  } catch {
    return fail("That image could not be read. Try a JPG or PNG.");
  }

  const admin = createAdminClient();
  const artistId = kind === "quote_existing" ? null : await ensureArtist(invite);
  if (kind === "work") {
    const { count } = await admin.from("rabobank_work").select("id", { count: "exact", head: true }).eq("artist_id", artistId!);
    if ((count ?? 0) >= WORKS.max) return fail(`You can add up to ${WORKS.max} works.`);
  }

  const [full, thumb] = await Promise.all([
    processImage(oriented, { maxWidth: kind === "photo" ? 1000 : 1800, quality: 86 }),
    processImage(oriented, { maxWidth: kind === "photo" ? 320 : 640, quality: 78 }),
  ]);
  const base = `artists/${invite.id}/${kind}-${randomUUID()}`;
  const opts = { contentType: "image/webp", cacheControl: "31536000" };
  const [a, b] = await Promise.all([
    admin.storage.from(BUCKET).upload(`${base}.webp`, full.data, opts),
    admin.storage.from(BUCKET).upload(`${base}-thumb.webp`, thumb.data, opts),
  ]);
  if (a.error || b.error) return fail("The upload did not finish. Please try again.", 500);
  const url = admin.storage.from(BUCKET).getPublicUrl(`${base}.webp`).data.publicUrl;
  const thumbUrl = admin.storage.from(BUCKET).getPublicUrl(`${base}-thumb.webp`).data.publicUrl;
  await touch(invite.id);

  if (kind === "photo") {
    await admin.from("rabobank_artist").update({ photo_url: url }).eq("id", artistId!);
    return NextResponse.json({ ok: true, url });
  }
  if (kind === "quote_existing") return NextResponse.json({ ok: true, url });

  const { data: last } = await admin
    .from("rabobank_work")
    .select("sort_order")
    .eq("artist_id", artistId!)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: work, error } = await admin
    .from("rabobank_work")
    .insert({ artist_id: artistId, image_url: url, thumb_url: thumbUrl, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id, image_url, thumb_url")
    .single();
  if (error || !work) return fail("The upload did not finish. Please try again.", 500);
  return NextResponse.json({ ok: true, work: { ...work, title: "", year: "", medium: "", size: "", note: "" } });
}
