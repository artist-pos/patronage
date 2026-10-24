"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { nzLocalToUtcIso } from "@/lib/rabobank/time";
import { generateInviteToken } from "@/lib/rabobank/invites";
import { deleteArtistProfile, runRetention } from "@/lib/rabobank/retention";
export type AdminResult = { ok?: boolean; error?: string; message?: string } | null;
const PATH = "/admin/rabobank/artists";
const MAX_THOUGHTS = 12;
const THOUGHT_MAX = 600;

const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max) || null;
const url = (fd: FormData, name: string) => {
  const v = text(fd, name, 500);
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const money = (fd: FormData, name: string) => {
  const v = String(fd.get(name) ?? "").replace(/[\s,$]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

function inviteFields(fd: FormData) {
  return {
    first_name: text(fd, "first_name", 60),
    full_name: text(fd, "full_name", 120),
    email: text(fd, "email", 200)?.toLowerCase() ?? null,
    instagram_handle: text(fd, "instagram_handle", 60)?.replace(/^@+/, "") ?? null,
    channel: fd.get("channel") === "instagram" ? "instagram" : "email",
    why_paragraph: text(fd, "why_paragraph", 1500),
    featured_image_url: url(fd, "featured_image_url"),
    featured_title: text(fd, "featured_title", 200),
    featured_caption: text(fd, "featured_caption", 400),
    featured_source_url: url(fd, "featured_source_url"),
    featured_image_2_url: url(fd, "featured_image_2_url"),
    featured_title_2: text(fd, "featured_title_2", 200),
    featured_caption_2: text(fd, "featured_caption_2", 400),
    featured_source_url_2: url(fd, "featured_source_url_2"),
    // One thought per line; blank lines are ignored.
    thoughts: String(fd.get("thoughts") ?? "")
      .split(/\r?\n/)
      .map((t) => t.trim().slice(0, THOUGHT_MAX))
      .filter(Boolean)
      .slice(0, MAX_THOUGHTS),
  };
}

export async function saveInvite(_: AdminResult, fd: FormData): Promise<AdminResult> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const fields = inviteFields(fd);
  if (!fields.first_name) return { error: "Add a first name." };
  const id = String(fd.get("id") ?? "");
  const admin = createAdminClient();
  const { error } = id
    ? await admin.from("rabobank_artist_invite").update(fields).eq("id", id)
    : await admin.from("rabobank_artist_invite").insert({ ...fields, token: generateInviteToken() });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true, message: id ? "Saved." : "Invite created." };
}

export async function deleteInvite(fd: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const id = String(fd.get("id"));
  const admin = createAdminClient();
  const { data } = await admin.from("rabobank_artist_invite").select("artist_id").eq("id", id).maybeSingle();
  if (data?.artist_id) await deleteArtistProfile(data.artist_id, "admin");
  await admin.from("rabobank_artist_invite").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function markInvited(fd: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  await createAdminClient().from("rabobank_artist_invite").update({ invited_at: new Date().toISOString() }).eq("id", String(fd.get("id")));
  revalidatePath(PATH);
}

export async function saveNotes(fd: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  await createAdminClient()
    .from("rabobank_artist_invite")
    .update({ admin_notes: text(fd, "admin_notes", 2000) })
    .eq("id", String(fd.get("id")));
  revalidatePath(PATH);
}

/** The shortlist flag is the staff card's `visible`. */
export async function setShortlisted(artistId: string, shortlisted: boolean): Promise<AdminResult> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const { error } = await createAdminClient().from("rabobank_artist").update({ visible: shortlisted }).eq("id", artistId);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/admin/rabobank/shortlist");
  return { ok: true };
}

export async function saveArtistSettings(_: AdminResult, fd: FormData): Promise<AdminResult> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const deadline = String(fd.get("artist_deadline_at") ?? "").trim();
  const big = money(fd, "framer_quote_1800x900");
  const small = money(fd, "framer_quote_1600x800");
  if (Number.isNaN(big) || Number.isNaN(small)) return { error: "Framer figures must be amounts, like 650." };
  const { error } = await createAdminClient()
    .from("rabobank_settings")
    .update({
      artist_deadline_at: deadline ? nzLocalToUtcIso(deadline) : null,
      framer_quote_1800x900: big,
      framer_quote_1600x800: small,
      staff_see_quotes: fd.get("staff_see_quotes") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true, message: "Saved." };
}

/** Closes selection now and sends the keep-or-delete email straight away. Deletion follows at day 30. */
export async function closeSelection(): Promise<AdminResult> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const admin = createAdminClient();
  const { data } = await admin.from("rabobank_settings").select("selection_closed_at").eq("id", 1).maybeSingle();
  if (!data?.selection_closed_at) {
    const { error } = await admin.from("rabobank_settings").update({ selection_closed_at: new Date().toISOString() }).eq("id", 1);
    if (error) return { error: error.message };
  }
  const report = await runRetention();
  revalidatePath(PATH);
  return {
    ok: true,
    message: `Selection closed. ${report.followups} follow-up email${report.followups === 1 ? "" : "s"} sent${report.skippedNoEmail ? `, ${report.skippedNoEmail} without an email address` : ""}.`,
  };
}

export async function adminDeleteProfile(fd: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  await deleteArtistProfile(String(fd.get("artist_id")), "admin");
  revalidatePath(PATH);
}
