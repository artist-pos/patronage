"use server";

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/rabobank/settings";
import { getInviteByToken, touch, windowsFor, type ArtistInvite } from "@/lib/rabobank/invites";
import { ensureArtist } from "@/lib/rabobank/artist-data";
import { QUOTE_LIMITS, quoteToRow, validateQuote, type QuoteDraft, type QuoteErrors } from "@/lib/rabobank/quote";
import {
  PROFILE_LIMITS,
  cleanHandle,
  cleanUrl,
  validateProfile,
  type ProfileDraft,
  type ProfileErrors,
  type WorkDraft,
} from "@/lib/rabobank/artist-profile";
import { CONSENT_VERSION } from "@/lib/rabobank/artist-copy";
import { sendKeepEmail } from "@/lib/rabobank/keep";
import { deleteArtistProfile } from "@/lib/rabobank/retention";

type Result = { ok: true } | { ok: false; error: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function load(token: string, part: "one" | "two"): Promise<{ invite: ArtistInvite } | { error: string }> {
  const invite = await getInviteByToken(token);
  if (!invite) return { error: "closed" };
  const open = windowsFor(await getSettings());
  if (part === "one" ? !open.partOneOpen : !open.partTwoOpen) return { error: "closed" };
  return { invite };
}

async function allowed(inviteId: string, action: string, limit: number): Promise<boolean> {
  const ip = await getClientIp();
  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "rabobank").update(ip).digest("hex").slice(0, 16);
  return checkRateLimit(`rabobank_artist_${action}:${inviteId}:${key}`, limit, 3600);
}

/* ---------------- Part one ---------------- */

/** Autosave. Lands in the draft column, never in the submitted quote. */
export async function saveQuoteDraft(token: string, draft: QuoteDraft): Promise<Result> {
  const got = await load(token, "one");
  if ("error" in got) return { ok: false, error: got.error };
  if (!(await allowed(got.invite.id, "draft", 600))) return { ok: false, error: "rate" };
  const { error } = await createAdminClient()
    .from("rabobank_quote")
    .upsert({ invite_id: got.invite.id, draft, draft_saved_at: new Date().toISOString() }, { onConflict: "invite_id" });
  if (error) return { ok: false, error: "save" };
  await touch(got.invite.id);
  return { ok: true };
}

export async function submitQuote(
  token: string,
  draft: QuoteDraft
): Promise<{ ok: true; declined: boolean } | { ok: false; error: string; fields?: QuoteErrors }> {
  const got = await load(token, "one");
  if ("error" in got) return { ok: false, error: got.error };
  if (!(await allowed(got.invite.id, "submit", 30))) return { ok: false, error: "rate" };

  const fields = validateQuote(draft);
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  const declined = draft.interested === "no";
  // A decline keeps only the answer; nothing else from the form is stored.
  const row = declined ? { ...quoteToRow({ ...draft, ...emptyAfterDecline }), interested: "no" as const } : quoteToRow(draft);
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("rabobank_quote")
    .upsert({ invite_id: got.invite.id, ...row, status: "submitted", submitted_at: now, updated_at: now, draft: null, draft_saved_at: null }, { onConflict: "invite_id" });
  if (error) return { ok: false, error: "save" };
  await admin.from("rabobank_quote_version").insert({ invite_id: got.invite.id, data: row, submitted_at: now });
  await touch(got.invite.id, declined ? { declined_at: now, part_one_submitted_at: now } : { part_one_submitted_at: now, declined_at: null });
  return { ok: true, declined };
}

const emptyAfterDecline: Partial<QuoteDraft> = {
  questions_text: "", deliver_by: "", deliver_date: "", work_type: "", existing_work_images: [], approach_text: "",
  fee_1800x900: "", fee_1600x800: "", gst_inclusive: false, alt_size_note: "", framing_option: "", framing_cost: "",
  framing_recommendation: "", install_option: "", install_cost: "", install_recommendation: "", based_in: "",
  lead_time_weeks: "", anything_else: "",
};

export async function saveDeclineSuggestion(token: string, text: string): Promise<Result> {
  const invite = await getInviteByToken(token);
  if (!invite) return { ok: false, error: "closed" };
  if (!(await allowed(invite.id, "suggest", 20))) return { ok: false, error: "rate" };
  await touch(invite.id, { decline_suggestion: text.trim().slice(0, QUOTE_LIMITS.suggestion) || null });
  return { ok: true };
}

/* ---------------- Part two ---------------- */

function profileRow(p: ProfileDraft, fallbackName: string) {
  const text = (s: string, max: number) => s.trim().slice(0, max) || null;
  return {
    name: text(p.name, PROFILE_LIMITS.name) ?? fallbackName,
    region: text(p.location, PROFILE_LIMITS.location),
    bio: text(p.bio, PROFILE_LIMITS.bio),
    website_url: cleanUrl(p.website),
    instagram: cleanHandle(p.instagram) || null,
    other_links: text(p.other_links, PROFILE_LIMITS.otherLinks),
    staff_prompt_answer: text(p.staff_prompt_answer, PROFILE_LIMITS.staffPrompt),
    visibility_choice: p.visibility_choice || null,
  };
}

async function saveWorks(artistId: string, works: WorkDraft[]) {
  const admin = createAdminClient();
  const text = (s: string, max: number) => s.trim().slice(0, max) || null;
  await Promise.all(
    works.slice(0, 8).map((w, i) =>
      admin
        .from("rabobank_work")
        .update({
          title: text(w.title, PROFILE_LIMITS.workTitle),
          year: text(w.year, PROFILE_LIMITS.workYear),
          medium: text(w.medium, PROFILE_LIMITS.workMedium),
          size: text(w.size, PROFILE_LIMITS.workSize),
          note: text(w.note, PROFILE_LIMITS.workNote),
          sort_order: i,
        })
        .eq("id", w.id)
        .eq("artist_id", artistId) // only their own works
    )
  );
}

/** Autosave for Part two. Writes the profile as it stands; it stays hidden until shortlisted. */
export async function saveProfileDraft(token: string, profile: ProfileDraft, works: WorkDraft[]): Promise<Result> {
  const got = await load(token, "two");
  if ("error" in got) return { ok: false, error: got.error };
  if (!(await allowed(got.invite.id, "draft", 600))) return { ok: false, error: "rate" };
  const artistId = await ensureArtist(got.invite);
  const { error } = await createAdminClient()
    .from("rabobank_artist")
    .update(profileRow(profile, got.invite.full_name || got.invite.first_name))
    .eq("id", artistId);
  if (error) return { ok: false, error: "save" };
  await saveWorks(artistId, works);
  await touch(got.invite.id);
  return { ok: true };
}

export async function submitProfile(
  token: string,
  profile: ProfileDraft,
  works: WorkDraft[],
  email: string
): Promise<{ ok: true; keepSent: boolean } | { ok: false; error: string; fields?: ProfileErrors & { email?: string } }> {
  const got = await load(token, "two");
  if ("error" in got) return { ok: false, error: got.error };
  if (!(await allowed(got.invite.id, "submit", 30))) return { ok: false, error: "rate" };
  const admin = createAdminClient();
  const artistId = await ensureArtist(got.invite);

  const { count } = await admin.from("rabobank_work").select("id", { count: "exact", head: true }).eq("artist_id", artistId);
  const fields: ProfileErrors & { email?: string } = validateProfile(profile, count ?? 0);
  const keepEmail = (got.invite.email || email).trim().toLowerCase();
  if (profile.visibility_choice === "keep" && !EMAIL_RE.test(keepEmail)) fields.email = "email";
  if (Object.keys(fields).length) return { ok: false, error: "invalid", fields };

  const now = new Date().toISOString();
  const { data: current } = await admin.from("rabobank_artist").select("state").eq("id", artistId).maybeSingle();
  const state = current?.state === "kept" ? "kept" : profile.visibility_choice === "keep" ? "complete" : "private_only";
  const { error } = await admin
    .from("rabobank_artist")
    .update({ ...profileRow(profile, got.invite.full_name || got.invite.first_name), state, consent_version: CONSENT_VERSION, consent_at: now })
    .eq("id", artistId);
  if (error) return { ok: false, error: "save" };
  await saveWorks(artistId, works);
  await touch(got.invite.id, { part_two_submitted_at: now, ...(!got.invite.email && keepEmail ? { email: keepEmail } : {}) });

  let keepSent = false;
  if (state === "complete") {
    const r = await sendKeepEmail(got.invite, keepEmail);
    keepSent = r.ok;
    if (!r.ok) console.error("rabobank keep email failed:", r.error);
  }
  return { ok: true, keepSent };
}

export async function removeWork(token: string, workId: string): Promise<Result> {
  const got = await load(token, "two");
  if ("error" in got) return { ok: false, error: got.error };
  if (!got.invite.artist_id) return { ok: false, error: "save" };
  const admin = createAdminClient();
  const { data: w } = await admin
    .from("rabobank_work")
    .select("image_url, thumb_url")
    .eq("id", workId)
    .eq("artist_id", got.invite.artist_id)
    .maybeSingle();
  if (!w) return { ok: false, error: "save" };
  await admin.from("rabobank_work").delete().eq("id", workId);
  const paths = [w.image_url, w.thumb_url].map((u) => (u ? u.split("/object/public/rabobank-pilot/")[1] : null)).filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from("rabobank-pilot").remove(paths.map(decodeURIComponent));
  return { ok: true };
}

export async function removePhoto(token: string): Promise<Result> {
  const got = await load(token, "two");
  if ("error" in got) return { ok: false, error: got.error };
  if (!got.invite.artist_id) return { ok: true };
  const admin = createAdminClient();
  const { data: a } = await admin.from("rabobank_artist").select("photo_url").eq("id", got.invite.artist_id).maybeSingle();
  await admin.from("rabobank_artist").update({ photo_url: null }).eq("id", got.invite.artist_id);
  const path = a?.photo_url?.split("/object/public/rabobank-pilot/")[1];
  if (path) {
    const p = decodeURIComponent(path);
    await admin.storage.from("rabobank-pilot").remove([p, p.replace(/\.webp$/, "-thumb.webp")]);
  }
  return { ok: true };
}

/* ---------------- Follow-up choice (from the email) ---------------- */

export async function confirmKeep(token: string): Promise<Result> {
  const invite = await getInviteByToken(token);
  if (!invite?.artist_id || !invite.email) return { ok: false, error: "closed" };
  await createAdminClient().from("rabobank_artist").update({ visibility_choice: "keep" }).eq("id", invite.artist_id);
  const r = await sendKeepEmail(invite, invite.email);
  return r.ok ? { ok: true } : { ok: false, error: "save" };
}

export async function confirmDelete(token: string): Promise<Result> {
  const invite = await getInviteByToken(token);
  if (!invite?.artist_id) return { ok: false, error: "closed" };
  const r = await deleteArtistProfile(invite.artist_id, "artist_request");
  return r.ok ? { ok: true } : { ok: false, error: "save" };
}
