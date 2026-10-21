"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken, type TokenType } from "@/lib/rabobank/tokens";
import { nzLocalToUtcIso } from "@/lib/rabobank/time";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised.");
}

export type ActionState = { ok?: boolean; error?: string; link?: string } | null;

const dateField = (fd: FormData, name: string): string | null => {
  const v = String(fd.get(name) ?? "").trim();
  return v ? nzLocalToUtcIso(v) : null;
};

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const mode = String(fd.get("collect_first_name"));
  if (!["required", "optional", "off"].includes(mode)) return { error: "Choose a name setting." };

  const dates = {
    survey_open_at: dateField(fd, "survey_open_at"),
    survey_close_at: dateField(fd, "survey_close_at"),
    shortlist_open_at: dateField(fd, "shortlist_open_at"),
    shortlist_close_at: dateField(fd, "shortlist_close_at"),
  };
  if (dates.survey_open_at && dates.survey_close_at && dates.survey_close_at <= dates.survey_open_at) {
    return { error: "The survey close date must be after it opens." };
  }
  if (dates.shortlist_open_at && dates.shortlist_close_at && dates.shortlist_close_at <= dates.shortlist_open_at) {
    return { error: "The shortlist close date must be after it opens." };
  }

  const { error } = await createAdminClient()
    .from("rabobank_settings")
    .update({
      ...dates,
      collect_first_name: mode,
      shortlist_intro: String(fd.get("shortlist_intro") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/rabobank");
  return { ok: true };
}

export async function createToken(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  const type = String(fd.get("type")) as TokenType;
  if (!["survey", "staff", "client"].includes(type)) return { error: "Choose a link type." };
  const expires = dateField(fd, "expires_at");
  const token = generateToken();

  const { error } = await createAdminClient()
    .from("rabobank_access_token")
    .insert({
      type,
      token_hash: hashToken(token),
      label: String(fd.get("label") ?? "").trim().slice(0, 80) || null,
      expires_at: expires,
    });
  if (error) return { error: error.message };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const path = type === "survey" ? "survey" : type === "staff" ? "shortlist" : "client";
  revalidatePath("/admin/rabobank");
  // The raw token is only ever shown here; the database keeps its hash.
  return { ok: true, link: `${base}/partners/rabobank/${path}/${token}` };
}

export async function revokeToken(fd: FormData): Promise<void> {
  await requireAdmin();
  await createAdminClient()
    .from("rabobank_access_token")
    .update({ revoked: true })
    .eq("id", String(fd.get("id")));
  revalidatePath("/admin/rabobank");
}

/** Removes a link entirely. Nothing references a token row, and answers keep no link to it. */
export async function deleteToken(fd: FormData): Promise<void> {
  await requireAdmin();
  await createAdminClient()
    .from("rabobank_access_token")
    .delete()
    .eq("id", String(fd.get("id")));
  revalidatePath("/admin/rabobank");
}

export async function deleteAllNames(): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("rabobank_survey_response").update({ first_name: null }).not("first_name", "is", null);
  await admin.from("rabobank_reaction").update({ first_name: null }).not("first_name", "is", null);
  await admin.from("rabobank_settings").update({ names_deleted_at: new Date().toISOString() }).eq("id", 1);
  revalidatePath("/admin/rabobank");
}

export async function saveSummary(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("rabobank_settings")
    .update({
      comment_summary: String(fd.get("comment_summary") ?? "").trim() || null,
      show_raw_comments_to_client: fd.get("show_raw_comments_to_client") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/rabobank/reactions");
  return { ok: true };
}
