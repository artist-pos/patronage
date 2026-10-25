import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { EMPTY_PROFILE } from "@/lib/rabobank/artist-profile";
import { rowToQuote } from "@/lib/rabobank/quote";
import type { ArtistInvite } from "@/lib/rabobank/invites";
import { Landing } from "../../../artists/[token]/Landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invite preview",
  robots: { index: false, follow: false },
};

/**
 * One artist's invite exactly as they'll first see it, for admins. Both parts
 * are open and nothing is saved, uploaded or recorded against the artist (no
 * open, no PDF read). Their real token never reaches the page.
 */
export default async function ArtistInvitePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) notFound();
  const { id } = await params;
  const { data } = await createAdminClient().from("rabobank_artist_invite").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const invite = { ...(data as ArtistInvite), token: "preview" };
  const settings = await getSettings();
  return (
    <Landing
      token="preview"
      invite={invite}
      deadlineAt={settings.artist_deadline_at}
      open={{ partOneOpen: true, partTwoOpen: true }}
      quote={{ draft: rowToQuote(null), status: "none", unsubmitted: false, savedAt: null }}
      profile={{ draft: { ...EMPTY_PROFILE, name: invite.full_name ?? invite.first_name }, works: [], state: null, exists: false }}
      takes={invite.thoughts ?? []}
      hasDirection={!!settings.direction_pdf_path}
      preview
    />
  );
}
