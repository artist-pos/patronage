"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendProvenanceInvite, sendProvenanceNotification } from "@/lib/email";

export async function markInCollection(
  artworkId: string,
  label: string,
  patronIdentifier?: string // username or email address
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify caller is the creator
  const { data: artwork } = await supabase
    .from("artworks")
    .select("id, caption, creator_id")
    .eq("id", artworkId)
    .single();

  if (!artwork || artwork.creator_id !== user.id) {
    return { error: "Not authorised." };
  }

  // Mark as collected
  const { error: updateError } = await supabase
    .from("artworks")
    .update({ is_available: false, collection_label: label.trim() })
    .eq("id", artworkId);

  if (updateError) return { error: updateError.message };

  // Optionally link a patron (by username or email)
  const identifier = patronIdentifier?.trim();
  if (identifier) {
    const isEmail = identifier.includes("@");
    const admin = createAdminClient();
    const workTitle = artwork.caption ?? "Untitled";

    // Get artist display name for emails
    const { data: artistProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();
    const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "The artist";

    if (isEmail) {
      // Look up user by email via admin client
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const matchedUser = users.find((u) => u.email?.toLowerCase() === identifier.toLowerCase());

      if (matchedUser) {
        // Existing account — create pending provenance link
        const { data: patronProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("id", matchedUser.id)
          .single();

        if (patronProfile) {
          await admin.from("provenance_links").insert({
            artwork_id: artworkId,
            artist_id: user.id,
            patron_id: matchedUser.id,
            status: "pending",
          });
          sendProvenanceNotification(matchedUser.id, artistName, workTitle).catch(console.error);
        }
      } else {
        // No account — create invited provenance link with email
        const { data: link } = await admin
          .from("provenance_links")
          .insert({
            artwork_id: artworkId,
            artist_id: user.id,
            patron_id: null,
            patron_email: identifier,
            status: "invited",
          })
          .select("claim_token")
          .single();

        if (link) {
          const claimUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/claim/${link.claim_token}`;
          sendProvenanceInvite(identifier, artistName, workTitle, claimUrl).catch(console.error);
        }
      }
    } else {
      // Username lookup
      const { data: patronProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", identifier)
        .single();

      if (patronProfile) {
        await supabase.from("provenance_links").insert({
          artwork_id: artworkId,
          artist_id: user.id,
          patron_id: patronProfile.id,
          status: "pending",
        });
        sendProvenanceNotification(patronProfile.id, artistName, workTitle).catch(console.error);
      }
    }
  }

  // Revalidate the artist profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile) revalidatePath(`/${profile.username}`);
  return {};
}

export async function clearCollectionStatus(artworkId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: artwork } = await supabase
    .from("artworks")
    .select("creator_id, profile_id")
    .eq("id", artworkId)
    .single();

  if (!artwork || artwork.creator_id !== user.id) {
    return { error: "Not authorised." };
  }

  const { error } = await supabase
    .from("artworks")
    .update({ is_available: true, collection_label: null })
    .eq("id", artworkId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile) revalidatePath(`/${profile.username}`);
  return {};
}
