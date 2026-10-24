import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/rabobank/settings";
import { getInviteByToken, recordOpen, windowsFor } from "@/lib/rabobank/invites";
import { loadProfile, loadQuote } from "@/lib/rabobank/artist-data";
import { COPY } from "@/lib/rabobank/artist-copy";
import { Landing } from "./Landing";
import { ClosedNotice, Shell } from "./Shell";

export const dynamic = "force-dynamic";

// Generic on purpose: link previews must not show names, prices or artwork.
export const metadata: Metadata = {
  title: COPY.meta.title,
  description: COPY.meta.description,
  robots: { index: false, follow: false },
  openGraph: { title: COPY.meta.title, description: COPY.meta.description, images: [] },
  twitter: { card: "summary", title: COPY.meta.title, description: COPY.meta.description },
};

export default async function ArtistInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const [{ token }, { s }] = await Promise.all([params, searchParams]);
  const invite = await getInviteByToken(token);
  if (!invite) notFound();

  const settings = await getSettings();
  const open = windowsFor(settings);
  await recordOpen(invite, s).catch(() => {});

  if (!open.partOneOpen && !open.partTwoOpen) {
    return (
      <Shell>
        <ClosedNotice />
      </Shell>
    );
  }

  const [quote, profile] = await Promise.all([loadQuote(invite.id), loadProfile(invite)]);
  return <Landing token={token} invite={invite} deadlineAt={settings.artist_deadline_at} open={open} quote={quote} profile={profile} />;
}
