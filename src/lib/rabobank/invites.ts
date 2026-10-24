import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RabobankSettings } from "@/lib/rabobank/settings";

export interface ArtistInvite {
  id: string;
  token: string;
  first_name: string;
  full_name: string | null;
  email: string | null;
  instagram_handle: string | null;
  channel: "email" | "instagram";
  why_paragraph: string | null;
  featured_image_url: string | null;
  featured_title: string | null;
  featured_caption: string | null;
  featured_source_url: string | null;
  site_url: string | null;
  artist_id: string | null;
  invited_at: string | null;
  opened_at: string | null;
  opened_source: string | null;
  opens_email: number;
  opens_instagram: number;
  opens_other: number;
  last_activity_at: string | null;
  part_one_submitted_at: string | null;
  part_two_submitted_at: string | null;
  declined_at: string | null;
  decline_suggestion: string | null;
  admin_notes: string | null;
  /** First open of the creative direction PDF (migration 217). */
  direction_opened_at?: string | null;
  created_at: string;
}

/** 32 random bytes, base64url: 256 bits, nothing sequential. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

export async function getInviteByToken(token: string): Promise<ArtistInvite | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createAdminClient()
    .from("rabobank_artist_invite")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as ArtistInvite | null) ?? null;
}

/** Part one closes at the response deadline; Part two stays editable until selection closes. */
export function windowsFor(settings: RabobankSettings, now = new Date()) {
  const before = (iso: string | null) => !iso || now < new Date(iso);
  return {
    partOneOpen: before(settings.artist_deadline_at),
    partTwoOpen: before(settings.selection_closed_at),
  };
}

export type PartStatus = "not_started" | "saved" | "done";

export function inviteLink(token: string, source?: "email" | "instagram"): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  return `${base}/partners/rabobank/artists/${token}${source ? `?s=${source}` : ""}`;
}

/** Records a visit: first open (with its source) and a per-source count. Best effort. */
export async function recordOpen(invite: ArtistInvite, source: string | undefined) {
  const s = source === "email" || source === "instagram" ? source : "other";
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    [`opens_${s}`]: (invite[`opens_${s}` as "opens_email"] ?? 0) + 1,
    last_activity_at: now,
  };
  if (!invite.opened_at) {
    patch.opened_at = now;
    patch.opened_source = s;
  }
  await createAdminClient().from("rabobank_artist_invite").update(patch).eq("id", invite.id);
}

export async function touch(inviteId: string, extra: Record<string, unknown> = {}) {
  await createAdminClient()
    .from("rabobank_artist_invite")
    .update({ last_activity_at: new Date().toISOString(), ...extra })
    .eq("id", inviteId);
}
