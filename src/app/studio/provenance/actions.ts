"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateDirectTransfer } from "@/app/dashboard/provenance-actions";

export async function saveCertificateNote(
  artworkId: string,
  note: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("artworks")
    .update({ certificate_note: note.trim() || null })
    .eq("id", artworkId)
    .eq("creator_id", user.id);

  return error ? { error: error.message } : {};
}

export async function logSaleAndTransfer(data: {
  title: string;
  medium?: string | null;
  dimensions?: string | null;
  year?: number | null;
  imageUrl?: string | null;
  buyerName: string;
  buyerEmail: string;
  price?: number | null;
  notes?: string | null;
}): Promise<{ error?: string; ledgerId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    return { error: "Only artists can log a sale." };
  }

  const admin = createAdminClient();

  const { data: artwork, error: insertError } = await admin
    .from("artworks")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      title: data.title.trim(),
      caption: data.title.trim(),
      medium: data.medium ?? null,
      dimensions: data.dimensions ?? null,
      year: data.year ?? null,
      url: data.imageUrl ?? null,
      content_type: "image",
      is_available: true,
      hide_available: false,
      hide_price: false,
      price: null,
      price_currency: "NZD",
      position: 0,
    })
    .select("id")
    .single();

  if (insertError || !artwork) return { error: insertError?.message ?? "Failed to create artwork." };

  return initiateDirectTransfer(
    artwork.id,
    data.buyerName.trim(),
    data.buyerEmail.trim(),
    data.price ?? null,
    data.notes?.trim() || null,
  );
}
