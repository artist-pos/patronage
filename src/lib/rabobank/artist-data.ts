import { createAdminClient } from "@/lib/supabase/admin";
import type { ArtistInvite } from "@/lib/rabobank/invites";
import { rowToQuote, type QuoteDraft } from "@/lib/rabobank/quote";
import { EMPTY_PROFILE, type ProfileDraft, type WorkDraft } from "@/lib/rabobank/artist-profile";

/**
 * The shortlist card behind this invite's profile, created hidden on first use.
 * `visible` stays false until Blake shortlists them.
 */
export async function ensureArtist(invite: ArtistInvite): Promise<string> {
  if (invite.artist_id) return invite.artist_id;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("rabobank_artist").select("id").eq("invite_id", invite.id).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await admin
      .from("rabobank_artist")
      .insert({ name: invite.full_name || invite.first_name, visible: false, invite_id: invite.id, state: "draft", sort_order: 1000 })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not start a profile.");
    id = data.id as string;
  }
  await admin.from("rabobank_artist_invite").update({ artist_id: id }).eq("id", invite.id);
  invite.artist_id = id;
  return id;
}

export interface QuoteState {
  draft: QuoteDraft;
  status: "none" | "draft" | "submitted";
  /** Saved changes not yet submitted (always true for a never-submitted draft). */
  unsubmitted: boolean;
  /** When the server copy last changed, so a newer local backup can win. */
  savedAt: string | null;
}

export async function loadQuote(inviteId: string): Promise<QuoteState> {
  const { data } = await createAdminClient().from("rabobank_quote").select("*").eq("invite_id", inviteId).maybeSingle();
  if (!data) return { draft: rowToQuote(null), status: "none", unsubmitted: false, savedAt: null };
  const draft = data.draft ? { ...rowToQuote(null), ...(data.draft as Partial<QuoteDraft>) } : rowToQuote(data);
  return { draft, status: data.status, unsubmitted: !!data.draft, savedAt: data.draft_saved_at ?? data.submitted_at ?? null };
}

export interface ProfileState {
  draft: ProfileDraft;
  works: WorkDraft[];
  state: string | null;
  exists: boolean;
}

export async function loadProfile(invite: ArtistInvite): Promise<ProfileState> {
  const admin = createAdminClient();
  if (!invite.artist_id) {
    return { draft: { ...EMPTY_PROFILE, name: invite.full_name ?? "" }, works: [], state: null, exists: false };
  }
  const [{ data: a }, { data: works }] = await Promise.all([
    admin.from("rabobank_artist").select("*").eq("id", invite.artist_id).maybeSingle(),
    admin
      .from("rabobank_work")
      .select("id, image_url, thumb_url, title, year, medium, size, note, sort_order")
      .eq("artist_id", invite.artist_id)
      .order("sort_order", { ascending: true }),
  ]);
  if (!a) return { draft: { ...EMPTY_PROFILE, name: invite.full_name ?? "" }, works: [], state: null, exists: false };
  return {
    draft: {
      photo_url: a.photo_url ?? "",
      name: a.name ?? "",
      location: a.region ?? "",
      bio: a.bio ?? "",
      website: a.website_url ?? "",
      instagram: a.instagram ?? "",
      other_links: a.other_links ?? "",
      staff_prompt_answer: a.staff_prompt_answer ?? "",
      visibility_choice: a.visibility_choice ?? "",
      consent: !!a.consent_at,
    },
    works: (works ?? []).map((w) => ({
      id: w.id,
      image_url: w.image_url,
      thumb_url: w.thumb_url,
      title: w.title ?? "",
      year: w.year ?? "",
      medium: w.medium ?? "",
      size: w.size ?? "",
      note: w.note ?? "",
    })),
    state: a.state,
    exists: true,
  };
}
