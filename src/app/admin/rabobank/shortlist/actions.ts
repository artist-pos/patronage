"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised.");
}

const text = (fd: FormData, name: string, max: number): string | null =>
  String(fd.get(name) ?? "").trim().slice(0, max) || null;

const done = () => revalidatePath("/admin/rabobank/shortlist");

export async function createArtist(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = text(fd, "name", 120);
  if (!name) return;
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("rabobank_artist")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await admin.from("rabobank_artist").insert({ name, sort_order: (last?.sort_order ?? -1) + 1 });
  done();
}

export async function updateArtist(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const admin = createAdminClient();
  const name = text(fd, "name", 120);
  if (!name) return;
  await admin
    .from("rabobank_artist")
    .update({
      name,
      region: text(fd, "region", 120),
      medium: text(fd, "medium", 200),
      curator_note: text(fd, "curator_note", 800),
      website_url: text(fd, "website_url", 300),
    })
    .eq("id", id);
  await admin.from("rabobank_artist_commercial").upsert({
    artist_id: id,
    fee_indicative: text(fd, "fee_indicative", 200),
    timeline_indicative: text(fd, "timeline_indicative", 200),
  });
  done();
}

export async function toggleArtist(fd: FormData): Promise<void> {
  await requireAdmin();
  await createAdminClient()
    .from("rabobank_artist")
    .update({ visible: fd.get("visible") === "true" })
    .eq("id", String(fd.get("id")));
  done();
}

export async function deleteArtist(fd: FormData): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const id = String(fd.get("id"));
  const { data: works } = await admin.from("rabobank_work").select("image_url, thumb_url").eq("artist_id", id);
  await removeObjects((works ?? []).flatMap((w) => [w.image_url, w.thumb_url]));
  await admin.from("rabobank_artist").delete().eq("id", id);
  done();
}

/** Swap an artist or work with its neighbour by renumbering the whole list. */
async function move(table: "rabobank_artist" | "rabobank_work", id: string, dir: string, scope?: { col: string; val: string }) {
  const admin = createAdminClient();
  let q = admin.from(table).select("id").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (scope) q = q.eq(scope.col, scope.val);
  const { data } = await q;
  const ids = (data ?? []).map((r) => r.id as string);
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((rid, n) => admin.from(table).update({ sort_order: n }).eq("id", rid)));
}

export async function moveArtist(fd: FormData): Promise<void> {
  await requireAdmin();
  await move("rabobank_artist", String(fd.get("id")), String(fd.get("dir")));
  done();
}

export async function moveWork(fd: FormData): Promise<void> {
  await requireAdmin();
  await move("rabobank_work", String(fd.get("id")), String(fd.get("dir")), {
    col: "artist_id",
    val: String(fd.get("artist_id")),
  });
  done();
}

export async function updateWork(fd: FormData): Promise<void> {
  await requireAdmin();
  await createAdminClient()
    .from("rabobank_work")
    .update({
      title: text(fd, "title", 200),
      size: text(fd, "size", 100),
      year: text(fd, "year", 20),
      medium: text(fd, "medium", 200),
    })
    .eq("id", String(fd.get("id")));
  done();
}

export async function deleteWork(fd: FormData): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const id = String(fd.get("id"));
  const { data: w } = await admin.from("rabobank_work").select("image_url, thumb_url").eq("id", id).maybeSingle();
  if (w) await removeObjects([w.image_url, w.thumb_url]);
  await admin.from("rabobank_work").delete().eq("id", id);
  done();
}

const BUCKET = "rabobank-pilot";

async function removeObjects(urls: (string | null)[]) {
  const marker = `/object/public/${BUCKET}/`;
  const paths = urls
    .map((u) => (u && u.includes(marker) ? decodeURIComponent(u.split(marker)[1]) : null))
    .filter((p): p is string => !!p);
  if (paths.length) await createAdminClient().storage.from(BUCKET).remove(paths);
}
