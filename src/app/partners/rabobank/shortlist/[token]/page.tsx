import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNz, windowState } from "@/lib/rabobank/time";
import { DEFAULT_SHORTLIST_INTRO, getArtistCards } from "@/lib/rabobank/shortlist";
import { ShortlistView } from "./ShortlistView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke event space shortlist",
  robots: { index: false, follow: false },
};

export default async function StaffShortlist({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await verifyToken(token, "staff"))) notFound();

  const settings = await getSettings();
  const state = windowState(settings.shortlist_open_at, settings.shortlist_close_at);
  // Curator order, works and notes only. Fees and timelines are never loaded here.
  const artists = state === "open" ? await getArtistCards({ includeHidden: false }) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-3 text-2xl font-semibold">Te Puke event space shortlist</h1>
      {state === "open" ? (
        <>
          <p className="mb-2 text-muted-foreground">{settings.shortlist_intro?.trim() || DEFAULT_SHORTLIST_INTRO}</p>
          {settings.shortlist_close_at && (
            <p className="mb-8 text-sm text-muted-foreground">Closes {formatNz(settings.shortlist_close_at)}.</p>
          )}
          <ShortlistView artists={artists} token={token} nameMode={settings.collect_first_name} />
        </>
      ) : (
        <p className="text-muted-foreground" role="status">
          {state === "before"
            ? `The shortlist opens ${formatNz(settings.shortlist_open_at)}. Please check back then.`
            : "Responses have closed. Thank you to everyone who took part."}
        </p>
      )}
      <p className="mt-12 text-xs text-muted-foreground">A Patronage commission page.</p>
    </div>
  );
}
