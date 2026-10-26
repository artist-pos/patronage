import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";
import { slugify } from "@/lib/slugify";
import { sendKeepLink } from "@/lib/rabobank/artist-email";
import type { ArtistInvite } from "@/lib/rabobank/invites";

type Admin = ReturnType<typeof createAdminClient>;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

async function uniqueUsername(admin: Admin, seed: string): Promise<string> {
  const base = slugify(seed).slice(0, 24).replace(/-+$/, "") || "artist";
  let username = base;
  for (let n = 1; ; n++) {
    const { data } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!data) return username;
    username = `${base}-${n}`;
  }
}

/**
 * Emails a sign-in link that lands on /rabobank-keep/{token}. Creates the auth
 * user first if there isn't one, as the collaborator invite does.
 */
export async function sendKeepEmail(invite: ArtistInvite, email: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const address = email.trim().toLowerCase();
  if (!(await findAuthUserIdByEmail(admin, address))) {
    const { error } = await admin.auth.admin.createUser({ email: address, email_confirm: true, user_metadata: { source: "rabobank_pilot" } });
    if (error) return { ok: false, error: error.message };
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: address });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return { ok: false, error: error?.message ?? "Could not make a sign-in link." };
  const next = encodeURIComponent(`/rabobank-keep/${invite.token}`);
  const link = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${next}`;
  await sendKeepLink({ to: address, firstName: invite.first_name, link });
  return { ok: true };
}

/**
 * Turns the Rabobank profile into the signed-in user's Patronage profile:
 * creates the profile row if missing, fills only empty fields, and copies the
 * works into their portfolio (archival artworks, not for sale). Idempotent.
 */
export async function keepAsPatronageProfile(userId: string, userEmail: string | null, invite: ArtistInvite) {
  const admin = createAdminClient();
  if (!invite.artist_id) return { ok: false as const, error: "There is no profile to keep yet." };
  const { data: artist } = await admin.from("rabobank_artist").select("*").eq("id", invite.artist_id).maybeSingle();
  if (!artist) return { ok: false as const, error: "This profile is no longer available." };

  const { data: existing } = await admin
    .from("profiles")
    .select("id, username, full_name, bio, avatar_url, website_url, instagram_handle")
    .eq("id", userId)
    .maybeSingle();

  let username = existing?.username as string | undefined;
  if (!existing) {
    username = await uniqueUsername(admin, artist.name || invite.full_name || invite.first_name);
    const { error } = await admin.from("profiles").insert({
      id: userId,
      username,
      role: "artist",
      email: userEmail,
      full_name: artist.name,
      bio: artist.bio,
      avatar_url: artist.photo_url,
      website_url: artist.website_url,
      instagram_handle: artist.instagram,
    });
    if (error) return { ok: false as const, error: error.message };
  } else {
    const fill: Record<string, unknown> = {};
    if (!existing.full_name && artist.name) fill.full_name = artist.name;
    if (!existing.bio && artist.bio) fill.bio = artist.bio;
    if (!existing.avatar_url && artist.photo_url) fill.avatar_url = artist.photo_url;
    if (!existing.website_url && artist.website_url) fill.website_url = artist.website_url;
    if (!existing.instagram_handle && artist.instagram) fill.instagram_handle = artist.instagram;
    if (Object.keys(fill).length) await admin.from("profiles").update(fill).eq("id", userId);
  }

  if (artist.state !== "kept") {
    // Atomic claim: concurrent requests (link prefetch, double navigation) race
    // here, and only the one that flips the state may copy the works.
    const { data: claimed } = await admin
      .from("rabobank_artist")
      .update({ state: "kept", visibility_choice: "keep", kept_profile_id: userId })
      .eq("id", artist.id)
      .neq("state", "kept")
      .select("id");
    if (!claimed?.length) return { ok: true as const, username };

    const { data: works } = await admin
      .from("rabobank_work")
      .select("image_url, thumb_url, title, year, medium, size, note, sort_order")
      .eq("artist_id", artist.id)
      .order("sort_order", { ascending: true });
    const { data: have } = await admin.from("artworks").select("url").eq("profile_id", userId);
    const haveUrls = new Set((have ?? []).map((a) => a.url));
    const count = have?.length ?? 0;
    const fresh = (works ?? []).filter((w) => !haveUrls.has(w.image_url));
    if (fresh.length) {
      const { error } = await admin.from("artworks").insert(
        fresh.map((w, i) => ({
          profile_id: userId,
          creator_id: userId,
          current_owner_id: userId,
          url: w.image_url,
          thumb_url: w.thumb_url,
          title: w.title,
          year: /^\d{4}$/.test(w.year ?? "") ? Number(w.year) : null,
          medium: w.medium,
          dimensions: w.size,
          description: w.note,
          is_available: false,
          position: count + i,
          source: "self_registered",
        }))
      );
      if (error) {
        // Release the claim so a retry can copy the works.
        await admin.from("rabobank_artist").update({ state: artist.state, kept_profile_id: null }).eq("id", artist.id);
        return { ok: false as const, error: error.message };
      }
    }
  }
  return { ok: true as const, username };
}
