"use server";

import { createClient } from "@/lib/supabase/server";
import { getLinkPreviewForText, type LinkPreview } from "@/lib/link-preview";

/**
 * Resolves the card for the first link in a studio update's words, for the
 * composer to store alongside the update. Signed-in users only: this makes the
 * server fetch an address someone typed, so it isn't open to the public.
 */
export async function resolveLinkPreview(text: string): Promise<LinkPreview | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getLinkPreviewForText(text.slice(0, 5000));
}
