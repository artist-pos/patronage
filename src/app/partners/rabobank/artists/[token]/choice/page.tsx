import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInviteByToken } from "@/lib/rabobank/invites";
import { COPY } from "@/lib/rabobank/artist-copy";
import { Shell } from "../Shell";
import { ChoiceConfirm } from "./ChoiceConfirm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: COPY.meta.title, robots: { index: false, follow: false }, openGraph: { title: COPY.meta.title, images: [] } };

/**
 * Where the follow-up email's two links land. Nothing happens on load: email
 * scanners open links, so the artist confirms with a button press.
 */
export default async function ChoicePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ c?: string }> }) {
  const [{ token }, { c }] = await Promise.all([params, searchParams]);
  const invite = await getInviteByToken(token);
  if (!invite) notFound();
  const choice = c === "delete" ? "delete" : "keep";
  return (
    <Shell>
      <div className="space-y-5">
        <h1 className="text-4xl font-light tracking-tight">{COPY.followup.heading}</h1>
        {invite.artist_id ? (
          <ChoiceConfirm token={token} choice={choice} />
        ) : (
          <p className="leading-relaxed text-stone-600">{COPY.followup.deleted}</p>
        )}
      </div>
    </Shell>
  );
}
